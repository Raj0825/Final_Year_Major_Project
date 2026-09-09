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
import java.util.List;

/**
 * Finds buyers (NGO + CUSTOMER users) near a store whose preferences match a batch's
 * category, and creates in-app Notification records for them.
 *
 * NOTE: this is intentionally simple for the MVP (loads all buyers, filters in memory).
 * Once user volume matters, replace the filtering with a proper geo + preference query
 * (similar to ListingService.findNearby) rather than scanning every user.
 */
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
            // syncListingForBatch() should always run before this is called (see BatchService,
            // DiscountEngineService), but guard anyway rather than send notifications that
            // deep-link to a listing that doesn't exist.
            log.warn("No listing found for batch {} - skipping notifications", batch.getId());
            return;
        }

        List<User> candidates = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.Role.NGO || u.getRole() == User.Role.CUSTOMER)
                .filter(u -> u.getPreferredCategories() == null
                        || u.getPreferredCategories().isEmpty()
                        || u.getPreferredCategories().contains(batch.getCategory()))
                .toList();

        String message = "%s now %d%% off nearby".formatted(
                batch.getProductName(), batch.getCurrentDiscountPercent() == null ? 0 : batch.getCurrentDiscountPercent()
        );

        Notification.NotificationType type = batch.getState() == Batch.BatchState.TIER_3
                ? Notification.NotificationType.URGENT
                : Notification.NotificationType.NEW_DISCOUNT;

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

        // TODO: wire up actual push delivery (FCM/APNs or web push) - this only
        // persists in-app notification records for now.
    }
}