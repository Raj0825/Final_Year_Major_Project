package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    public record ReserveRequest(String listingId, double quantity) {}
    public record FulfillRequest(String qrCode) {}

    @PostMapping("/reserve")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public Order reserve(@RequestBody ReserveRequest request, Authentication auth) {
        String buyerId = auth.getName(); // JwtAuthFilter sets principal = userId
        String role = auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
        Order.BuyerType buyerType = Order.BuyerType.valueOf(role);
        return orderService.reserve(request.listingId(), buyerId, buyerType, request.quantity());
    }

    @PostMapping("/{id}/fulfill")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Order fulfill(@PathVariable String id, @RequestBody FulfillRequest request, Authentication auth) {
        String staffStoreId = (String) auth.getDetails(); // set by JwtAuthFilter from the JWT's storeId claim
        return orderService.fulfill(id, request.qrCode(), staffStoreId);
    }
}