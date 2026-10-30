package com.freshrescue.backend.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FreshnessPointHistoryTest {

    @Test
    @DisplayName("History cap: keeps only the latest 100 points when more than 100 points are appended")
    void testHistoryCappedAt100Points() {
        List<FreshnessPoint> history = new ArrayList<>();

        // Append 115 points with sequential freshness scores
        for (int i = 1; i <= 115; i++) {
            FreshnessPoint point = FreshnessPoint.builder()
                    .timestamp(Instant.now().plusSeconds(i * 60))
                    .freshnessScore(i / 115.0)
                    .tier("TIER_1")
                    .source(FreshnessPoint.FreshnessSource.SCAN)
                    .build();
            FreshnessPoint.appendCapped(history, point);
        }

        // Must cap at 100
        assertEquals(100, history.size(), "History should contain exactly 100 items");

        // The oldest 15 points (i = 1..15) must be discarded.
        // First point in history should be i = 16
        double expectedFirstScore = 16.0 / 115.0;
        assertEquals(expectedFirstScore, history.get(0).getFreshnessScore(), 0.0001,
                "Oldest items beyond 100 should be purged in FIFO order");

        // Last point in history should be i = 115
        double expectedLastScore = 115.0 / 115.0;
        assertEquals(expectedLastScore, history.get(99).getFreshnessScore(), 0.0001,
                "Latest item should be preserved at the end of the history");
    }

    @Test
    @DisplayName("History cap: handles null list or point gracefully")
    void testHandlesNullGracefully() {
        assertDoesNotThrow(() -> FreshnessPoint.appendCapped(null, FreshnessPoint.builder().build()));
        List<FreshnessPoint> list = new ArrayList<>();
        assertDoesNotThrow(() -> FreshnessPoint.appendCapped(list, null));
        assertEquals(0, list.size());
    }
}

