package com.freshrescue.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class NextPriceDropTest {

    // Same thresholds & decay rate as in application.yml and tierConfig.ts
    private static final double TIER_1_MAX = 0.70;
    private static final double TIER_2_MAX = 0.50;
    private static final double TIER_3_MAX = 0.30;
    private static final double EXPIRED_MAX = 0.10;
    private static final double DECAY_PER_HOUR = 0.01;

    static class PriceDropResult {
        int nextDiscountPercent;
        Instant dropsAt;

        PriceDropResult(int nextDiscountPercent, Instant dropsAt) {
            this.nextDiscountPercent = nextDiscountPercent;
            this.dropsAt = dropsAt;
        }
    }

    /**
     * Java replica of pure nextPriceDrop function for verifying contract and invariants
     */
    static PriceDropResult calculateNextPriceDrop(Double freshnessScore, Double expiryHoursLeft, Instant now) {
        if (freshnessScore == null && expiryHoursLeft == null) {
            return null;
        }

        double currentScore;
        if (freshnessScore != null && freshnessScore > 0) {
            currentScore = freshnessScore;
        } else {
            double hrs = expiryHoursLeft;
            if (hrs <= 48) {
                currentScore = 0.25;
            } else if (hrs <= 96) {
                currentScore = 0.45;
            } else if (hrs <= 168) {
                currentScore = 0.65;
            } else {
                currentScore = 0.85;
            }
        }

        // Already at last tier (TIER_3 / 60% or EXPIRED)
        if (currentScore < TIER_3_MAX) {
            return null;
        }

        int nextDiscountPercent;
        double targetThreshold;

        if (currentScore >= TIER_1_MAX) {
            nextDiscountPercent = 20;
            targetThreshold = TIER_1_MAX;
        } else if (currentScore >= TIER_2_MAX) {
            nextDiscountPercent = 40;
            targetThreshold = TIER_2_MAX;
        } else {
            nextDiscountPercent = 60;
            targetThreshold = TIER_3_MAX;
        }

        double scoreDiff = currentScore - targetThreshold;
        if (scoreDiff <= 0) {
            return null;
        }

        double hoursToDrop = scoreDiff / DECAY_PER_HOUR;
        if (hoursToDrop <= 0 || hoursToDrop > 24.0) {
            return null;
        }

        Instant dropsAt = now.plus((long) (hoursToDrop * 3600), ChronoUnit.SECONDS);
        return new PriceDropResult(nextDiscountPercent, dropsAt);
    }

    @Test
    @DisplayName("nextPriceDrop: returns null when no freshness or expiry data")
    void testNoDataReturnsNull() {
        assertNull(calculateNextPriceDrop(null, null, Instant.now()));
    }

    @Test
    @DisplayName("nextPriceDrop: returns null when item is already at the last tier (TIER_3 or EXPIRED)")
    void testLastTierReturnsNull() {
        // Score 0.25 is in TIER_3 (< 0.30)
        assertNull(calculateNextPriceDrop(0.25, 40.0, Instant.now()));
        // Score 0.05 is EXPIRED (< 0.10)
        assertNull(calculateNextPriceDrop(0.05, 5.0, Instant.now()));
    }

    @Test
    @DisplayName("nextPriceDrop: returns null when drop would be more than 24 hours away")
    void testDropGreaterThan24HoursReturnsNull() {
        // Score 0.98 -> diff to 0.70 is 0.28 -> 0.28 / 0.01 = 28 hours > 24 hours
        assertNull(calculateNextPriceDrop(0.98, 200.0, Instant.now()));
    }

    @Test
    @DisplayName("nextPriceDrop: returns correct discount percent and drop time when within 24 hours")
    void testNormalDropWithin24Hours() {
        Instant now = Instant.parse("2026-10-30T10:00:00Z");

        // Score 0.75 -> diff to 0.70 is 0.05 -> 5 hours
        PriceDropResult result = calculateNextPriceDrop(0.75, 120.0, now);
        assertNotNull(result);
        assertEquals(20, result.nextDiscountPercent);
        assertEquals(now.plus(5, ChronoUnit.HOURS), result.dropsAt);

        // Score 0.52 -> diff to 0.50 is 0.02 -> 2 hours -> next discount is 40%
        PriceDropResult result2 = calculateNextPriceDrop(0.52, 90.0, now);
        assertNotNull(result2);
        assertEquals(40, result2.nextDiscountPercent);
        assertEquals(now.plus(2, ChronoUnit.HOURS), result2.dropsAt);
    }
}

