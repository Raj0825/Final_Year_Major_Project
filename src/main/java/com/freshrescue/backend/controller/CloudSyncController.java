package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.CloudInventoryItem;
import com.freshrescue.backend.entity.CloudOrder;
import com.freshrescue.backend.entity.CloudStore;
import com.freshrescue.backend.entity.FreshnessPoint;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.CloudInventoryRepository;
import com.freshrescue.backend.repository.CloudOrderRepository;
import com.freshrescue.backend.repository.CloudStoreRepository;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.security.StoreAuthorizationService;
import com.freshrescue.backend.service.BatchStateService;
import com.freshrescue.backend.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Cloud sync API for inventory, stores and orders.
 *
 * SECURITY CHANGES vs. the previous version:
 * - POST /orders is now customer/NGO only and CREATE-only. The client may send
 * only listingId, quantity,
 * notes and pickupTime. id, qrCode, storeId, customerEmail and status are all
 * set by the server.
 * - Existing orders can no longer be overwritten through POST /orders (this was
 * an IDOR + a bypass
 * of the FULFILLED check in PATCH /status).
 * - Stock is decremented atomically inside order creation, and restored when an
 * order is cancelled.
 * - The public /inventory/{id}/reserve and /inventory/{id}/release endpoints
 * are removed
 * (any customer could zero out or inflate any store's stock).
 * - Inventory save/batch/sync now verify the EXISTING item belongs to the
 * caller's store, so one store
 * can no longer take over another store's item by reusing its id.
 * - Status changes use an allowlist and an atomic "not already finished" guard.
 * - IDs are random UUIDs instead of timestamps.
 *
 * CloudOrder fields populated server-side on create:
 * id, qrCode, storeId, listingId, productName, storeName, storeLocation,
 * customerName, customerEmail, customerLocation, quantity, unit, priceAtOrder,
 * status, reservedAt, pickupTime, notes.
 */
@Slf4j
@RestController
@RequestMapping("/api/cloud-sync")
@RequiredArgsConstructor
public class CloudSyncController {

    /** Keep these in sync with the status strings your frontend uses. */
    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of("RESERVED", "CONFIRMED", "READY", "FULFILLED",
            "CANCELLED", "EXPIRED");
    private static final Set<String> TERMINAL_ORDER_STATUSES = Set.of("FULFILLED", "CANCELLED", "EXPIRED");

    private static final String INITIAL_ORDER_STATUS = "RESERVED";
    private static final double MAX_ORDER_QUANTITY = 1000;
    private static final int MAX_BULK_ITEMS = 500;
    private static final int MAX_NOTES_LENGTH = 500;

    private final CloudInventoryRepository inventoryRepo;
    private final CloudStoreRepository storeRepo;
    private final CloudOrderRepository orderRepo;
    private final UserRepository userRepository;
    private final StoreAuthorizationService storeAuthService;
    private final MongoTemplate mongoTemplate;
    private final WatchlistService watchlistService;
    private final StoreRepository storeRepository;
    private final BatchStateService batchStateService;

    // =====================================================================
    // Inventory
    // =====================================================================

    @GetMapping("/inventory")
    public List<CloudInventoryItem> getAllInventory() {
        List<CloudInventoryItem> all = inventoryRepo.findAll();
        // freshnessHistory is served only through /history
        for (CloudInventoryItem item : all) {
            item.setFreshnessHistory(null);
        }
        return all;
    }

    @PostMapping("/inventory")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public CloudInventoryItem saveInventoryItem(@RequestBody CloudInventoryItem item, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        CloudInventoryItem prepared = prepareForSave(item, authorized);
        if (prepared == null) {
            throw new AccessDeniedException("Cannot save this inventory item (store mismatch or invalid data).");
        }

        CloudInventoryItem saved = inventoryRepo.save(prepared);
        triggerWatchlistCheck(saved);
        saved.setFreshnessHistory(null);
        return saved;
    }

    @PostMapping("/inventory/batch")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<CloudInventoryItem> saveInventoryBatch(@RequestBody List<CloudInventoryItem> items,
            Authentication auth) {
        if (items == null || items.size() > MAX_BULK_ITEMS) {
            throw new IllegalArgumentException("Batch must contain at most " + MAX_BULK_ITEMS + " items.");
        }
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);

        List<CloudInventoryItem> validItems = new ArrayList<>();
        for (CloudInventoryItem item : items) {
            CloudInventoryItem prepared = prepareForSave(item, authorized);
            if (prepared != null) {
                validItems.add(prepared);
            } else {
                log.warn("Ignored inventory item (unauthorized store, foreign existing item, or invalid data)");
            }
        }

        List<CloudInventoryItem> saved = inventoryRepo.saveAll(validItems);
        for (CloudInventoryItem item : saved) {
            triggerWatchlistCheck(item);
            item.setFreshnessHistory(null);
        }
        return saved;
    }

    @PutMapping("/inventory/sync")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<CloudInventoryItem> syncAllInventory(@RequestBody List<CloudInventoryItem> items, Authentication auth) {
        if (items == null || items.size() > MAX_BULK_ITEMS) {
            throw new IllegalArgumentException("Sync must contain at most " + MAX_BULK_ITEMS + " items.");
        }
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (authorized.isEmpty()) {
            throw new AccessDeniedException("No store associated with your account.");
        }

        // Upsert ONLY items belonging to the caller's store(s); never deleteAll()
        List<CloudInventoryItem> authorizedItems = new ArrayList<>();
        for (CloudInventoryItem item : items) {
            CloudInventoryItem prepared = prepareForSave(item, authorized);
            if (prepared != null) {
                authorizedItems.add(prepared);
            } else {
                log.warn("Sync ignored foreign/invalid inventory item");
            }
        }

        List<CloudInventoryItem> saved = inventoryRepo.saveAll(authorizedItems);
        for (CloudInventoryItem item : saved) {
            triggerWatchlistCheck(item);
            item.setFreshnessHistory(null);
        }
        return saved;
    }

    @GetMapping("/inventory/{id}/history")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<List<FreshnessPoint>> getInventoryHistory(@PathVariable String id, Authentication auth) {
        CloudInventoryItem item = inventoryRepo.findById(id).orElse(null);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        if (!storeAuthService.isAuthorizedForStore(auth, item.getStoreId())) {
            throw new AccessDeniedException("Unauthorized store access");
        }
        return ResponseEntity
                .ok(item.getFreshnessHistory() != null ? item.getFreshnessHistory() : Collections.emptyList());
    }

    @DeleteMapping("/inventory/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<Void> deleteInventoryItem(@PathVariable String id, Authentication auth) {
        CloudInventoryItem item = inventoryRepo.findById(id).orElse(null);
        if (item == null) {
            return ResponseEntity.noContent().build();
        }
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (!isAuthorizedStoreId(authorized, item.getStoreId())) {
            throw new AccessDeniedException("Cannot delete inventory of another store.");
        }
        inventoryRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/inventory/{id}/discard")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<?> confirmDiscardItem(
            @PathVariable String id,
            @RequestParam(required = false) Double quantity,
            Authentication auth) {
        CloudInventoryItem item = inventoryRepo.findById(id).orElse(null);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        if (!storeAuthService.isAuthorizedForStore(auth, item.getStoreId())) {
            throw new AccessDeniedException("Unauthorized store access.");
        }
        if (quantity != null && (quantity.isNaN() || quantity.isInfinite())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Quantity must be a finite number."));
        }

        double requested = (quantity != null && quantity > 0) ? quantity : item.getAvailable();
        double qtyToDiscard = Math.min(requested, item.getAvailable()); // cannot discard more than is available
        item.setDiscardedQuantity(item.getDiscardedQuantity() + qtyToDiscard);
        item.setAvailable(Math.max(0, item.getAvailable() - qtyToDiscard));
        item.setStatus("Discarded");

        if (item.getFreshnessHistory() == null) {
            item.setFreshnessHistory(new ArrayList<>());
        }
        FreshnessPoint.appendCapped(item.getFreshnessHistory(), FreshnessPoint.builder()
                .timestamp(Instant.now())
                .freshnessScore(item.getFreshnessScore())
                .tier("EXPIRED")
                .source(FreshnessPoint.FreshnessSource.MANUAL)
                .build());

        CloudInventoryItem saved = inventoryRepo.save(item);
        saved.setFreshnessHistory(null);
        return ResponseEntity.ok(saved);
    }

    // NOTE: /inventory/{id}/reserve and /inventory/{id}/release were REMOVED on
    // purpose.
    // Stock is now reserved inside POST /orders and returned inside PATCH
    // /orders/{id}/status (CANCELLED).

    // =====================================================================
    // Stores
    // =====================================================================

    @GetMapping("/stores")
    public List<CloudStore> getAllStores() {
        return storeRepo.findAll();
    }

    @PostMapping("/stores")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public CloudStore saveStore(@RequestBody CloudStore store, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (store.getId() != null && !isAuthorizedStoreId(authorized, store.getId())) {
            throw new AccessDeniedException("Cannot create/update store with unauthorized store id.");
        }
        if (store.getId() == null || store.getId().isBlank()) {
            store.setId("store-" + UUID.randomUUID());
        }
        return storeRepo.save(store);
    }

    @PutMapping("/stores/sync")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<CloudStore> syncAllStores(@RequestBody List<CloudStore> stores, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (authorized.isEmpty()) {
            throw new AccessDeniedException("No store associated with your account.");
        }
        if (stores == null || stores.size() > MAX_BULK_ITEMS) {
            throw new IllegalArgumentException("Sync must contain at most " + MAX_BULK_ITEMS + " stores.");
        }

        // Upsert ONLY stores whose ID matches the caller's authorized store(s); never
        // deleteAll()
        List<CloudStore> authorizedStores = stores.stream()
                .filter(s -> s.getId() != null && isAuthorizedStoreId(authorized, s.getId()))
                .collect(Collectors.toList());

        return storeRepo.saveAll(authorizedStores);
    }

    @DeleteMapping("/stores/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<Void> deleteStore(@PathVariable String id, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (!isAuthorizedStoreId(authorized, id)) {
            throw new AccessDeniedException("Cannot delete store: unauthorized.");
        }
        storeRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // =====================================================================
    // Orders
    // =====================================================================

    @GetMapping("/orders")
    public List<CloudOrder> getAllOrders(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return Collections.emptyList();
        }

        if (hasStoreRole(auth)) {
            Set<String> authorizedStoreIds = storeAuthService.getAuthorizedStoreIds(auth);
            if (authorizedStoreIds.isEmpty()) {
                return Collections.emptyList();
            }
            return orderRepo.findByStoreIdIn(authorizedStoreIds);
        }

        // Customer / NGO: only their own orders
        User user = resolveUser(auth);
        String email = user != null ? user.getEmail() : null;
        if (email == null || email.isBlank()) {
            return Collections.emptyList();
        }
        return orderRepo.findByCustomerEmailIgnoreCase(email.toLowerCase().trim());
    }

    /**
     * Create an order (reservation). The client sends ONLY: listingId, quantity,
     * and optionally notes / pickupTime / customerLocation.
     * Everything else (id, qrCode, storeId, customerEmail, priceAtOrder, status)
     * is set by the server.
     */
    @PostMapping("/orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'NGO')")
    public ResponseEntity<?> createOrder(@RequestBody CloudOrder in, Authentication auth) {
        User user = resolveUser(auth);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            throw new AccessDeniedException("Unknown user.");
        }

        if (in.getListingId() == null || in.getListingId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "listingId is required."));
        }
        double qty = in.getQuantity();
        if (Double.isNaN(qty) || Double.isInfinite(qty) || qty <= 0 || qty > MAX_ORDER_QUANTITY) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Quantity must be between 0 and " + (int) MAX_ORDER_QUANTITY + "."));
        }

        String listingId = in.getListingId().trim();
        CloudInventoryItem current = inventoryRepo.findById(listingId).orElse(null);
        if (current == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Item not found."));
        }
        if ("Discarded".equalsIgnoreCase(current.getStatus())
                || "Discard recommended".equalsIgnoreCase(current.getStatus())
                || batchStateService.isExpiredDate(current.getExpiryDate())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Item is no longer available."));
        }

        // Atomic stock decrement: only succeeds if enough stock is still available and not discarded
        CloudInventoryItem item = mongoTemplate.findAndModify(
                Query.query(Criteria.where("id").is(listingId)
                        .and("available").gte(qty)
                        .and("status").nin("Discarded", "Discard recommended")),
                new Update().inc("available", -qty),
                FindAndModifyOptions.options().returnNew(true),
                CloudInventoryItem.class);
        if (item == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Not enough stock available."));
        }

        try {
            CloudOrder order = new CloudOrder();
            order.setId("ord-" + UUID.randomUUID());
            order.setQrCode(UUID.randomUUID().toString()); // server-generated, unguessable
            order.setCustomerName(user.getName());
            order.setCustomerEmail(user.getEmail().toLowerCase().trim());
            order.setCustomerLocation(truncate(in.getCustomerLocation(), 200));
            order.setStoreId(item.getStoreId()); // from the DB, never from the client
            order.setListingId(item.getId());
            order.setProductName(item.getName());
            order.setStoreName(item.getStore());
            order.setStoreLocation(item.getStoreLocation());
            order.setQuantity(qty);
            order.setUnit(item.getUnit());
            order.setPriceAtOrder(Math.round(item.getCurrentPrice() * qty * 100.0) / 100.0);
            order.setStatus(INITIAL_ORDER_STATUS); // never from the client
            order.setReservedAt(Instant.now().toString());
            order.setPickupTime(truncate(in.getPickupTime(), 100));
            order.setNotes(truncate(in.getNotes(), MAX_NOTES_LENGTH));
            return ResponseEntity.ok(orderRepo.save(order));
        } catch (RuntimeException e) {
            restoreStock(item.getId(), qty); // do not lose stock if the order could not be saved
            throw e;
        }
    }

    @PatchMapping("/orders/{id}/status")
    public ResponseEntity<?> updateOrderStatus(
            @PathVariable String id,
            @RequestParam String status,
            Authentication auth) {

        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Authentication required.");
        }

        String target = status == null ? "" : status.trim().toUpperCase();
        if (!ALLOWED_ORDER_STATUSES.contains(target)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid status."));
        }

        CloudOrder order = orderRepo.findById(id).orElse(null);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }

        User user = resolveUser(auth);
        String userEmail = user != null ? user.getEmail() : null;

        boolean storeOwnsOrder = hasStoreRole(auth) && storeAuthService.isAuthorizedForStore(auth, order.getStoreId());
        boolean customerOwnsOrder = userEmail != null && order.getCustomerEmail() != null
                && userEmail.trim().equalsIgnoreCase(order.getCustomerEmail().trim());

        if ("CANCELLED".equals(target)) {
            // Customer may cancel only their own order; the order's own store may also
            // cancel
            if (!customerOwnsOrder && !storeOwnsOrder) {
                throw new AccessDeniedException("You do not have permission to cancel this order.");
            }
        } else if (!storeOwnsOrder) {
            // FULFILLED and every other status: only staff of the order's own store
            throw new AccessDeniedException("Only authorized staff of the order's store may change this status.");
        }

        // Atomic transition: only succeeds if the order is not already finished
        CloudOrder updated = mongoTemplate.findAndModify(
                Query.query(Criteria.where("id").is(id).and("status").nin(TERMINAL_ORDER_STATUSES)),
                new Update().set("status", target),
                FindAndModifyOptions.options().returnNew(true),
                CloudOrder.class);
        if (updated == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Order is already finished and cannot be changed."));
        }

        // Return the reserved stock exactly once (the atomic guard above prevents
        // double-restore)
        if ("CANCELLED".equals(target) && updated.getListingId() != null) {
            restoreStock(updated.getListingId(), updated.getQuantity());
        }
        return ResponseEntity.ok(updated);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /**
     * Validates and prepares an inventory item for saving.
     * Returns null if the item must be rejected: invalid data, a store the caller
     * does not own,
     * or an EXISTING item (same id) that belongs to a different store.
     */
    private CloudInventoryItem prepareForSave(CloudInventoryItem item, Set<String> authorized) {
        if (item == null || item.getStoreId() == null || !isAuthorizedStoreId(authorized, item.getStoreId())) {
            return null;
        }
        double available = item.getAvailable();
        if (Double.isNaN(available) || Double.isInfinite(available) || available < 0) {
            return null;
        }

        if (item.getId() == null || item.getId().isBlank()) {
            item.setId("inv-" + UUID.randomUUID());
        }
        if (item.getCreatedAt() == null) {
            item.setCreatedAt(Instant.now());
        }

        CloudInventoryItem existing = inventoryRepo.findById(item.getId()).orElse(null);
        if (existing != null && !isAuthorizedStoreId(authorized, existing.getStoreId())) {
            return null; // the id belongs to another store: refuse to overwrite it
        }

        // Keep stored history and ignore any history sent by the client; only the
        // server appends points
        if (existing != null && existing.getFreshnessHistory() != null) {
            item.setFreshnessHistory(new ArrayList<>(existing.getFreshnessHistory()));
        } else {
            item.setFreshnessHistory(new ArrayList<>());
        }
        appendFreshnessPointIfChanged(item, existing);
        return item;
    }

    private boolean isAuthorizedStoreId(Set<String> authorized, String storeId) {
        if (storeId == null || authorized == null) {
            return false;
        }
        String trimmed = storeId.trim();
        return authorized.stream().anyMatch(id -> id.equalsIgnoreCase(trimmed));
    }

    private boolean hasStoreRole(Authentication auth) {
        return auth != null && auth.getAuthorities() != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_STORE_MANAGER")
                        || a.getAuthority().equals("ROLE_STORE_STAFF"));
    }

    private User resolveUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return null;
        }
        String principal = auth.getName();
        return userRepository.findById(principal)
                .or(() -> userRepository.findByEmail(principal.toLowerCase().trim()))
                .orElse(null);
    }

    private void restoreStock(String itemId, double quantity) {
        if (itemId == null || Double.isNaN(quantity) || Double.isInfinite(quantity) || quantity <= 0) {
            return;
        }
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(itemId)),
                new Update().inc("available", quantity),
                CloudInventoryItem.class);
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private void appendFreshnessPointIfChanged(CloudInventoryItem item, CloudInventoryItem existing) {
        if (item.getFreshnessHistory() == null) {
            item.setFreshnessHistory(new ArrayList<>());
        }
        double score = item.getFreshnessScore() > 0 ? item.getFreshnessScore() : 0.95;
        String tier = resolveTier(score, item.getExpiryDate());

        boolean isNew = existing == null || item.getFreshnessHistory().isEmpty();
        boolean changed = existing != null && (Math.abs(existing.getFreshnessScore() - item.getFreshnessScore()) > 0.001
                || existing.getDiscountPercent() != item.getDiscountPercent());

        if (isNew || changed) {
            FreshnessPoint.appendCapped(item.getFreshnessHistory(), FreshnessPoint.builder()
                    .timestamp(Instant.now())
                    .freshnessScore(score)
                    .tier(tier)
                    .source(FreshnessPoint.FreshnessSource.MANUAL)
                    .build());
        }
    }

    private String resolveTier(double score, String expiryDate) {
        if (batchStateService.isExpiredDate(expiryDate)) {
            return "EXPIRED";
        }
        return batchStateService.resolveState(score).name();
    }

    private void triggerWatchlistCheck(CloudInventoryItem item) {
        try {
            GeoJsonPoint storeLoc = null;
            if (item.getStoreId() != null) {
                Store s = storeRepository.findById(item.getStoreId()).orElse(null);
                if (s != null) {
                    storeLoc = s.getLocation();
                }
            }
            watchlistService.checkItemAgainstWatches(
                    item.getId(),
                    item.getName(),
                    item.getCategory(),
                    item.getCurrentPrice(),
                    item.getDiscountPercent(),
                    item.getStore(),
                    storeLoc);
        } catch (Exception e) {
            log.warn("Failed watchlist check for item {}: {}", item.getId(), e.getMessage());
        }
    }
}