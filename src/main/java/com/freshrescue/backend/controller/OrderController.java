package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.OrderRepository;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final BatchRepository batchRepository;
    private final ListingRepository listingRepository;

    public record ReserveRequest(String listingId, double quantity) {}
    public record FulfillRequest(String qrCode) {}
    public record FulfillCodeRequest(String code) {}

    /**
     * Customer / NGO view: all my orders, newest booking at the top.
     */
    @GetMapping("/my-orders")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public List<Order> getMyOrders(Authentication auth) {
        String buyerId = auth.getName();
        List<Order> orders = orderRepository.findByBuyerIdOrderByReservedAtDesc(buyerId);
        enrichOrdersWithProductNames(orders);
        return orders;
    }

    /**
     * Store Manager view: all active pending reservations awaiting customer pickup,
     * sorted newest first.
     */
    @GetMapping("/store/pending")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getPendingStoreOrders(Authentication auth) {
        String userId = auth.getName();
        Set<String> myStoreIds = getManagerStoreIds(userId, (String) auth.getDetails());
        Set<String> myBatchIds = getManagerBatchIds(userId, myStoreIds);

        List<Order> allOrders = orderRepository.findAll();
        List<Order> pending = allOrders.stream()
                .filter(o -> o.getStatus() == Order.OrderStatus.RESERVED)
                .filter(o -> {
                    if (o.getStoreId() != null && myStoreIds.contains(o.getStoreId())) return true;
                    if (o.getBatchId() != null && myBatchIds.contains(o.getBatchId())) return true;
                    // Fallback in single-manager setup: claim order if storeIds match loosely
                    return myStoreIds.isEmpty() || myBatchIds.isEmpty();
                })
                .sorted((a, b) -> {
                    Instant t1 = b.getReservedAt() != null ? b.getReservedAt() : Instant.EPOCH;
                    Instant t2 = a.getReservedAt() != null ? a.getReservedAt() : Instant.EPOCH;
                    return t1.compareTo(t2);
                })
                .collect(Collectors.toList());

        enrichOrdersWithProductNames(pending);
        return pending;
    }

    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getStoreOrders(@PathVariable String storeId, Authentication auth) {
        List<Order> orders = orderRepository.findByStoreIdOrderByReservedAtDesc(storeId);
        enrichOrdersWithProductNames(orders);
        return orders;
    }

    @GetMapping("/store")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getMyStoreOrders(Authentication auth) {
        String userId = auth.getName();
        Set<String> myStoreIds = getManagerStoreIds(userId, (String) auth.getDetails());
        Set<String> myBatchIds = getManagerBatchIds(userId, myStoreIds);

        List<Order> allOrders = orderRepository.findAll();
        List<Order> filtered = allOrders.stream()
                .filter(o -> (o.getStoreId() != null && myStoreIds.contains(o.getStoreId()))
                        || (o.getBatchId() != null && myBatchIds.contains(o.getBatchId()))
                        || myStoreIds.isEmpty())
                .sorted((a, b) -> {
                    Instant t1 = b.getReservedAt() != null ? b.getReservedAt() : Instant.EPOCH;
                    Instant t2 = a.getReservedAt() != null ? a.getReservedAt() : Instant.EPOCH;
                    return t1.compareTo(t2);
                })
                .collect(Collectors.toList());

        enrichOrdersWithProductNames(filtered);
        return filtered;
    }

    @PostMapping("/reserve")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public Order reserve(@RequestBody ReserveRequest request, Authentication auth) {
        String buyerId = auth.getName();
        String role = auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
        Order.BuyerType buyerType = Order.BuyerType.valueOf(role);
        return orderService.reserve(request.listingId(), buyerId, buyerType, request.quantity());
    }

    @PostMapping("/fulfill-code")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Order fulfillByCode(@RequestBody FulfillCodeRequest request, Authentication auth) {
        String staffStoreId = (String) auth.getDetails();
        return orderService.fulfillByCodeOrId(request.code(), staffStoreId);
    }

    @PostMapping("/{id}/fulfill")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Order fulfill(@PathVariable String id, @RequestBody(required = false) FulfillRequest request, Authentication auth) {
        String staffStoreId = (String) auth.getDetails();
        String code = (request != null && request.qrCode() != null && !request.qrCode().isBlank()) ? request.qrCode() : id;
        return orderService.fulfillByCodeOrId(code, staffStoreId);
    }

    private Set<String> getManagerStoreIds(String userId, String detailsStoreId) {
        Set<String> storeIds = new HashSet<>();
        if (detailsStoreId != null && !detailsStoreId.isBlank()) storeIds.add(detailsStoreId.trim());
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) {
            storeIds.add(user.getStoreId().trim());
        }
        List<Store> stores = storeRepository.findByManagerId(userId);
        for (Store s : stores) {
            storeIds.add(s.getId());
            if (s.getName() != null) storeIds.add(s.getName().trim());
        }
        return storeIds;
    }

    private Set<String> getManagerBatchIds(String userId, Set<String> storeIds) {
        return batchRepository.findAll().stream()
                .filter(b -> (b.getManagerId() != null && b.getManagerId().equals(userId))
                        || (b.getStoreId() != null && storeIds.contains(b.getStoreId()))
                        || b.getManagerId() == null)
                .map(Batch::getId)
                .collect(Collectors.toSet());
    }

    private void enrichOrdersWithProductNames(List<Order> orders) {
        Map<String, String> productNameCache = new HashMap<>();
        Map<String, String> unitCache = new HashMap<>();

        for (Order o : orders) {
            if (o.getProductName() == null || o.getProductName().isBlank()) {
                if (o.getListingId() != null) {
                    if (productNameCache.containsKey(o.getListingId())) {
                        o.setProductName(productNameCache.get(o.getListingId()));
                        o.setUnit(unitCache.get(o.getListingId()));
                    } else {
                        listingRepository.findById(o.getListingId()).ifPresent(l -> {
                            productNameCache.put(o.getListingId(), l.getProductName());
                            unitCache.put(o.getListingId(), l.getUnit());
                            o.setProductName(l.getProductName());
                            o.setUnit(l.getUnit());
                        });
                    }
                }
                if (o.getProductName() == null && o.getBatchId() != null) {
                    batchRepository.findById(o.getBatchId()).ifPresent(b -> {
                        o.setProductName(b.getProductName());
                        o.setUnit(b.getUnit());
                    });
                }
            }
        }
    }
}