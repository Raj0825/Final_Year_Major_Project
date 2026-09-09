package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.*;
import com.freshrescue.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreRepository storeRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final BatchRepository batchRepository;
    private final ListingRepository listingRepository;
    private final OrderRepository orderRepository;

    public record CreateStoreRequest(
            String name,
            String address,
            String phone,
            Double latitude,
            Double longitude
    ) {}

    public record ReviewRequest(
            int rating,
            String comment,
            String orderId
    ) {}

    public record StoreAnalytics(
            String storeId,
            String storeName,
            long totalBatches,
            long activeBatches,
            long expiredBatches,
            long activeListings,
            long totalOrders,
            long fulfilledOrders,
            double revenueRescued,
            double wastePreventedKg,
            Map<String, Long> batchStateDistribution
    ) {}

    @PostMapping
    @PreAuthorize("hasRole('STORE_MANAGER')")
    public ResponseEntity<Store> createStore(@RequestBody CreateStoreRequest req, Authentication auth) {
        String managerId = auth.getName();
        GeoJsonPoint loc = (req.latitude() != null && req.longitude() != null)
                ? new GeoJsonPoint(req.longitude(), req.latitude())
                : null;

        Store store = Store.builder()
                .name(req.name())
                .managerId(managerId)
                .address(req.address())
                .phone(req.phone())
                .location(loc)
                .averageRating(0.0)
                .reviewCount(0)
                .createdAt(Instant.now())
                .build();

        Store saved = storeRepository.save(store);

        // Update manager's storeId if empty
        userRepository.findById(managerId).ifPresent(user -> {
            if (user.getStoreId() == null || user.getStoreId().isBlank()) {
                user.setStoreId(saved.getId());
                userRepository.save(user);
            }
        });

        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public List<Store> getAllStores() {
        return storeRepository.findAll();
    }

    @GetMapping("/my-store")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<Store> getMyStore(Authentication auth) {
        String staffStoreId = (String) auth.getDetails();
        if (staffStoreId != null && !staffStoreId.isBlank()) {
            return storeRepository.findById(staffStoreId)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
        }
        String managerId = auth.getName();
        List<Store> stores = storeRepository.findByManagerId(managerId);
        if (!stores.isEmpty()) {
            return ResponseEntity.ok(stores.get(0));
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Store> getStore(@PathVariable String id) {
        return storeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/reviews")
    public List<Review> getStoreReviews(@PathVariable String id) {
        return reviewRepository.findByStoreIdOrderByCreatedAtDesc(id);
    }

    @PostMapping("/{id}/reviews")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public ResponseEntity<Review> postReview(
            @PathVariable String id,
            @RequestBody ReviewRequest req,
            Authentication auth
    ) {
        String reviewerId = auth.getName();
        String reviewerName = userRepository.findById(reviewerId)
                .map(User::getName)
                .orElse("Anonymous");

        int rating = Math.max(1, Math.min(5, req.rating()));

        Review review = Review.builder()
                .storeId(id)
                .reviewerId(reviewerId)
                .reviewerName(reviewerName)
                .rating(rating)
                .comment(req.comment())
                .orderId(req.orderId())
                .createdAt(Instant.now())
                .build();

        Review saved = reviewRepository.save(review);

        // Recalculate averageRating and reviewCount on store
        storeRepository.findById(id).ifPresent(store -> {
            List<Review> allReviews = reviewRepository.findByStoreId(id);
            double avg = allReviews.stream().mapToInt(Review::getRating).average().orElse(0.0);
            store.setAverageRating(Math.round(avg * 10.0) / 10.0);
            store.setReviewCount(allReviews.size());
            storeRepository.save(store);
        });

        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{id}/analytics")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public ResponseEntity<StoreAnalytics> getAnalytics(@PathVariable String id, Authentication auth) {
        String storeId = id;
        if ("me".equalsIgnoreCase(id)) {
            String staffStoreId = (String) auth.getDetails();
            if (staffStoreId != null && !staffStoreId.isBlank()) {
                storeId = staffStoreId;
            } else {
                List<Store> stores = storeRepository.findByManagerId(auth.getName());
                if (!stores.isEmpty()) {
                    storeId = stores.get(0).getId();
                }
            }
        }

        final String finalStoreId = storeId;
        String storeName = storeRepository.findById(finalStoreId)
                .map(Store::getName)
                .orElse("Store " + finalStoreId);

        List<Batch> batches = batchRepository.findByStoreId(finalStoreId);
        List<Listing> listings = listingRepository.findByStoreId(finalStoreId);
        List<Order> orders = orderRepository.findByStoreId(finalStoreId);

        long totalBatches = batches.size();
        long activeBatches = batches.stream().filter(b -> b.getState() != Batch.BatchState.EXPIRED).count();
        long expiredBatches = batches.stream().filter(b -> b.getState() == Batch.BatchState.EXPIRED).count();
        long activeListings = listings.stream().filter(l -> l.getQuantityAvailable() > 0).count();

        long totalOrders = orders.size();
        List<Order> fulfilled = orders.stream().filter(o -> o.getStatus() == Order.OrderStatus.FULFILLED).toList();
        long fulfilledOrders = fulfilled.size();

        double revenueRescued = fulfilled.stream()
                .mapToDouble(o -> o.getPriceAtOrder() * o.getQuantity())
                .sum();

        double wastePreventedKg = fulfilled.stream()
                .mapToDouble(Order::getQuantity)
                .sum();

        Map<String, Long> distribution = new LinkedHashMap<>();
        for (Batch.BatchState state : Batch.BatchState.values()) {
            long c = batches.stream().filter(b -> b.getState() == state).count();
            distribution.put(state.name(), c);
        }

        StoreAnalytics analytics = new StoreAnalytics(
                finalStoreId,
                storeName,
                totalBatches,
                activeBatches,
                expiredBatches,
                activeListings,
                totalOrders,
                fulfilledOrders,
                Math.round(revenueRescued * 100.0) / 100.0,
                Math.round(wastePreventedKg * 10.0) / 10.0,
                distribution
        );

        return ResponseEntity.ok(analytics);
    }
}
