package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.service.BatchService;
import com.freshrescue.backend.service.ListingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;
    private final BatchRepository batchRepository;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final ListingService listingService;

    public record UpdateTierRequest(Batch.BatchState state, Integer discountPercent) {}

    /**
     * Resolves and verifies the caller's store:
     * 1) Collects authorized store IDs from JWT claim, User profile, and StoreRepository.
     * 2) If a requestStoreId is supplied, verifies it belongs to the caller's authorized stores.
     * 3) If no store is associated, throws AccessDeniedException.
     */
    private String resolveAndVerifyStore(Authentication auth, String requestStoreId) {
        String userId = auth.getName();
        String staffStoreId = (String) auth.getDetails();

        Set<String> authorizedStoreIds = new HashSet<>();
        if (staffStoreId != null && !staffStoreId.isBlank()) {
            authorizedStoreIds.add(staffStoreId.trim());
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) {
            authorizedStoreIds.add(user.getStoreId().trim());
        }

        List<Store> stores = storeRepository.findByManagerId(userId);
        for (Store s : stores) {
            authorizedStoreIds.add(s.getId());
            if (s.getName() != null && !s.getName().isBlank()) {
                authorizedStoreIds.add(s.getName().trim());
            }
        }

        if (authorizedStoreIds.isEmpty()) {
            throw new AccessDeniedException("No store associated with your account.");
        }

        if (requestStoreId != null && !requestStoreId.isBlank()) {
            String cleanId = requestStoreId.trim();
            boolean match = authorizedStoreIds.stream().anyMatch(id -> id.equalsIgnoreCase(cleanId));
            if (!match) {
                throw new AccessDeniedException("You do not have access to store: " + cleanId);
            }
            return cleanId;
        }

        // Return primary authorized store ID
        if (staffStoreId != null && !staffStoreId.isBlank()) return staffStoreId.trim();
        if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) return user.getStoreId().trim();
        return stores.get(0).getId();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch createBatch(@RequestBody Batch batch, Authentication auth) {
        String userId = auth.getName();
        String verifiedStoreId = resolveAndVerifyStore(auth, batch.getStoreId());
        batch.setStoreId(verifiedStoreId);
        batch.setManagerId(userId);
        Batch created = batchService.createBatch(batch);
        listingService.syncListingForBatch(created);
        return created;
    }

    @GetMapping("/my-batches")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> getMyBatches(Authentication auth) {
        String userId = auth.getName();
        User user = userRepository.findById(userId).orElse(null);

        java.util.Set<String> myStoreIds = new java.util.HashSet<>();
        if (auth.getDetails() != null) myStoreIds.add((String) auth.getDetails());
        if (user != null && user.getStoreId() != null) myStoreIds.add(user.getStoreId());
        List<Store> stores = storeRepository.findByManagerId(userId);
        for (Store s : stores) {
            myStoreIds.add(s.getId());
            if (s.getName() != null) myStoreIds.add(s.getName());
        }

        List<Batch> all = batchRepository.findAll();
        List<Batch> result = new java.util.ArrayList<>();
        for (Batch b : all) {
            boolean matches = (b.getManagerId() != null && b.getManagerId().equals(userId))
                    || (b.getStoreId() != null && myStoreIds.contains(b.getStoreId()));
            if (matches) {
                result.add(b);
            }
        }
        return result;
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch getBatch(@PathVariable String id, Authentication auth) {
        Batch batch = batchService.getBatch(id);
        resolveAndVerifyStore(auth, batch.getStoreId());
        return batch;
    }

    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> getBatchesForStore(@PathVariable String storeId, Authentication auth) {
        String verifiedStoreId = resolveAndVerifyStore(auth, storeId);
        return batchRepository.findByStoreId(verifiedStoreId);
    }

    @PatchMapping("/{id}/tier")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch updateBatchTier(@PathVariable String id, @RequestBody UpdateTierRequest req, Authentication auth) {
        Batch batch = batchService.getBatch(id);
        resolveAndVerifyStore(auth, batch.getStoreId());
        if (req.state() != null) {
            batch.setState(req.state());
        }
        if (req.discountPercent() != null) {
            batch.setCurrentDiscountPercent(req.discountPercent());
        } else if (req.state() == Batch.BatchState.TIER_1) {
            batch.setCurrentDiscountPercent(20);
        } else if (req.state() == Batch.BatchState.TIER_2) {
            batch.setCurrentDiscountPercent(40);
        } else if (req.state() == Batch.BatchState.TIER_3) {
            batch.setCurrentDiscountPercent(60);
        } else if (req.state() == Batch.BatchState.FRESH) {
            batch.setCurrentDiscountPercent(0);
        }
        batch.setNeedsManualReview(false);
        Batch saved = batchRepository.save(batch);
        listingService.syncListingForBatch(saved);
        return saved;
    }

    @PostMapping("/sync-listings")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> syncAllListings(Authentication auth) {
        List<Batch> batches = batchRepository.findAll();
        for (Batch b : batches) {
            listingService.syncListingForBatch(b);
        }
        return batches;
    }

    @PostMapping(value = "/{id}/scan", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch scanBatch(@PathVariable String id, @RequestParam("image") MultipartFile image,
                           Authentication auth) throws IOException {
        Batch batch = batchService.getBatch(id);
        resolveAndVerifyStore(auth, batch.getStoreId());
        return batchService.scanBatch(id, image.getBytes(), image.getOriginalFilename());
    }
}