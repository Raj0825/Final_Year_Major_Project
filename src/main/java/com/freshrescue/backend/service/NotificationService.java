package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.entity.Notification;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.NotificationRepository;
import com.freshrescue.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ListingRepository listingRepository;

    public void notifyNearbyBuyersOfDeal(Batch batch) {
        Listing listing = listingRepository.findByBatchId(batch.getId());
        if (listing == null) {
            log.warn("No listing found for batch {} - skipping notifications", batch.getId());
            return;
        }

        Notification.NotificationType type = batch.getState() == Batch.BatchState.TIER_3
                ? Notification.NotificationType.URGENT
                : Notification.NotificationType.NEW_DISCOUNT;

        Instant cutoff24h = Instant.now().minus(24, ChronoUnit.HOURS);

        // 1. Fetch only buyer roles via repository query (no findAll())
        List<User> buyers = userRepository.findByRoleIn(List.of(User.Role.NGO, User.Role.CUSTOMER));

        List<User> candidates = buyers.stream()
                // Preference match
                .filter(u -> u.getPreferredCategories() == null
                        || u.getPreferredCategories().isEmpty()
                        || u.getPreferredCategories().contains(batch.getCategory()))
                // Location / Haversine distance check when both user and store have location
                .filter(u -> {
                    if (u.getLocation() != null && listing.getStoreLocation() != null) {
                        double userLat = u.getLocation().getY();
                        double userLon = u.getLocation().getX();
                        double storeLat = listing.getStoreLocation().getY();
                        double storeLon = listing.getStoreLocation().getX();
                        double distKm = haversineKm(userLat, userLon, storeLat, storeLon);
                        double maxRadius = (u.getNotificationRadiusKm() != null && u.getNotificationRadiusKm() > 0)
                                ? u.getNotificationRadiusKm()
                                : 10.0;
                        return distKm <= maxRadius;
                    }
                    return true;
                })
                // Skip users who already received the same listing/type notification in last 24h
                .filter(u -> !notificationRepository.existsByUserIdAndListingIdAndTypeAndCreatedAtAfter(
                        u.getId(), listing.getId(), type, cutoff24h))
                .toList();

        if (candidates.isEmpty()) {
            log.info("No matching buyer candidates found for batch {}", batch.getId());
            return;
        }

        String message = "%s now %d%% off nearby".formatted(
                batch.getProductName(),
                batch.getCurrentDiscountPercent() == null ? 0 : batch.getCurrentDiscountPercent());

        List<Notification> notifications = candidates.stream()
                .map(u -> Notification.builder()
                        .userId(u.getId())
                        .listingId(listing.getId())
                        .type(type)
                        .message(message)
                        .createdAt(Instant.now())
                        .build())
                .toList();

        notificationRepository.saveAll(notifications);
        log.info("Queued {} notification(s) for batch {}", notifications.size(), batch.getId());
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c;
    }
}
