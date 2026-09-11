package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * A buyer's order against a Listing. Orders start RESERVED with a short hold
 * (see application.yml: freshness.reservation-hold-minutes) so two buyers can't both
 * "win" the last few units of a listing - the reservation is what actually decrements
 * Listing.quantityAvailable; if payment isn't confirmed before holdExpiresAt, a scheduled
 * job (ReservationExpiryService) releases the quantity back to the listing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    private String listingId;
    private String batchId;
    private String storeId;
    private String productName;
    private String unit;

    private String buyerId;
    private BuyerType buyerType;

    private double quantity;
    private double priceAtOrder;

    @Builder.Default
    private OrderStatus status = OrderStatus.RESERVED;

    private String qrCode;

    private Instant reservedAt;
    private Instant holdExpiresAt;
    private Instant fulfilledAt;

    public enum BuyerType {
        NGO, CUSTOMER
    }

    public enum OrderStatus {
        RESERVED, FULFILLED, CANCELLED, EXPIRED_HOLD
    }
}
