package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.CloudInventoryItem;
import com.freshrescue.backend.entity.CloudOrder;
import com.freshrescue.backend.entity.CloudStore;
import com.freshrescue.backend.repository.CloudInventoryRepository;
import com.freshrescue.backend.repository.CloudOrderRepository;
import com.freshrescue.backend.repository.CloudStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/cloud-sync")
@RequiredArgsConstructor
public class CloudSyncController {

    private final CloudInventoryRepository inventoryRepo;
    private final CloudStoreRepository storeRepo;
    private final CloudOrderRepository orderRepo;

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
                item.setId("inv-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 1000));
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
    public List<CloudOrder> getAllOrders() {
        return orderRepo.findAll();
    }

    @PostMapping("/orders")
    public CloudOrder saveOrder(@RequestBody CloudOrder order) {
        if (order.getId() == null || order.getId().isBlank()) {
            order.setId("ord-" + System.currentTimeMillis());
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
