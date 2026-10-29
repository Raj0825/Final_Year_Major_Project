package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.OrderRepository;
import com.freshrescue.backend.security.StoreAuthorizationService;
import com.freshrescue.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
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
    private final BatchRepository batchRepository;
    private final ListingRepository listingRepository;
    private final StoreAuthorizationService storeAuthService;

    public record ReserveRequest(String listingId, double quantity) {
    }

    public record FulfillRequest(String qrCode) {
    }

    public record FulfillCodeRequest(String code) {
    }

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
     * sorted newest first. Uses indexed repository queries without findAll().
     */
    @GetMapping("/store/pending")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getPendingStoreOrders(Authentication auth) {
        String userId = auth.getName();
        Set<String> myStoreIds = storeAuthService.getAuthorizedStoreIds(auth);
        Set<String> myBatchIds = getManagerBatchIds(userId, myStoreIds);

        if (myStoreIds.isEmpty() && myBatchIds.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Order> orderMap = new HashMap<>();
        if (!myStoreIds.isEmpty()) {
            orderRepository.findByStoreIdIn(myStoreIds).forEach(o -> orderMap.put(o.getId(), o));
        }
        if (!myBatchIds.isEmpty()) {
            orderRepository.findByBatchIdIn(myBatchIds).forEach(o -> orderMap.put(o.getId(), o));
        }

        List<Order> pending = orderMap.values().stream()
                .filter(o -> o.getStatus() == Order.OrderStatus.RESERVED)
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
        boolean authorized = storeAuthService.isAuthorizedForStore(auth, storeId);
        if (!authorized) {
            throw new AccessDeniedException("You do not have access to this store's orders.");
        }
        List<Order> orders = orderRepository.findByStoreIdOrderByReservedAtDesc(storeId);
        enrichOrdersWithProductNames(orders);
        return orders;
    }

    @GetMapping("/store")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getMyStoreOrders(Authentication auth) {
        String userId = auth.getName();
        Set<String> myStoreIds = storeAuthService.getAuthorizedStoreIds(auth);
        Set<String> myBatchIds = getManagerBatchIds(userId, myStoreIds);

        if (myStoreIds.isEmpty() && myBatchIds.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Order> orderMap = new HashMap<>();
        if (!myStoreIds.isEmpty()) {
            orderRepository.findByStoreIdIn(myStoreIds).forEach(o -> orderMap.put(o.getId(), o));
        }
        if (!myBatchIds.isEmpty()) {
            orderRepository.findByBatchIdIn(myBatchIds).forEach(o -> orderMap.put(o.getId(), o));
        }

        List<Order> filtered = orderMap.values().stream()
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
        String staffStoreId = storeAuthService.resolveAndVerifyStore(auth, null);
        return orderService.fulfillByCodeOrId(request.code(), staffStoreId);
    }

    @PostMapping("/{id}/fulfill")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Order fulfill(@PathVariable String id, @RequestBody(required = false) FulfillRequest request,
            Authentication auth) {
        String staffStoreId = storeAuthService.resolveAndVerifyStore(auth, null);
        String code = (request != null && request.qrCode() != null && !request.qrCode().isBlank()) ? request.qrCode()
                : id;
        return orderService.fulfillByCodeOrId(code, staffStoreId);
    }

    private Set<String> getManagerBatchIds(String userId, Set<String> storeIds) {
        Set<String> batchIds = new HashSet<>();
        if (storeIds != null && !storeIds.isEmpty()) {
            batchRepository.findByStoreIdIn(storeIds).forEach(b -> batchIds.add(b.getId()));
        }
        if (userId != null && !userId.isBlank()) {
            batchRepository.findByManagerId(userId).forEach(b -> batchIds.add(b.getId()));
        }
        return batchIds;
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
