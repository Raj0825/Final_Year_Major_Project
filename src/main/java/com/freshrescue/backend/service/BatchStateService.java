package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;


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

    public double getTier1Max() { return tier1Max; }
    public double getTier2Max() { return tier2Max; }
    public double getTier3Max() { return tier3Max; }
    public double getExpiredMax() { return expiredMax; }
    public int getTier1Percent() { return tier1Percent; }
    public int getTier2Percent() { return tier2Percent; }
    public int getTier3Percent() { return tier3Percent; }


    public boolean isExpiredDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return false;
        String trimmed = dateStr.trim();
        try {
            if (trimmed.length() >= 10 && trimmed.charAt(4) == '-' && trimmed.charAt(7) == '-') {
                java.time.LocalDate date = java.time.LocalDate.parse(trimmed.substring(0, 10));
                return date.isBefore(java.time.LocalDate.now());
            }
            if (trimmed.length() >= 10 && (trimmed.charAt(2) == '/' || trimmed.charAt(2) == '-')) {
                java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern(
                        trimmed.charAt(2) == '/' ? "dd/MM/yyyy" : "dd-MM-yyyy");
                java.time.LocalDate date = java.time.LocalDate.parse(trimmed.substring(0, 10), fmt);
                return date.isBefore(java.time.LocalDate.now());
            }
            java.time.Instant inst = java.time.Instant.parse(trimmed);
            return inst.isBefore(java.time.Instant.now());
        } catch (Exception ignored) {
            return false;
        }
    }


    public Batch.BatchState resolveState(double freshnessScore) {
        if (freshnessScore < expiredMax) return Batch.BatchState.EXPIRED;
        if (freshnessScore < tier3Max) return Batch.BatchState.TIER_3;
        if (freshnessScore < tier2Max) return Batch.BatchState.TIER_2;
        if (freshnessScore < tier1Max) return Batch.BatchState.TIER_1;
        return Batch.BatchState.FRESH;
    }

    public Batch.BatchState resolveState(double freshnessScore, String printedExpiryDate) {
        if (isExpiredDate(printedExpiryDate)) {
            return Batch.BatchState.EXPIRED;
        }
        return resolveState(freshnessScore);
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


    public boolean applyTransition(Batch batch, double newFreshnessScore) {
        Batch.BatchState oldState = batch.getState();
        boolean pastPrintedExpiry = isExpiredDate(batch.getOcrExtractedDate())
                || (batch.getPredictedExpiryDate() != null && batch.getPredictedExpiryDate().isBefore(java.time.Instant.now()));

        Batch.BatchState newState = pastPrintedExpiry
                ? Batch.BatchState.EXPIRED
                : resolveState(newFreshnessScore);

        batch.setFreshnessScore(newFreshnessScore);
        batch.setState(newState);
        batch.setCurrentDiscountPercent(resolveDiscountPercent(newState));

        boolean changed = oldState != newState;
        if (changed) {
            log.info("Batch {} transitioned {} -> {} (score={}, pastPrintedExpiry={})",
                    batch.getId(), oldState, newState, newFreshnessScore, pastPrintedExpiry);
        }
        return changed;
    }
}
