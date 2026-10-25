package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "inventory_items")
public class CloudInventoryItem {
    @Id
    private String id;
    private String name;
    private String sku;
    private String category;
    private double available;
    private String unit;
    private double originalPrice;
    private double currentPrice;
    private int discountPercent;
    private String status;
    private String expiry;
    private String expiryDate;
    private int expiryHoursLeft;
    private String pickupDeadline;
    private boolean flagged;
    private String storeId;
    private String store;
    private String storeLocation;
    private String storeArea;
    private String storeCity;
    private String distance;
    private double freshnessScore;
    private String storageTip;
    private Instant createdAt;
}
