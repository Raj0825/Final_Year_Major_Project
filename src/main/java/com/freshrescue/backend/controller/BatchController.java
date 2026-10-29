package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.security.StoreAuthorizationService;
import com.freshrescue.backend.service.BatchService;
import com.freshrescue.backend.service.ListingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;
    private final BatchRepository batchRepository;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final StoreAuthorizationService storeAuthService;
    private final ListingService listingService;

    @Value("${freshness.discount.tier1-percent:20}")
    private int tier1Discount;

    @Value("${freshness.discount.tier2-percent:40}")
    private int tier2Discount;

    @Value("${freshness.discount.tier3-percent:60}")
    private int tier3Discount;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateBatchRequest(
            @NotBlank(message = "Product name is required") String productName,
            @NotBlank(message = "Category is required") String category,
            @Positive(message = "Quantity must be greater than zero") double quantity,
            @NotBlank(message = "Unit is required") String unit,
            @Positive(message = "Original price must be greater than zero") double originalPrice,
            Instant stockedAt) {
    }

    public record UpdateTierRequest(Batch.BatchState state, Integer discountPercent) {
    }

    /**
     * Resolves and verifies the caller's store:
     * 1) Collects authorized store IDs from JWT claim, User profile, and
     * StoreRepository.
     * 2) If a requestStoreId is supplied, verifies it belongs to the caller's
     * authorized stores.
     * 3) If no store is associated, throws AccessDeniedException.
     */
    private String resolveAndVerifyStore(Authentication auth, String requestStoreId) {
        return storeAuthService.resolveAndVerifyStore(auth, requestStoreId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch createBatch(@Valid @RequestBody CreateBatchRequest req, Authentication auth) {
        String userId = auth.getName();
        String verifiedStoreId = resolveAndVerifyStore(auth, null);
        Batch batch = Batch.builder()
                .storeId(verifiedStoreId)
                .managerId(userId)
                .productName(req.productName().trim())
                .category(req.category().trim())
                .quantity(req.quantity())
                .unit(req.unit().trim())
                .originalPrice(req.originalPrice())
                .stockedAt(req.stockedAt() != null ? req.stockedAt() : Instant.now())
                .state(Batch.BatchState.FRESH)
                .quantityReserved(0.0)
                .build();
        return batchService.createBatch(batch);
    }

    @GetMapping("/my-batches")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> getMyBatches(Authentication auth) {
        String userId = auth.getName();
        Set<String> myStoreIds = storeAuthService.getAuthorizedStoreIds(auth);

        Map<String, Batch> batchMap = new HashMap<>();
        if (!myStoreIds.isEmpty()) {
            batchRepository.findByStoreIdIn(myStoreIds).forEach(b -> batchMap.put(b.getId(), b));
        }
        if (userId != null && !userId.isBlank()) {
            batchRepository.findByManagerId(userId).forEach(b -> batchMap.put(b.getId(), b));
        }
        return new ArrayList<>(batchMap.values());
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
            if (req.discountPercent() < 0 || req.discountPercent() > 100) {
                throw new IllegalArgumentException("discountPercent must be between 0 and 100");
            }
            batch.setCurrentDiscountPercent(req.discountPercent());
        } else if (req.state() == Batch.BatchState.TIER_1) {
            batch.setCurrentDiscountPercent(tier1Discount);
        } else if (req.state() == Batch.BatchState.TIER_2) {
            batch.setCurrentDiscountPercent(tier2Discount);
        } else if (req.state() == Batch.BatchState.TIER_3) {
            batch.setCurrentDiscountPercent(tier3Discount);
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
        String verifiedStoreId = resolveAndVerifyStore(auth, null);
        List<Batch> batches = batchRepository.findByStoreId(verifiedStoreId);
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