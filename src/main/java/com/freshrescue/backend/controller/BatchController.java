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
import java.util.List;

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
     * Resolves the caller's store reliably:
     * 1) Checks the JWT claim (details).
     * 2) Checks the User profile in MongoDB.
     * 3) Checks stores owned by this manager in StoreRepository.
     * 4) If the manager supplied a storeId, binds it to their profile.
     */
    private String resolveAndVerifyStore(Authentication auth, String requestStoreId) {
        String userId = auth.getName();
        String staffStoreId = (String) auth.getDetails();

        // 1. JWT claim
        if (staffStoreId != null && !staffStoreId.isBlank()) {
            if (requestStoreId == null || requestStoreId.isBlank() || staffStoreId.equalsIgnoreCase(requestStoreId.trim())) {
                return staffStoreId;
            }
        }

        // 2. User entity from DB
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) {
            String dbStoreId = user.getStoreId();
            if (requestStoreId == null || requestStoreId.isBlank() || dbStoreId.equalsIgnoreCase(requestStoreId.trim())) {
                return dbStoreId;
            }
        }

        // 3. Store managed by this user
        List<Store> stores = storeRepository.findByManagerId(userId);
        if (!stores.isEmpty()) {
            if (requestStoreId == null || requestStoreId.isBlank()) {
                return stores.get(0).getId();
            }
            for (Store s : stores) {
                if (s.getId().equalsIgnoreCase(requestStoreId.trim()) || s.getName().equalsIgnoreCase(requestStoreId.trim())) {
                    return s.getId();
                }
            }
            return stores.get(0).getId();
        }

        // 4. If requestStoreId is provided, bind to user
        if (requestStoreId != null && !requestStoreId.isBlank()) {
            String cleanId = requestStoreId.trim();
            if (user != null) {
                user.setStoreId(cleanId);
                userRepository.save(user);
            }
            return cleanId;
        }

        // 5. Default fallback store ID for managers
        if (user != null) {
            String defaultStoreId = "store_" + userId.substring(Math.max(0, userId.length() - 4));
            user.setStoreId(defaultStoreId);
            userRepository.save(user);
            return defaultStoreId;
        }

        throw new AccessDeniedException("No store associated with your account.");
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
                    || (b.getStoreId() != null && myStoreIds.contains(b.getStoreId()))
                    || b.getManagerId() == null; // auto-claim unassigned batches for single manager
            if (matches) {
                if (b.getManagerId() == null) {
                    b.setManagerId(userId);
                    batchRepository.save(b);
                }
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