package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Buyer-facing view of a Batch. Kept as a separate collection (rather than just
 * querying Batch directly) so:
 *   1) store-internal fields never leak to the Buyer App API
 *   2) we can put a geospatial index on storeLocation for "near me" queries
 *   3) the Buyer App feed query stays cheap (filter listings, not join through batches)
 *
 * A Listing is created/updated whenever its parent Batch enters TIER_1/2/3, and removed
 * (or flagged unavailable) when the Batch is EXPIRED or quantityAvailable hits 0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "listings")
public class Listing {

    @Id
    private String id;

    private String batchId;
    private String storeId;
    private String storeName;

    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint storeLocation; // [longitude, latitude]

    private String productName;
    private String category;
    private String imageUrl;

    private double originalPrice;
    private double currentPrice;
    private int discountPercent;

    private double quantityAvailable;
    private String unit;

    private Batch.BatchState tier;
    private boolean urgent; // true once in TIER_3, drives push notification + feed sort priority

    private Instant listedAt;
    private Instant updatedAt;
}
