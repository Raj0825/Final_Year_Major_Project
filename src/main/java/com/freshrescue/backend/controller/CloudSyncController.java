package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.CloudInventoryItem;
import com.freshrescue.backend.entity.CloudOrder;
import com.freshrescue.backend.entity.CloudStore;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.CloudInventoryRepository;
import com.freshrescue.backend.repository.CloudOrderRepository;
import com.freshrescue.backend.repository.CloudStoreRepository;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cloud-sync")
@RequiredArgsConstructor
public class CloudSyncController {

    private final CloudInventoryRepository inventoryRepo;
    private final CloudStoreRepository storeRepo;
    private final CloudOrderRepository orderRepo;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;

    // --- Inventory Sync ---
    @GetMapping("/inventory")
    public List<CloudInventoryItem> getAllInventory() {
        return inventoryRepo.findAll();
    }

    @PostMapping("/inventory")
    public CloudInventoryItem saveInventoryItem(@RequestBody CloudInventoryItem item) {
        if (item.getId() == null || item.getId().isBlank()) {
            item.setId("inv-" + System.currentTimeMillis());
        }
        if (item.getCreatedAt() == null) {
            item.setCreatedAt(Instant.now());
        }
        return inventoryRepo.save(item);
    }

    @PostMapping("/inventory/batch")
    public List<CloudInventoryItem> saveInventoryBatch(@RequestBody List<CloudInventoryItem> items) {
        for (CloudInventoryItem item : items) {
            if (item.getId() == null || item.getId().isBlank()) {
                item.setId("inv-" + System.currentTimeMillis() + "-" + (int) (Math.random() * 1000));
            }
            if (item.getCreatedAt() == null) {
                item.setCreatedAt(Instant.now());
            }
        }
        return inventoryRepo.saveAll(items);
    }

    @PutMapping("/inventory/sync")
    public List<CloudInventoryItem> syncAllInventory(@RequestBody List<CloudInventoryItem> items) {
        inventoryRepo.deleteAll();
        return inventoryRepo.saveAll(items);
    }

    @DeleteMapping("/inventory/{id}")
    public ResponseEntity<Void> deleteInventoryItem(@PathVariable String id) {
        inventoryRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // --- Stores Sync ---
    @GetMapping("/stores")
    public List<CloudStore> getAllStores() {
        return storeRepo.findAll();
    }

    @PostMapping("/stores")
    public CloudStore saveStore(@RequestBody CloudStore store) {
        if (store.getId() == null || store.getId().isBlank()) {
            store.setId("store-" + System.currentTimeMillis());
        }
        return storeRepo.save(store);
    }

    @PutMapping("/stores/sync")
    public List<CloudStore> syncAllStores(@RequestBody List<CloudStore> stores) {
        storeRepo.deleteAll();
        return storeRepo.saveAll(stores);
    }

    @DeleteMapping("/stores/{id}")
    public ResponseEntity<Void> deleteStore(@PathVariable String id) {
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
            String storeId = user != null && user.getStoreId() != null ? user.getStoreId() : (String) auth.getDetails();
            String storeName = null;
            if (storeId != null && !storeId.isBlank()) {
                storeName = storeRepo.findById(storeId).map(CloudStore::getName).orElse(null);
                if (storeName == null) {
                    storeName = storeRepository.findById(storeId).map(Store::getName).orElse(null);
                }
            }
            final String finalStoreId = storeId;
            final String finalStoreName = storeName;
            if ((finalStoreId == null || finalStoreId.isBlank()) && (finalStoreName == null || finalStoreName.isBlank())) {
                return Collections.emptyList();
            }
            return orderRepo.findAll().stream()
                    .filter(o -> (finalStoreId != null && !finalStoreId.isBlank() && finalStoreId.equalsIgnoreCase(o.getStoreId()))
                            || (finalStoreName != null && !finalStoreName.isBlank() && finalStoreName.equalsIgnoreCase(o.getStoreName())))
                    .collect(Collectors.toList());
        } else {
            // Customer / NGO: ONLY return orders matching customer's email
            if (email == null || email.isBlank()) {
                return Collections.emptyList();
            }
            final String cleanEmail = email.toLowerCase().trim();
            return orderRepo.findAll().stream()
                    .filter(o -> o.getCustomerEmail() != null && o.getCustomerEmail().toLowerCase().trim().equals(cleanEmail))

                    .collect(Collectors.toList());
        }
    }

    @PostMapping("/orders")
    public CloudOrder saveOrder(@RequestBody CloudOrder order, Authentication auth) {
        if (order.getId() == null || order.getId().isBlank()) {
            order.setId("ord-" + System.currentTimeMillis());
        }
        if (auth != null && auth.isAuthenticated()) {
            String principal = auth.getName();
            User user = userRepository.findById(principal).orElse(null);
            if (user == null) {
                user = userRepository.findByEmail(principal.toLowerCase().trim()).orElse(null);
            }
            String email = user != null ? user.getEmail() : principal;
            if ((order.getCustomerEmail() == null || order.getCustomerEmail().isBlank()) && email != null) {
                order.setCustomerEmail(email.toLowerCase().trim());
            }
        }
        return orderRepo.save(order);
    }

    @PatchMapping("/orders/{id}/status")
    public ResponseEntity<CloudOrder> updateOrderStatus(@PathVariable String id, @RequestParam String status) {
        return orderRepo.findById(id).map(order -> {
            order.setStatus(status);
            return ResponseEntity.ok(orderRepo.save(order));
        }).orElse(ResponseEntity.notFound().build());
    }
}
