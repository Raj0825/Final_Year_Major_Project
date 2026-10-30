package com.freshrescue.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @Value("${freshness.tiers.tier1-max:0.90}")
    private double tier1Max;

    @Value("${freshness.tiers.tier2-max:0.85}")
    private double tier2Max;

    @Value("${freshness.tiers.tier3-max:0.70}")
    private double tier3Max;

    @Value("${freshness.tiers.expired-max:0.65}")
    private double expiredMax;

    @Value("${freshness.discount.tier1-percent:20}")
    private int tier1Percent;

    @Value("${freshness.discount.tier2-percent:40}")
    private int tier2Percent;

    @Value("${freshness.discount.tier3-percent:50}")
    private int tier3Percent;

    @Value("${app.pricing.decay-per-hour:${freshness.decay-per-hour:0.01}}")
    private double decayPerHour;

    @GetMapping("/tiers")
    public Map<String, Object> getTierConfig() {
        return Map.of(
                "tier1Max", tier1Max,
                "tier2Max", tier2Max,
                "tier3Max", tier3Max,
                "expiredMax", expiredMax,
                "tier1Percent", tier1Percent,
                "tier2Percent", tier2Percent,
                "tier3Percent", tier3Percent,
                "decayPerHour", decayPerHour
        );
    }
}

