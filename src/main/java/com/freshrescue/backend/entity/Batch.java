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
    private String managerId;
    private String productName;
    private String category;

    private double quantity;
    private String unit;

    private Instant stockedAt;

    private double originalPrice;

    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();


    private Double freshnessScore;
    private Instant predictedExpiryDate;
    private String ocrExtractedDate;



    @Builder.Default
    private boolean needsManualReview = false;


    @Builder.Default
    private BatchState state = BatchState.FRESH;
    private Integer currentDiscountPercent;

    @Builder.Default
    private double quantityReserved = 0;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public enum BatchState {
        FRESH, TIER_1, TIER_2, TIER_3, EXPIRED
    }
}