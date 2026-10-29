package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

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

    @Test
    @DisplayName("resolveState: should load real thresholds from application.yml (0.70 / 0.50 / 0.30 / 0.10) and check each boundary")
    void testRealApplicationYmlThresholds() {
        Yaml yaml = new Yaml();
        InputStream is = getClass().getResourceAsStream("/application.yml");
        assertNotNull(is, "application.yml must be present on the classpath");
        Map<String, Object> root = yaml.load(is);

        @SuppressWarnings("unchecked")
        Map<String, Object> freshness = (Map<String, Object>) root.get("freshness");
        @SuppressWarnings("unchecked")
        Map<String, Object> tiers = (Map<String, Object>) freshness.get("tiers");
        @SuppressWarnings("unchecked")
        Map<String, Object> discount = (Map<String, Object>) freshness.get("discount");

        double tier1Max = ((Number) tiers.get("tier1-max")).doubleValue();
        double tier2Max = ((Number) tiers.get("tier2-max")).doubleValue();
        double tier3Max = ((Number) tiers.get("tier3-max")).doubleValue();
        double expiredMax = ((Number) tiers.get("expired-max")).doubleValue();

        int tier1Discount = ((Number) discount.get("tier1-percent")).intValue();
        int tier2Discount = ((Number) discount.get("tier2-percent")).intValue();
        int tier3Discount = ((Number) discount.get("tier3-percent")).intValue();

        // Verify values loaded directly from application.yml
        assertEquals(0.70, tier1Max, 0.0001);
        assertEquals(0.50, tier2Max, 0.0001);
        assertEquals(0.30, tier3Max, 0.0001);
        assertEquals(0.10, expiredMax, 0.0001);

        BatchStateService realConfigService = new BatchStateService(
                tier1Max, tier2Max, tier3Max, expiredMax,
                tier1Discount, tier2Discount, tier3Discount
        );

        // Boundary: < 0.10 -> EXPIRED
        assertEquals(Batch.BatchState.EXPIRED, realConfigService.resolveState(0.0));
        assertEquals(Batch.BatchState.EXPIRED, realConfigService.resolveState(0.099));

        // Boundary: [0.10, 0.30) -> TIER_3
        assertEquals(Batch.BatchState.TIER_3, realConfigService.resolveState(0.10));
        assertEquals(Batch.BatchState.TIER_3, realConfigService.resolveState(0.20));
        assertEquals(Batch.BatchState.TIER_3, realConfigService.resolveState(0.299));

        // Boundary: [0.30, 0.50) -> TIER_2
        assertEquals(Batch.BatchState.TIER_2, realConfigService.resolveState(0.30));
        assertEquals(Batch.BatchState.TIER_2, realConfigService.resolveState(0.40));
        assertEquals(Batch.BatchState.TIER_2, realConfigService.resolveState(0.499));

        // Boundary: [0.50, 0.70) -> TIER_1
        assertEquals(Batch.BatchState.TIER_1, realConfigService.resolveState(0.50));
        assertEquals(Batch.BatchState.TIER_1, realConfigService.resolveState(0.60));
        assertEquals(Batch.BatchState.TIER_1, realConfigService.resolveState(0.699));

        // Boundary: >= 0.70 -> FRESH
        assertEquals(Batch.BatchState.FRESH, realConfigService.resolveState(0.70));
        assertEquals(Batch.BatchState.FRESH, realConfigService.resolveState(0.85));
        assertEquals(Batch.BatchState.FRESH, realConfigService.resolveState(1.0));
    }
}
