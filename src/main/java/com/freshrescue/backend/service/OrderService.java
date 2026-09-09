package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ListingRepository listingRepository;
    private final BatchRepository batchRepository;
    private final ListingService listingService;
    private final MongoTemplate mongoTemplate;

    @Value("${freshness.reservation-hold-minutes}")
    private int holdMinutes;

    /**
     * Places a reservation against a listing.
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

        // Resolve batchId: first from listing, then fallback to match by store + productName
        String resolvedBatchId = updatedListing.getBatchId();
        if (resolvedBatchId == null || resolvedBatchId.isBlank()) {
            if (updatedListing.getStoreId() != null && updatedListing.getProductName() != null) {
                List<Batch> storeBatches = batchRepository.findByStoreId(updatedListing.getStoreId());
                for (Batch b : storeBatches) {
                    if (updatedListing.getProductName().equalsIgnoreCase(b.getProductName())) {
                        resolvedBatchId = b.getId();
                        break;
                    }
                }
            }
        }

        if (resolvedBatchId != null) {
            Query batchQuery = Query.query(Criteria.where("id").is(resolvedBatchId));
            Update batchUpdate = new Update().inc("quantityReserved", quantity);
            mongoTemplate.updateFirst(batchQuery, batchUpdate, com.freshrescue.backend.entity.Batch.class);
            log.info("Incremented quantityReserved by {} on batch {}", quantity, resolvedBatchId);
        }

        Instant now = Instant.now();
        Order order = Order.builder()
                .listingId(listingId)
                .batchId(resolvedBatchId)
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
                if (o.getId().endsWith(cleanCode) || (o.getQrCode() != null && o.getQrCode().equalsIgnoreCase(cleanCode))) {
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

        // Deduct fulfilled quantity from parent Batch so store dashboard shows updated stock
        String targetBatchId = order.getBatchId();
        if ((targetBatchId == null || targetBatchId.isBlank()) && order.getListingId() != null) {
            targetBatchId = listingRepository.findById(order.getListingId())
                    .map(Listing::getBatchId)
                    .orElse(null);
        }
        if (targetBatchId == null && order.getListingId() != null) {
            Listing listing = listingRepository.findById(order.getListingId()).orElse(null);
            if (listing != null && listing.getStoreId() != null && listing.getProductName() != null) {
                List<Batch> storeBatches = batchRepository.findByStoreId(listing.getStoreId());
                for (Batch b : storeBatches) {
                    if (listing.getProductName().equalsIgnoreCase(b.getProductName())) {
                        targetBatchId = b.getId();
                        break;
                    }
                }
            }
        }

        if (targetBatchId != null) {
            order.setBatchId(targetBatchId);
            final String finalBatchId = targetBatchId;
            final double orderQuantity = order.getQuantity();
            batchRepository.findById(finalBatchId).ifPresent(batch -> {
                double oldQuantity = batch.getQuantity();
                double newQuantity = Math.max(0.0, batch.getQuantity() - orderQuantity);
                double newReserved = Math.max(0.0, batch.getQuantityReserved() - orderQuantity);
                batch.setQuantity(Math.round(newQuantity * 100.0) / 100.0);
                batch.setQuantityReserved(Math.round(newReserved * 100.0) / 100.0);
                batch.setUpdatedAt(Instant.now());
                Batch updatedBatch = batchRepository.save(batch);

                log.info("Batch {} inventory reduced after fulfillment: {} -> {} (reserved remaining: {})",
                        finalBatchId, oldQuantity, updatedBatch.getQuantity(), updatedBatch.getQuantityReserved());

                // Sync listing with remaining available stock
                listingService.syncListingForBatch(updatedBatch);
            });
        } else {
            log.warn("Could not determine batchId for fulfilled order {}", order.getId());
        }

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