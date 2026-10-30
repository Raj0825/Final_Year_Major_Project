package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.CloudInventoryItem;
import com.freshrescue.backend.entity.FreshnessPoint;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.CloudInventoryRepository;
import com.freshrescue.backend.repository.StoreRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A batch's freshness score should keep decaying even if staff don't
 * re-photograph it
 * every day - otherwise a batch scanned once on day 0 would sit at "FRESH"
 * forever.
 * This job runs periodically and nudges scores down based on
 * time-since-last-update,
 * as a stand-in for a "real" re-scan, then runs the result through the same
 * state
 * machine used for actual ML predictions.
 */
@Slf4j
@Service
public class DiscountEngineService {

    private final BatchRepository batchRepository;
    private final CloudInventoryRepository cloudInventoryRepo;
    private final StoreRepository storeRepository;
    private final BatchStateService batchStateService;
    private final ListingService listingService;
    private final NotificationService notificationService;
    private final WatchlistService watchlistService;
    private final double decayPerHour;

    public DiscountEngineService(
            BatchRepository batchRepository,
            CloudInventoryRepository cloudInventoryRepo,
            StoreRepository storeRepository,
            BatchStateService batchStateService,
            ListingService listingService,
            NotificationService notificationService,
            WatchlistService watchlistService,
            @Value("${app.pricing.decay-per-hour:${freshness.decay-per-hour:0.01}}") double decayPerHour) {
        this.batchRepository = batchRepository;
        this.cloudInventoryRepo = cloudInventoryRepo;
        this.storeRepository = storeRepository;
        this.batchStateService = batchStateService;
        this.listingService = listingService;
        this.notificationService = notificationService;
        this.watchlistService = watchlistService;
        this.decayPerHour = decayPerHour;
    }

    public double getDecayPerHour() {
        return decayPerHour;
    }

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
                estimatedScore = Math.max(0, batch.getFreshnessScore() - (hoursSinceUpdate * decayPerHour));
            }

            // Time-to-expiry alignment with new bands:
            // TIER_3: 0.65 <= score < 0.70; TIER_2: 0.70 <= score < 0.85; TIER_1: 0.85 <= score < 0.90
            if (batch.getPredictedExpiryDate() != null) {
                long hoursUntilExpiry = Duration.between(Instant.now(), batch.getPredictedExpiryDate()).toHours();
                if (hoursUntilExpiry <= 0) {
                    estimatedScore = 0.50; // Past expiry -> transitions to EXPIRED
                } else if (hoursUntilExpiry <= 48) { // <= 2 days left
                    estimatedScore = Math.min(estimatedScore, 0.68); // transitions to TIER_3 (urgent -50%)
                } else if (hoursUntilExpiry <= 96) { // <= 4 days left
                    estimatedScore = Math.min(estimatedScore, 0.78); // transitions to TIER_2 (-40%)
                } else if (hoursUntilExpiry <= 168) { // <= 7 days left
                    estimatedScore = Math.min(estimatedScore, 0.88); // transitions to TIER_1 (-20%)
                }
            }

            boolean changed = batchStateService.applyTransition(batch, estimatedScore);
            if (changed) {
                if (batch.getFreshnessHistory() == null) {
                    batch.setFreshnessHistory(new ArrayList<>());
                }
                FreshnessPoint.appendCapped(batch.getFreshnessHistory(), FreshnessPoint.builder()
                        .timestamp(Instant.now())
                        .freshnessScore(estimatedScore)
                        .tier(batch.getState().name())
                        .source(FreshnessPoint.FreshnessSource.SCHEDULED)
                        .build());

                batchRepository.save(batch);
                listingService.syncListingForBatch(batch);
                if (batch.getState() == Batch.BatchState.TIER_2 || batch.getState() == Batch.BatchState.TIER_3) {
                    notificationService.notifyNearbyBuyersOfDeal(batch);
                }
            }
        }
    }

    /**
     * Scheduled decay job for cloud inventory items to maintain truthful price-drop counts.
     */
    @Scheduled(fixedRate = 3_600_000)
    public void reEvaluateCloudInventory() {
        List<CloudInventoryItem> items = cloudInventoryRepo.findAll();
        for (CloudInventoryItem item : items) {
            if (item.getAvailable() <= 0 || "Discarded".equalsIgnoreCase(item.getStatus())) {
                continue;
            }

            double currentScore = item.getFreshnessScore() > 0 ? item.getFreshnessScore() : 0.95;
            double estimatedScore = currentScore;

            Instant lastUpdate = item.getCreatedAt() != null ? item.getCreatedAt() : Instant.now();
            if (item.getFreshnessHistory() != null && !item.getFreshnessHistory().isEmpty()) {
                lastUpdate = item.getFreshnessHistory().get(item.getFreshnessHistory().size() - 1).getTimestamp();
            }
            double hours = Duration.between(lastUpdate, Instant.now()).toHours();
            if (hours >= 1) {
                estimatedScore = Math.max(0.0, currentScore - (hours * decayPerHour));
            }

            // Check printed expiry date
            boolean pastExpiry = batchStateService.isExpiredDate(item.getExpiryDate());
            if (pastExpiry) {
                estimatedScore = Math.min(estimatedScore, batchStateService.getExpiredMax() - 0.05);
            }

            Batch.BatchState state = pastExpiry ? Batch.BatchState.EXPIRED : batchStateService.resolveState(estimatedScore);
            Integer newDiscount = batchStateService.resolveDiscountPercent(state);
            int discountPct = newDiscount != null ? newDiscount : 0;

            boolean scoreChanged = Math.abs(currentScore - estimatedScore) > 0.001;
            boolean discountChanged = item.getDiscountPercent() != discountPct;

            if (scoreChanged || discountChanged || pastExpiry) {
                item.setFreshnessScore(estimatedScore);
                item.setDiscountPercent(discountPct);
                if (item.getOriginalPrice() > 0) {
                    item.setCurrentPrice(Math.round(item.getOriginalPrice() * (1.0 - discountPct / 100.0)));
                }
                if (state == Batch.BatchState.EXPIRED) {
                    item.setStatus("Discard recommended");
                } else if (state == Batch.BatchState.TIER_3) {
                    item.setStatus("Expiring soon");
                }

                if (item.getFreshnessHistory() == null) {
                    item.setFreshnessHistory(new ArrayList<>());
                }
                FreshnessPoint.appendCapped(item.getFreshnessHistory(), FreshnessPoint.builder()
                        .timestamp(Instant.now())
                        .freshnessScore(estimatedScore)
                        .tier(state.name())
                        .source(FreshnessPoint.FreshnessSource.SCHEDULED)
                        .build());

                cloudInventoryRepo.save(item);

                if (discountChanged && discountPct > 0) {
                    try {
                        GeoJsonPoint storeLoc = null;
                        if (item.getStoreId() != null) {
                            Store s = storeRepository.findById(item.getStoreId()).orElse(null);
                            if (s != null) storeLoc = s.getLocation();
                        }
                        watchlistService.checkItemAgainstWatches(
                                item.getId(),
                                item.getName(),
                                item.getCategory(),
                                item.getCurrentPrice(),
                                item.getDiscountPercent(),
                                item.getStore() != null ? item.getStore() : "Store",
                                storeLoc
                        );
                    } catch (Exception e) {
                        log.warn("Error checking watchlist for decayed item: {}", e.getMessage());
                    }
                }
            }
        }
    }
}
