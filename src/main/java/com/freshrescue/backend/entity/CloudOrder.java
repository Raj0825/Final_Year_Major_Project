package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "cloud_orders")
public class CloudOrder {
    @Id
    private String id;
    private String listingId;
    private String productName;
    private String storeName;
    private String storeLocation;
    private String customerName;
    private String customerPhone;
    private String customerLocation;
    private double quantity;
    private String unit;
    private double priceAtOrder;
    private String status;
    private String reservedAt;
    private String pickupTime;
    private String qrCode;
    private String notes;
}
