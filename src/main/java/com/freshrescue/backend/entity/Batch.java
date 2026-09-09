package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A batch of produce stocked by a store. This is the "source of truth" that the
 * CNN/OCR pipeline updates, and that the state-machine (BatchStateService) transitions
 * through FRESH -> TIER_1 -> TIER_2 -> TIER_3 -> EXPIRED as freshnessScore decays.
 *
 * A Listing is derived from a Batch (see Listing.java) - Batch holds store-internal
 * detail, Listing is the buyer-facing projection of it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "batches")
public class Batch {

    @Id
    private String id;

    private String storeId;
    private String productName;   // e.g. "Banana"
    private String category;      // e.g. "Fruit"

    private double quantity;      // in kg or units, see unit field
    private String unit;          // "kg" | "unit"

    private Instant stockedAt;

    private double originalPrice;   // price per unit/kg before any freshness discount is applied

    @Builder.Default
    private List<String> imageUrls = new ArrayList<>(); // each rescan appends a new image

    // --- Fields written by the ML pipeline (see MlPredictionService) ---
    private Double freshnessScore;        // 0.0 (spoiled) - 1.0 (fresh), latest CNN output
    private Instant predictedExpiryDate;  // CNN estimate
    private String ocrExtractedDate;      // raw text OCR pulled off any printed label, for cross-check

    // Set when the ML service call fails so staff can rescan/verify manually instead of the
    // batch silently being pushed through the normal discount pipeline with a guessed score.
    @Builder.Default
    private boolean needsManualReview = false;

    // --- State machine fields (see BatchStateService) ---
    @Builder.Default
    private BatchState state = BatchState.FRESH;
    private Integer currentDiscountPercent;

    @Builder.Default
    private double quantityReserved = 0; // held by RESERVED orders, not yet fulfilled or cancelled

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public enum BatchState {
        FRESH, TIER_1, TIER_2, TIER_3, EXPIRED
    }
}