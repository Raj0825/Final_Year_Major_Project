package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.repository.BatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * A batch's freshness score should keep decaying even if staff don't re-photograph it
 * every day - otherwise a batch scanned once on day 0 would sit at "FRESH" forever.
 * This job runs periodically and nudges scores down based on time-since-last-update,
 * as a stand-in for a "real" re-scan, then runs the result through the same state
 * machine used for actual ML predictions.
 *
 * This is a simplification for the MVP - the more accurate approach (auto re-scan via
 * a shelf camera feed, or requiring periodic staff re-scans) can replace the decay
 * estimate later without changing anything downstream (BatchStateService, ListingService
 * consume the resulting score/state the same way either way).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DiscountEngineService {

    private final BatchRepository batchRepository;
    private final BatchStateService batchStateService;
    private final ListingService listingService;
    private final NotificationService notificationService;

    // very rough placeholder decay rate - real tuning should come from the CNN
    // team's data on how fast each fruit type actually degrades
    private static final double DECAY_PER_HOUR = 0.01;

    @Scheduled(fixedRate = 3_600_000) // hourly
    public void reEvaluateActiveBatches() {
        List<Batch> active = batchRepository.findByStateIn(
                List.of(Batch.BatchState.FRESH, Batch.BatchState.TIER_1, Batch.BatchState.TIER_2, Batch.BatchState.TIER_3)
        );

        for (Batch batch : active) {
            if (batch.getFreshnessScore() == null && batch.getPredictedExpiryDate() == null) continue;

            double estimatedScore = batch.getFreshnessScore() != null ? batch.getFreshnessScore() : 1.0;
            if (batch.getFreshnessScore() != null && batch.getUpdatedAt() != null) {
                double hoursSinceUpdate = Duration.between(batch.getUpdatedAt(), Instant.now()).toHours();
                estimatedScore = Math.max(0, batch.getFreshnessScore() - (hoursSinceUpdate * DECAY_PER_HOUR));
            }

            // Time-to-expiry alignment: smoothly degrade tier as the predicted expiry date approaches
            if (batch.getPredictedExpiryDate() != null) {
                long hoursUntilExpiry = Duration.between(Instant.now(), batch.getPredictedExpiryDate()).toHours();
                if (hoursUntilExpiry <= 0) {
                    estimatedScore = 0.05; // Past expiry -> transitions to EXPIRED
                } else if (hoursUntilExpiry <= 48) { // <= 2 days left
                    estimatedScore = Math.min(estimatedScore, 0.25); // transitions to TIER_3 (urgent -60%)
                } else if (hoursUntilExpiry <= 96) { // <= 4 days left
                    estimatedScore = Math.min(estimatedScore, 0.45); // transitions to TIER_2 (-40%)
                } else if (hoursUntilExpiry <= 168) { // <= 7 days left
                    estimatedScore = Math.min(estimatedScore, 0.65); // transitions to TIER_1 (-20%)
                }
            }

            boolean changed = batchStateService.applyTransition(batch, estimatedScore);
            if (changed) {
                batchRepository.save(batch);
                listingService.syncListingForBatch(batch);
                if (batch.getState() == Batch.BatchState.TIER_2 || batch.getState() == Batch.BatchState.TIER_3) {
                    notificationService.notifyNearbyBuyersOfDeal(batch);
                }
            }
        }
    }
}