package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Notification;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.entity.Watch;
import com.freshrescue.backend.repository.NotificationRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.repository.WatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class WatchlistService {

    private final WatchRepository watchRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    public Watch createWatch(String userId, String keyword, String category, Double maxPrice, Double radiusKm) {
        if (keyword == null || keyword.trim().isBlank()) {
            throw new IllegalArgumentException("Keyword cannot be blank");
        }
        String cleanKeyword = keyword.trim();
        if (cleanKeyword.length() > 40) {
            throw new IllegalArgumentException("Keyword cannot exceed 40 characters");
        }

        long count = watchRepository.countByUserId(userId);
        if (count >= 20) {
            throw new IllegalStateException("You cannot have more than 20 watches");
        }

        if (maxPrice != null && maxPrice <= 0) {
            throw new IllegalArgumentException("Max price must be a positive number");
        }

        double radius = 5.0;
        if (radiusKm != null) {
            if (radiusKm < 1.0 || radiusKm > 50.0) {
                throw new IllegalArgumentException("Radius must be between 1 and 50 km");
            }
            radius = radiusKm;
        }

        Watch watch = Watch.builder()
                .userId(userId)
                .keyword(cleanKeyword)
                .category(category != null && !category.isBlank() ? category.trim() : null)
                .maxPrice(maxPrice)
                .radiusKm(radius)
                .createdAt(Instant.now())
                .build();

        return watchRepository.save(watch);
    }

    public List<Watch> getWatchesForUser(String userId) {
        return watchRepository.findByUserId(userId);
    }

    public void deleteWatchForUser(String watchId, String userId) {
        Watch watch = watchRepository.findById(watchId).orElse(null);
        if (watch == null) {
            throw new IllegalArgumentException("Watch not found: " + watchId);
        }
        if (!userId.equals(watch.getUserId())) {
            throw new AccessDeniedException("You do not own this watch");
        }
        watchRepository.deleteById(watchId);
    }

    /**
     * Checks all watches matching an item when it is newly listed or its price/discount drops.
     */
    public void checkItemAgainstWatches(String itemId,
                                       String productName,
                                       String category,
                                       double currentPrice,
                                       int discountPercent,
                                       String storeName,
                                       GeoJsonPoint storeLocation) {
        if (productName == null || productName.isBlank()) {
            return;
        }

        String searchCat = category != null ? category.trim() : "";
        List<Watch> candidates = watchRepository.findPotentialMatchingWatches(searchCat, currentPrice);
        if (candidates.isEmpty()) {
            return;
        }

        Instant cutoff24h = Instant.now().minus(24, ChronoUnit.HOURS);
        String normProduct = productName.toLowerCase().trim();
        String safeStoreName = (storeName != null && !storeName.isBlank()) ? storeName.trim() : "store";

        for (Watch watch : candidates) {
            // 1. Keyword check (case-insensitive contains)
            if (watch.getKeyword() == null || watch.getKeyword().isBlank()) {
                continue;
            }
            String normKeyword = watch.getKeyword().toLowerCase().trim();
            if (!normProduct.contains(normKeyword) && !normKeyword.contains(normProduct)) {
                continue;
            }

            // 2. Category check
            if (watch.getCategory() != null && !watch.getCategory().isBlank()) {
                if (category == null || !category.equalsIgnoreCase(watch.getCategory().trim())) {
                    continue;
                }
            }

            // 3. Price check
            if (watch.getMaxPrice() != null && currentPrice > watch.getMaxPrice()) {
                continue;
            }

            // 4. Distance check
            User user = userRepository.findById(watch.getUserId()).orElse(null);
            if (user == null) {
                continue;
            }

            if (user.getLocation() != null && storeLocation != null) {
                double userLat = user.getLocation().getY();
                double userLon = user.getLocation().getX();
                double storeLat = storeLocation.getY();
                double storeLon = storeLocation.getX();
                double distKm = haversineKm(userLat, userLon, storeLat, storeLon);
                if (distKm > watch.getRadiusKm()) {
                    continue;
                }
            }
            // If user has no saved location or store has no location, distance check is skipped as per spec

            // 5. 24-hour de-duplication
            boolean alreadyNotified = notificationRepository.existsByUserIdAndListingIdAndTypeAndCreatedAtAfter(
                    watch.getUserId(), itemId, Notification.NotificationType.WATCHLIST, cutoff24h);
            if (alreadyNotified) {
                continue;
            }

            // 6. Create Notification
            String message = "%s is now %d%% off at %s".formatted(productName.trim(), discountPercent, safeStoreName);
            Notification notif = Notification.builder()
                    .userId(watch.getUserId())
                    .listingId(itemId)
                    .type(Notification.NotificationType.WATCHLIST)
                    .message(message)
                    .createdAt(Instant.now())
                    .build();

            notificationRepository.save(notif);
            log.info("Watchlist matched for user {}: {}", watch.getUserId(), message);
        }
    }

    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c;
    }
}

