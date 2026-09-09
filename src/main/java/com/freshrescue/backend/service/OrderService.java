package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ListingRepository listingRepository;
    private final MongoTemplate mongoTemplate;

    @Value("${freshness.reservation-hold-minutes}")
    private int holdMinutes;

    /**
     * Places a reservation against a listing.
     *
     * Concurrency note: this is the one place where two buyers could race for the
     * same stock. We use an atomic findAndModify (decrement quantityAvailable only if
     * it's >= requested quantity) rather than read-then-write, so two simultaneous
     * requests can't both succeed against the same last unit. If the atomic update
     * matches nothing, we know someone else got there first and reject the order.
     */
    public Order reserve(String listingId, String buyerId, Order.BuyerType buyerType, double quantity) {
        Query query = Query.query(
                Criteria.where("id").is(listingId).and("quantityAvailable").gte(quantity)
        );
        Update update = new Update().inc("quantityAvailable", -quantity);

        Listing updatedListing = mongoTemplate.findAndModify(
                query, update, Listing.class
        );

        if (updatedListing == null) {
            throw new IllegalStateException("Not enough stock available for listing " + listingId);
        }

        // Keep Batch.quantityReserved in lockstep with the listing decrement above, so that
        // the next ListingService.syncListingForBatch() call (triggered by a rescan or the
        // decay job) recomputes quantityAvailable from a Batch that actually reflects this
        // reservation, instead of overwriting it back to "nothing reserved".
        Query batchQuery = Query.query(Criteria.where("id").is(updatedListing.getBatchId()));
        Update batchUpdate = new Update().inc("quantityReserved", quantity);
        mongoTemplate.updateFirst(batchQuery, batchUpdate, com.freshrescue.backend.entity.Batch.class);

        Instant now = Instant.now();
        Order order = Order.builder()
                .listingId(listingId)
                .batchId(updatedListing.getBatchId())
                .storeId(updatedListing.getStoreId())
                .buyerId(buyerId)
                .buyerType(buyerType)
                .quantity(quantity)
                .priceAtOrder(updatedListing.getCurrentPrice())
                .status(Order.OrderStatus.RESERVED)
                .qrCode(UUID.randomUUID().toString())
                .reservedAt(now)
                .holdExpiresAt(now.plus(holdMinutes, ChronoUnit.MINUTES))
                .build();

        return orderRepository.save(order);
    }

    /** Store staff scans the QR or enters Order ID at pickup - finalizes the sale. */
    public Order fulfill(String orderId, String scannedQrCode, String staffStoreId) {
        return fulfillByCodeOrId(scannedQrCode != null && !scannedQrCode.isBlank() ? scannedQrCode : orderId, staffStoreId);
    }

    public Order fulfillByCodeOrId(String code, String staffStoreId) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("QR code or Order ID is required");
        }
        String cleanCode = code.trim();

        // 1. Try finding by exact qrCode, then by order ID
        Order order = orderRepository.findByQrCode(cleanCode)
                .or(() -> orderRepository.findById(cleanCode))
                .orElse(null);

        // 2. If not found, search among reserved orders for partial match
        if (order == null) {
            List<Order> allReserved = orderRepository.findAll().stream()
                    .filter(o -> o.getStatus() == Order.OrderStatus.RESERVED)
                    .toList();

            for (Order o : allReserved) {
                if (o.getId().endsWith(cleanCode) || o.getQrCode().equalsIgnoreCase(cleanCode)) {
                    order = o;
                    break;
                }
            }
        }

        if (order == null) {
            throw new IllegalArgumentException("No pending reservation found matching code: " + cleanCode);
        }

        if (order.getStatus() != Order.OrderStatus.RESERVED) {
            throw new IllegalStateException("Order is already " + order.getStatus());
        }

        order.setStatus(Order.OrderStatus.FULFILLED);
        order.setFulfilledAt(Instant.now());
        return orderRepository.save(order);
    }

    /**
     * Scheduled job (see ReservationExpiryService) calls this for any RESERVED order
     * whose hold has expired without payment/fulfillment - releases the quantity back
     * to the listing so it re-enters the feed.
     */
    public void expireReservation(Order order) {
        order.setStatus(Order.OrderStatus.EXPIRED_HOLD);
        orderRepository.save(order);

        Query query = Query.query(Criteria.where("id").is(order.getListingId()));
        Update update = new Update().inc("quantityAvailable", order.getQuantity());
        mongoTemplate.updateFirst(query, update, Listing.class);

        Query batchQuery = Query.query(Criteria.where("id").is(order.getBatchId()));
        Update batchUpdate = new Update().inc("quantityReserved", -order.getQuantity());
        mongoTemplate.updateFirst(batchQuery, batchUpdate, com.freshrescue.backend.entity.Batch.class);
    }

    public List<Order> findExpiredHolds(Instant cutoff) {
        return orderRepository.findByStatusAndHoldExpiresAtBefore(Order.OrderStatus.RESERVED, cutoff);
    }
}