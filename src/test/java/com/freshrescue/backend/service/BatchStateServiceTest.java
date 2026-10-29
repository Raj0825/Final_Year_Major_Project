package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BatchStateServiceTest {

    private BatchStateService batchStateService;

    @BeforeEach
    void setUp() {
        // tier1Max = 0.8, tier2Max = 0.6, tier3Max = 0.4, expiredMax = 0.2
        batchStateService = new BatchStateService(0.8, 0.6, 0.4, 0.2, 20, 40, 60);
    }

    @Test
    @DisplayName("resolveState: should resolve EXPIRED when score < expiredMax")
    void testResolveExpired() {
        assertEquals(Batch.BatchState.EXPIRED, batchStateService.resolveState(0.19));
        assertEquals(Batch.BatchState.EXPIRED, batchStateService.resolveState(0.0));
    }

    @Test
    @DisplayName("resolveState: should resolve TIER_3 when expiredMax <= score < tier3Max")
    void testResolveTier3() {
        assertEquals(Batch.BatchState.TIER_3, batchStateService.resolveState(0.20));
        assertEquals(Batch.BatchState.TIER_3, batchStateService.resolveState(0.39));
    }

    @Test
    @DisplayName("resolveState: should resolve TIER_2 when tier3Max <= score < tier2Max")
    void testResolveTier2() {
        assertEquals(Batch.BatchState.TIER_2, batchStateService.resolveState(0.40));
        assertEquals(Batch.BatchState.TIER_2, batchStateService.resolveState(0.59));
    }

    @Test
    @DisplayName("resolveState: should resolve TIER_1 when tier2Max <= score < tier1Max")
    void testResolveTier1() {
        assertEquals(Batch.BatchState.TIER_1, batchStateService.resolveState(0.60));
        assertEquals(Batch.BatchState.TIER_1, batchStateService.resolveState(0.79));
    }

    @Test
    @DisplayName("resolveState: should resolve FRESH when score >= tier1Max")
    void testResolveFresh() {
        assertEquals(Batch.BatchState.FRESH, batchStateService.resolveState(0.80));
        assertEquals(Batch.BatchState.FRESH, batchStateService.resolveState(0.95));
        assertEquals(Batch.BatchState.FRESH, batchStateService.resolveState(1.0));
    }
}

