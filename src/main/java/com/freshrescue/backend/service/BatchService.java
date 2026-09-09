package com.freshrescue.backend.service;

import com.freshrescue.backend.dto.MlPredictionResponse;
import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.repository.BatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BatchService {

    private final BatchRepository batchRepository;
    private final MlPredictionService mlPredictionService;
    private final BatchStateService batchStateService;
    private final ListingService listingService;
    private final NotificationService notificationService;

    public Batch createBatch(Batch batch) {
        batch.setState(Batch.BatchState.FRESH);
        // Guard against Lombok's @Builder.Default not applying when objects are created via
        // Jackson (as @RequestBody does) rather than the builder - imageUrls would otherwise
        // come back null and NPE the first time scanBatch() appends to it.
        if (batch.getImageUrls() == null) {
            batch.setImageUrls(new ArrayList<>());
        }
        return batchRepository.save(batch);
    }

    /**
     * Core flow: staff uploads a new photo of an existing batch.
     *   1) send image to the ML service (CNN freshness + OCR)
     *   2) run the result through the state machine
     *   3) persist the batch
     *   4) if the tier changed, sync (create/update/remove) the buyer-facing Listing
     *   5) if it crossed into TIER_2/TIER_3, trigger notifications
     *
     * This is the single method that ties the whole pipeline together - everything
     * else (controllers, scheduled jobs) just calls into this or BatchStateService directly.
     */
    public Batch scanBatch(String batchId, byte[] imageBytes, String filename) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + batchId));

        if (batch.getImageUrls() == null) {
            batch.setImageUrls(new ArrayList<>());
        }
        batch.getImageUrls().add(filename); // placeholder - real impl stores to disk/S3 and saves the URL

        Optional<MlPredictionResponse> predictionOpt = mlPredictionService.predict(imageBytes, filename);

        if (predictionOpt.isEmpty()) {
            // ML call failed - record the scan attempt (image, flag) but do NOT guess a
            // freshness score. Leave state/discount untouched until staff rescans or
            // manually reviews the batch.
            batch.setNeedsManualReview(true);
            return batchRepository.save(batch);
        }

        MlPredictionResponse prediction = predictionOpt.get();
        batch.setNeedsManualReview(false);

        if (prediction.ocrExtractedDate() != null) {
            batch.setOcrExtractedDate(prediction.ocrExtractedDate());
        }
        if (prediction.predictedDaysToExpiry() != null) {
            batch.setPredictedExpiryDate(Instant.now().plus(prediction.predictedDaysToExpiry(), ChronoUnit.DAYS));
        }

        boolean tierChanged = batchStateService.applyTransition(batch, prediction.freshnessScore());
        Batch saved = batchRepository.save(batch);

        if (tierChanged) {
            listingService.syncListingForBatch(saved);
            if (saved.getState() == Batch.BatchState.TIER_2 || saved.getState() == Batch.BatchState.TIER_3) {
                notificationService.notifyNearbyBuyersOfDeal(saved);
            }
        }

        return saved;
    }

    public Batch getBatch(String id) {
        return batchRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + id));
    }
}