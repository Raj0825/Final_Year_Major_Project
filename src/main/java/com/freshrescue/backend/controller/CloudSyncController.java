package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.CloudInventoryItem;
import com.freshrescue.backend.entity.CloudOrder;
import com.freshrescue.backend.entity.CloudStore;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.CloudInventoryRepository;
import com.freshrescue.backend.repository.CloudOrderRepository;
import com.freshrescue.backend.repository.CloudStoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.security.StoreAuthorizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import com.freshrescue.backend.entity.FreshnessPoint;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.service.BatchStateService;
import com.freshrescue.backend.service.WatchlistService;
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

@Slf4j
@RestController
@RequestMapping("/api/cloud-sync")
@RequiredArgsConstructor
public class CloudSyncController {

    private final CloudInventoryRepository inventoryRepo;
    private final CloudStoreRepository storeRepo;
    private final CloudOrderRepository orderRepo;
    private final UserRepository userRepository;
    private final StoreAuthorizationService storeAuthService;
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;
    private final WatchlistService watchlistService;
    private final StoreRepository storeRepository;
    private final BatchStateService batchStateService;

    // --- Inventory Sync ---
    @GetMapping("/inventory")
    public List<CloudInventoryItem> getAllInventory() {
        List<CloudInventoryItem> all = inventoryRepo.findAll();
        // Item D: Exclude freshnessHistory from GET /cloud-sync/inventory responses (served only through /history)
        for (CloudInventoryItem item : all) {
            item.setFreshnessHistory(null);
        }
        return all;
    }

    @PostMapping("/inventory")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public CloudInventoryItem saveInventoryItem(@RequestBody CloudInventoryItem item, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (item.getStoreId() == null || authorized.stream().noneMatch(id -> id.equalsIgnoreCase(item.getStoreId().trim()))) {
            throw new AccessDeniedException("Cannot add inventory for unauthorized store.");
        }
        if (item.getId() == null || item.getId().isBlank()) {
            item.setId("inv-" + System.currentTimeMillis());
        }
        if (item.getCreatedAt() == null) {
            item.setCreatedAt(Instant.now());
        }

        CloudInventoryItem existing = inventoryRepo.findById(item.getId()).orElse(null);

        // Item D: Keep stored history and ignore any history sent by the client; only server appends points
        if (existing != null && existing.getFreshnessHistory() != null) {
            item.setFreshnessHistory(new ArrayList<>(existing.getFreshnessHistory()));
        } else {
            item.setFreshnessHistory(new ArrayList<>());
        }

        appendFreshnessPointIfChanged(item, existing);

        CloudInventoryItem saved = inventoryRepo.save(item);
        triggerWatchlistCheck(saved);
        saved.setFreshnessHistory(null);
        return saved;
    }

