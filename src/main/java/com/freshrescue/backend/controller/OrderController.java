package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.repository.OrderRepository;
import com.freshrescue.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrderRepository orderRepository;

    public record ReserveRequest(String listingId, double quantity) {}
    public record FulfillRequest(String qrCode) {}

    @GetMapping("/my-orders")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public List<Order> getMyOrders(Authentication auth) {
        String buyerId = auth.getName();
        return orderRepository.findByBuyerId(buyerId);
    }

    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getStoreOrders(@PathVariable String storeId, Authentication auth) {
        String staffStoreId = (String) auth.getDetails();
        if (staffStoreId != null && !staffStoreId.equals(storeId)) {
            throw new org.springframework.security.access.AccessDeniedException("Cannot access other store orders");
        }
        return orderRepository.findByStoreId(storeId);
    }

    @GetMapping("/store")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Order> getMyStoreOrders(Authentication auth) {
        String staffStoreId = (String) auth.getDetails();
        if (staffStoreId == null || staffStoreId.isBlank()) {
            return List.of();
        }
        return orderRepository.findByStoreId(staffStoreId);
    }

    @PostMapping("/reserve")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public Order reserve(@RequestBody ReserveRequest request, Authentication auth) {
        String buyerId = auth.getName(); // JwtAuthFilter sets principal = userId
        String role = auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
        Order.BuyerType buyerType = Order.BuyerType.valueOf(role);
        return orderService.reserve(request.listingId(), buyerId, buyerType, request.quantity());
    }

    public record FulfillCodeRequest(String code) {}

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
}