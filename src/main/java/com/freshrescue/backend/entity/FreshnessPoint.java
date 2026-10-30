package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FreshnessPoint {

    private Instant timestamp;
    private double freshnessScore;
    private String tier;
    private FreshnessSource source;

    public enum FreshnessSource {
        SCAN, MANUAL, SCHEDULED
    }

    /**
     * Appends a new point to the given history list and maintains at most the latest 100 points.
     */
    public static void appendCapped(List<FreshnessPoint> history, FreshnessPoint point) {
        if (history == null || point == null) {
            return;
        }
        history.add(point);
        while (history.size() > 100) {
            history.remove(0);
        }
    }
}