    @PostMapping("/inventory/batch")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<CloudInventoryItem> saveInventoryBatch(@RequestBody List<CloudInventoryItem> items, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        List<CloudInventoryItem> validItems = new ArrayList<>();
        for (CloudInventoryItem item : items) {
            if (item.getStoreId() != null && authorized.stream().anyMatch(id -> id.equalsIgnoreCase(item.getStoreId().trim()))) {
                if (item.getId() == null || item.getId().isBlank()) {
                    item.setId("inv-" + System.currentTimeMillis() + "-" + (int) (Math.random() * 1000));
                }
                if (item.getCreatedAt() == null) {
                    item.setCreatedAt(Instant.now());
                }
                CloudInventoryItem existing = inventoryRepo.findById(item.getId()).orElse(null);

                // Item D: Keep stored history and ignore client-provided history
                if (existing != null && existing.getFreshnessHistory() != null) {
                    item.setFreshnessHistory(new ArrayList<>(existing.getFreshnessHistory()));
                } else {
                    item.setFreshnessHistory(new ArrayList<>());
                }

                appendFreshnessPointIfChanged(item, existing);
                validItems.add(item);
            } else {
                log.warn("Ignored item {} with unauthorized storeId {}", item.getName(), item.getStoreId());
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
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (authorized.isEmpty()) {
            throw new AccessDeniedException("No store associated with your account.");
        }

        // Upsert ONLY items belonging to caller's authorized store(s); NEVER deleteAll()
        List<CloudInventoryItem> authorizedItems = new ArrayList<>();
        for (CloudInventoryItem item : items) {
            if (item.getStoreId() != null && authorized.stream().anyMatch(id -> id.equalsIgnoreCase(item.getStoreId().trim()))) {
                if (item.getId() == null || item.getId().isBlank()) {
                    item.setId("inv-" + System.currentTimeMillis() + "-" + (int) (Math.random() * 1000));
                }
                if (item.getCreatedAt() == null) {
                    item.setCreatedAt(Instant.now());
                }
                CloudInventoryItem existing = inventoryRepo.findById(item.getId()).orElse(null);

                // Item D: Keep stored history and ignore client-provided history
                if (existing != null && existing.getFreshnessHistory() != null) {
                    item.setFreshnessHistory(new ArrayList<>(existing.getFreshnessHistory()));
                } else {
                    item.setFreshnessHistory(new ArrayList<>());
                }

                appendFreshnessPointIfChanged(item, existing);
                authorizedItems.add(item);
            } else {
                log.warn("Sync ignored foreign/unauthorized item {} for storeId {}", item.getName(), item.getStoreId());
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
        return ResponseEntity.ok(item.getFreshnessHistory() != null ? item.getFreshnessHistory() : Collections.emptyList());
    }

    @DeleteMapping("/inventory/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<Void> deleteInventoryItem(@PathVariable String id, Authentication auth) {
        CloudInventoryItem item = inventoryRepo.findById(id).orElse(null);
        if (item == null) {
            return ResponseEntity.noContent().build();
        }
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (item.getStoreId() == null || authorized.stream().noneMatch(sid -> sid.equalsIgnoreCase(item.getStoreId().trim()))) {
            throw new AccessDeniedException("Cannot delete inventory of another store.");
        }
        inventoryRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // --- Atomic Stock Reservation & Release for Customers/NGOs ---
    @PostMapping("/inventory/{id}/reserve")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public ResponseEntity<?> reserveInventoryStock(@PathVariable String id, @RequestParam double quantity) {
        if (Double.isNaN(quantity) || Double.isInfinite(quantity) || quantity <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Quantity must be a positive finite number."));
        }

        Query query = Query.query(Criteria.where("id").is(id).and("available").gte(quantity));
        Update update = new Update().inc("available", -quantity);
        CloudInventoryItem updated = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                CloudInventoryItem.class
        );

        if (updated == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Not enough stock available or item not found."));
        }
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/inventory/{id}/release")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER', 'STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<?> releaseInventoryStock(@PathVariable String id, @RequestParam double quantity) {
        if (Double.isNaN(quantity) || Double.isInfinite(quantity) || quantity <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Quantity must be a positive finite number."));
        }

        Query query = Query.query(Criteria.where("id").is(id));
        Update update = new Update().inc("available", quantity);
        CloudInventoryItem updated = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                CloudInventoryItem.class
        );

        if (updated == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Item not found."));
        }
        return ResponseEntity.ok(updated);
    }

    // --- Stores Sync ---
    @GetMapping("/stores")
    public List<CloudStore> getAllStores() {
        return storeRepo.findAll();
    }

    @PostMapping("/stores")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public CloudStore saveStore(@RequestBody CloudStore store, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (store.getId() != null && authorized.stream().noneMatch(id -> id.equalsIgnoreCase(store.getId().trim()))) {
            throw new AccessDeniedException("Cannot create/update store with unauthorized store id.");
        }
        if (store.getId() == null || store.getId().isBlank()) {
            store.setId("store-" + System.currentTimeMillis());
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

        // Upsert ONLY stores whose ID matches caller's authorized store(s); NEVER deleteAll()
        List<CloudStore> authorizedStores = stores.stream()
                .filter(s -> s.getId() != null && authorized.stream().anyMatch(id -> id.equalsIgnoreCase(s.getId().trim())))
                .collect(Collectors.toList());

        return storeRepo.saveAll(authorizedStores);
    }

    @DeleteMapping("/stores/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<Void> deleteStore(@PathVariable String id, Authentication auth) {
        Set<String> authorized = storeAuthService.getAuthorizedStoreIds(auth);
        if (authorized.stream().noneMatch(sid -> sid.equalsIgnoreCase(id.trim()))) {
            throw new AccessDeniedException("Cannot delete store: unauthorized.");
        }
        storeRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // --- Orders Sync ---
    @GetMapping("/orders")
    public List<CloudOrder> getAllOrders(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return Collections.emptyList();
        }
        String principal = auth.getName();
        User user = userRepository.findById(principal).orElse(null);
        if (user == null) {
            user = userRepository.findByEmail(principal.toLowerCase().trim()).orElse(null);
        }
        String email = user != null ? user.getEmail() : principal;

        boolean isStoreStaffOrManager = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_STORE_MANAGER") || a.getAuthority().equals("ROLE_STORE_STAFF"));

        if (isStoreStaffOrManager) {
            Set<String> authorizedStoreIds = storeAuthService.getAuthorizedStoreIds(auth);
            if (authorizedStoreIds.isEmpty()) {
                return Collections.emptyList();
            }
            return orderRepo.findByStoreIdIn(authorizedStoreIds);
        } else {
            // Customer / NGO: ONLY return orders matching customer's email via indexed repository query
            if (email == null || email.isBlank()) {
                return Collections.emptyList();
            }
            return orderRepo.findByCustomerEmailIgnoreCase(email.toLowerCase().trim());
        }
    }

    @PostMapping("/orders")
    public ResponseEntity<?> saveOrder(@RequestBody CloudOrder order, Authentication auth) {
        boolean hasId = order.getId() != null && !order.getId().isBlank();
        boolean hasQrCode = order.getQrCode() != null && !order.getQrCode().isBlank();
        if (!hasId && !hasQrCode) {
            return ResponseEntity.badRequest().body(Map.of("message", "Order must have an id or qrCode"));
        }

        if (auth != null && auth.isAuthenticated()) {
            String principal = auth.getName();
            User user = userRepository.findById(principal).orElse(null);
            if (user == null) {
                user = userRepository.findByEmail(principal.toLowerCase().trim()).orElse(null);
            }
            String email = user != null ? user.getEmail() : principal;

            boolean isCustomer = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER") || a.getAuthority().equals("ROLE_NGO"));
            if (isCustomer && email != null) {
                order.setCustomerEmail(email.toLowerCase().trim());
            }
        }

        // Idempotency: If an order with the same qrCode already exists, update it (keep existing id)
        if (hasQrCode) {
            Optional<CloudOrder> existingByQr = orderRepo.findByQrCode(order.getQrCode().trim());
            if (existingByQr.isPresent()) {
                CloudOrder ex = existingByQr.get();
                if (order.getStatus() != null) ex.setStatus(order.getStatus());
                if (order.getNotes() != null) ex.setNotes(order.getNotes());
                if (order.getPickupTime() != null) ex.setPickupTime(order.getPickupTime());
                return ResponseEntity.ok(orderRepo.save(ex));
            }
        }

        if (hasId) {
            Optional<CloudOrder> existing = orderRepo.findById(order.getId().trim());
            if (existing.isPresent()) {
                CloudOrder ex = existing.get();
                if (order.getStatus() != null) ex.setStatus(order.getStatus());
                if (order.getNotes() != null) ex.setNotes(order.getNotes());
                if (order.getPickupTime() != null) ex.setPickupTime(order.getPickupTime());
                return ResponseEntity.ok(orderRepo.save(ex));
            }
        } else {
            order.setId("ord-" + System.currentTimeMillis());
        }

        return ResponseEntity.ok(orderRepo.save(order));
    }

    @PatchMapping("/orders/{id}/status")
    public ResponseEntity<CloudOrder> updateOrderStatus(
            @PathVariable String id,
            @RequestParam String status,
            Authentication auth) {

        CloudOrder order = orderRepo.findById(id).orElse(null);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }

        String targetStatus = status.trim().toUpperCase();

        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Authentication required.");
        }

        String principal = auth.getName();
        User user = userRepository.findById(principal).orElse(null);
        if (user == null) {
            user = userRepository.findByEmail(principal.toLowerCase().trim()).orElse(null);
        }
        String userEmail = user != null ? user.getEmail() : principal;

        boolean isStoreRole = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_STORE_MANAGER") || a.getAuthority().equals("ROLE_STORE_STAFF"));

        if ("FULFILLED".equalsIgnoreCase(targetStatus)) {
            // Only store roles of the order's own store may set FULFILLED
            if (!isStoreRole || !storeAuthService.isAuthorizedForStore(auth, order.getStoreId())) {
                throw new AccessDeniedException("Only authorized staff of the order's store may mark it FULFILLED.");
            }
        } else if ("CANCELLED".equalsIgnoreCase(targetStatus)) {
            // Customer may cancel only their own order; store staff of the store may also cancel
            boolean isOwnerCustomer = userEmail != null && order.getCustomerEmail() != null
                    && userEmail.equalsIgnoreCase(order.getCustomerEmail().trim());
            boolean isOwnerStore = isStoreRole && storeAuthService.isAuthorizedForStore(auth, order.getStoreId());
            if (!isOwnerCustomer && !isOwnerStore) {
                throw new AccessDeniedException("You do not have permission to cancel this order.");
            }
        } else {
            // Any other status change requires store role of this store
            if (!isStoreRole || !storeAuthService.isAuthorizedForStore(auth, order.getStoreId())) {
                throw new AccessDeniedException("Unauthorized status modification.");
            }
        }

        order.setStatus(targetStatus);
        return ResponseEntity.ok(orderRepo.save(order));
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
        double qtyToDiscard = (quantity != null && quantity > 0) ? quantity : item.getAvailable();
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
                    storeLoc
            );
        } catch (Exception e) {
            log.warn("Failed watchlist check for item {}: {}", item.getId(), e.getMessage());
        }
    }
}
