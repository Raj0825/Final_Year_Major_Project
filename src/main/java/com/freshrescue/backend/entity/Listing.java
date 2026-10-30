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
    private GeoJsonPoint storeLocation;

    private String productName;
    private String category;
    private String imageUrl;

    private double originalPrice;
    private double currentPrice;
    private int discountPercent;

    private double quantityAvailable;
    private String unit;

    private Batch.BatchState tier;
    private boolean urgent;

    private Instant listedAt;
    private Instant updatedAt;
}
