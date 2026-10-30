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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
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
        if (Double.isNaN(quantity) || Double.isInfinite(quantity) || quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be a positive finite number: " + quantity);
        }

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
            try {
                Query batchQuery = Query.query(Criteria.where("id").is(resolvedBatchId));
                Update batchUpdate = new Update().inc("quantityReserved", quantity);
                mongoTemplate.updateFirst(batchQuery, batchUpdate, com.freshrescue.backend.entity.Batch.class);
                log.info("Incremented quantityReserved by {} on batch {}", quantity, resolvedBatchId);
            } catch (Exception ex) {
                // Roll back listing stock decrement if batch update fails
                Query rbQuery = Query.query(Criteria.where("id").is(listingId));
                Update rbUpdate = new Update().inc("quantityAvailable", quantity);
                mongoTemplate.updateFirst(rbQuery, rbUpdate, Listing.class);
                throw ex;
            }
        }

        Instant now = Instant.now();
        Order order = Order.builder()
                .listingId(listingId)
                .batchId(resolvedBatchId)
                .storeId(updatedListing.getStoreId())
                .productName(updatedListing.getProductName())
                .unit(updatedListing.getUnit())
                .buyerId(buyerId)
                .buyerType(buyerType)
                .quantity(quantity)
                .priceAtOrder(updatedListing.getCurrentPrice())
                .status(Order.OrderStatus.RESERVED)
                .qrCode(UUID.randomUUID().toString())
                .reservedAt(now)
                .holdExpiresAt(now.plus(holdMinutes, ChronoUnit.MINUTES))
                .build();

        try {
            return orderRepository.save(order);
        } catch (Exception ex) {
            // Roll back listing decrement and batch reservation on order save failure
            Query rbQuery = Query.query(Criteria.where("id").is(listingId));
            Update rbUpdate = new Update().inc("quantityAvailable", quantity);
            mongoTemplate.updateFirst(rbQuery, rbUpdate, Listing.class);
            if (resolvedBatchId != null) {
                Query bQuery = Query.query(Criteria.where("id").is(resolvedBatchId));
                Update bUpdate = new Update().inc("quantityReserved", -quantity);
                mongoTemplate.updateFirst(bQuery, bUpdate, com.freshrescue.backend.entity.Batch.class);
            }
            throw ex;
        }
    }

    public Order fulfillByCodeOrId(String code, String staffStoreId) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("QR code or Order ID is required");
        }
        String cleanCode = code.trim();

        // 1. Exact full qrCode or full order ID match only (no endsWith partial match)
        Order order = orderRepository.findByQrCode(cleanCode)
                .or(() -> orderRepository.findById(cleanCode))
                .orElse(null);

        if (order == null) {
            throw new IllegalArgumentException("No pending reservation found matching code: " + cleanCode);
        }

        if (staffStoreId == null || staffStoreId.isBlank()) {
            throw new AccessDeniedException("No store associated with your account.");
        }

        if (order.getStoreId() == null || !order.getStoreId().equalsIgnoreCase(staffStoreId.trim())) {
            throw new AccessDeniedException("Cannot fulfill orders belonging to another store.");
        }

        if (order.getStatus() != Order.OrderStatus.RESERVED) {
            throw new IllegalStateException("Order is already " + order.getStatus());
        }

        if (order.getHoldExpiresAt() != null && order.getHoldExpiresAt().isBefore(Instant.now())) {
            throw new IllegalStateException("Order hold has expired");
        }

        // 2. Atomic findAndModify: matches id + status RESERVED + store to prevent concurrent fulfillment
        Criteria criteria = Criteria.where("id").is(order.getId())
                .and("status").is(Order.OrderStatus.RESERVED)
                .and("storeId").is(order.getStoreId());

        Query atomicQuery = Query.query(criteria);
        Update atomicUpdate = new Update()
                .set("status", Order.OrderStatus.FULFILLED)
                .set("fulfilledAt", Instant.now());

        Order fulfilled = mongoTemplate.findAndModify(
                atomicQuery,
                atomicUpdate,
                FindAndModifyOptions.options().returnNew(true),
                Order.class
        );

        if (fulfilled == null) {
            throw new IllegalStateException("Order could not be fulfilled (it may have been fulfilled or expired concurrently)");
        }

        // Deduct fulfilled quantity from parent Batch so store dashboard shows updated stock
        String targetBatchId = fulfilled.getBatchId();
        if ((targetBatchId == null || targetBatchId.isBlank()) && fulfilled.getListingId() != null) {
            targetBatchId = listingRepository.findById(fulfilled.getListingId())
                    .map(Listing::getBatchId)
                    .orElse(null);
        }
        if (targetBatchId == null && fulfilled.getListingId() != null) {
            Listing listing = listingRepository.findById(fulfilled.getListingId()).orElse(null);
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
            fulfilled.setBatchId(targetBatchId);
            final String finalBatchId = targetBatchId;
            final double orderQuantity = fulfilled.getQuantity();

            // Atomic decrements for batch stock and reservation counter
            Query bQuery = Query.query(Criteria.where("id").is(finalBatchId));
            Update bUpdate = new Update()
                    .inc("quantity", -orderQuantity)
                    .inc("quantityReserved", -orderQuantity)
                    .set("updatedAt", Instant.now());
            mongoTemplate.updateFirst(bQuery, bUpdate, com.freshrescue.backend.entity.Batch.class);

            // Clamp so counters never go negative
            Update clampUpdate = new Update()
                    .max("quantity", 0.0)
                    .max("quantityReserved", 0.0);
            mongoTemplate.updateFirst(bQuery, clampUpdate, com.freshrescue.backend.entity.Batch.class);

            // Reload and sync listing
            batchRepository.findById(finalBatchId).ifPresent(updatedBatch -> {
                log.info("Batch {} inventory reduced after fulfillment (quantity: {}, reserved: {})",
                        finalBatchId, updatedBatch.getQuantity(), updatedBatch.getQuantityReserved());
                listingService.syncListingForBatch(updatedBatch);
            });
            return fulfilled;
        } else {
            log.warn("Could not determine batchId for fulfilled order {}", fulfilled.getId());
        }

        return fulfilled;
    }

    public void expireReservation(Order order) {
        if (order == null || order.getId() == null) return;

        // Atomic status change: match id + status RESERVED
        Query atomicQuery = Query.query(
                Criteria.where("id").is(order.getId()).and("status").is(Order.OrderStatus.RESERVED)
        );
        Update atomicUpdate = new Update().set("status", Order.OrderStatus.EXPIRED_HOLD);

        Order matchedOrder = mongoTemplate.findAndModify(
                atomicQuery,
                atomicUpdate,
                FindAndModifyOptions.options().returnNew(true),
                Order.class
        );

        // Release listing and batch stock ONLY if that update matched an order
        if (matchedOrder == null) {
            log.info("Reservation {} was already updated/fulfilled/expired, skipping stock release", order.getId());
            return;
        }

        // Release stock on listing
        if (matchedOrder.getListingId() != null) {
            Query query = Query.query(Criteria.where("id").is(matchedOrder.getListingId()));
            Update update = new Update().inc("quantityAvailable", matchedOrder.getQuantity());
            mongoTemplate.updateFirst(query, update, Listing.class);
        }

        // Release reserved stock on batch and re-sync listing
        String batchId = matchedOrder.getBatchId();
        if ((batchId == null || batchId.isBlank()) && matchedOrder.getListingId() != null) {
            batchId = listingRepository.findById(matchedOrder.getListingId())
                    .map(Listing::getBatchId)
                    .orElse(null);
        }

        if (batchId != null && !batchId.isBlank()) {
            Query batchQuery = Query.query(Criteria.where("id").is(batchId));
            Update batchUpdate = new Update().inc("quantityReserved", -matchedOrder.getQuantity());
            mongoTemplate.updateFirst(batchQuery, batchUpdate, com.freshrescue.backend.entity.Batch.class);
            Update clampUpdate = new Update().max("quantityReserved", 0.0);
            mongoTemplate.updateFirst(batchQuery, clampUpdate, com.freshrescue.backend.entity.Batch.class);
            batchRepository.findById(batchId).ifPresent(listingService::syncListingForBatch);
        } else if (matchedOrder.getListingId() != null) {
            listingRepository.findById(matchedOrder.getListingId()).ifPresent(l -> {
                if (l.getBatchId() != null) {
                    batchRepository.findById(l.getBatchId()).ifPresent(listingService::syncListingForBatch);
                }
            });
        }
    }

    public List<Order> findExpiredHolds(Instant cutoff) {
        return orderRepository.findByStatusAndHoldExpiresAtBefore(Order.OrderStatus.RESERVED, cutoff);
    }
}