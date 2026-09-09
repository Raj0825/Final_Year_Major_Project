package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Implements the freshness-score -> discount-tier state machine described in the
 * project plan:
 *
 *   FRESH -> TIER_1 (20%) -> TIER_2 (40%) -> TIER_3 (60%, urgent) -> EXPIRED
 *
 * This is called from two places:
 *   1) BatchService, right after a new freshnessScore comes back from MlPredictionService
 *   2) DiscountEngineService's scheduled job, which re-evaluates scores that may have
 *      decayed further even without a new scan
 *
 * Kept as its own class (rather than inline in BatchService) because the tier
 * thresholds and the transition logic are exactly the kind of thing that changes
 * during development/tuning - isolating it makes that safe to edit without touching
 * persistence or API code.
 */
@Slf4j
@Service
public class BatchStateService {

    private final double tier1Max;
    private final double tier2Max;
    private final double tier3Max;
    private final double expiredMax;

    private final int tier1Percent;
    private final int tier2Percent;
    private final int tier3Percent;

    public BatchStateService(
            @Value("${freshness.tiers.tier1-max}") double tier1Max,
            @Value("${freshness.tiers.tier2-max}") double tier2Max,
            @Value("${freshness.tiers.tier3-max}") double tier3Max,
            @Value("${freshness.tiers.expired-max}") double expiredMax,
            @Value("${freshness.discount.tier1-percent}") int tier1Percent,
            @Value("${freshness.discount.tier2-percent}") int tier2Percent,
            @Value("${freshness.discount.tier3-percent}") int tier3Percent
    ) {
        this.tier1Max = tier1Max;
        this.tier2Max = tier2Max;
        this.tier3Max = tier3Max;
        this.expiredMax = expiredMax;
        this.tier1Percent = tier1Percent;
        this.tier2Percent = tier2Percent;
        this.tier3Percent = tier3Percent;
    }

    /**
     * Given a batch's latest freshness score, returns what state it should be in.
     * Pure function - does not mutate or save the batch. Caller decides what to do
     * with the result (e.g. skip the update entirely if state hasn't changed).
     */
    public Batch.BatchState resolveState(double freshnessScore) {
        if (freshnessScore < expiredMax) return Batch.BatchState.EXPIRED;
        if (freshnessScore < tier3Max) return Batch.BatchState.TIER_3;
        if (freshnessScore < tier2Max) return Batch.BatchState.TIER_2;
        if (freshnessScore < tier1Max) return Batch.BatchState.TIER_1;
        return Batch.BatchState.FRESH;
    }

    public Integer resolveDiscountPercent(Batch.BatchState state) {
        return switch (state) {
            case FRESH -> null;
            case TIER_1 -> tier1Percent;
            case TIER_2 -> tier2Percent;
            case TIER_3 -> tier3Percent;
            case EXPIRED -> null;
        };
    }

    /**
     * Applies the new state + discount to the batch in place. Returns true if the
     * state actually changed (so callers know whether to fire notifications / update
     * the Listing / log a transition event).
     */
    public boolean applyTransition(Batch batch, double newFreshnessScore) {
        Batch.BatchState oldState = batch.getState();
        Batch.BatchState newState = resolveState(newFreshnessScore);

        batch.setFreshnessScore(newFreshnessScore);
        batch.setState(newState);
        batch.setCurrentDiscountPercent(resolveDiscountPercent(newState));

        boolean changed = oldState != newState;
        if (changed) {
            log.info("Batch {} transitioned {} -> {} (score={})",
                    batch.getId(), oldState, newState, newFreshnessScore);
        }
        return changed;
    }
}
