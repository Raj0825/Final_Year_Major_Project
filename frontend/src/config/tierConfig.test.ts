import { describe, it, expect } from "vitest";
import { nextPriceDrop, TIER_CONFIG, TierConfig } from "./tierConfig";

describe("nextPriceDrop (pure function)", () => {
  const config: TierConfig = {
    tier1Max: 0.90, // FRESH (>= 0.90) -> TIER_1 (-20%)
    tier2Max: 0.85, // TIER_1 (>= 0.85) -> TIER_2 (-40%)
    tier3Max: 0.70, // TIER_2 (>= 0.70) -> TIER_3 (-50%)
    expiredMax: 0.65, // TIER_3 (>= 0.65) -> EXPIRED (< 0.65)
    tier1Percent: 20,
    tier2Percent: 40,
    tier3Percent: 50,
    decayPerHour: 0.01,
  };

  const fixedNow = new Date("2026-10-30T10:00:00Z").getTime();

  it("returns null when item has no freshness or expiry data", () => {
    expect(nextPriceDrop(null, config, fixedNow)).toBeNull();
    expect(nextPriceDrop({}, config, fixedNow)).toBeNull();
    expect(nextPriceDrop({ freshnessScore: null, expiryHoursLeft: null }, config, fixedNow)).toBeNull();
  });

  it("returns null when item printed expiry date is in the past", () => {
    expect(nextPriceDrop({ freshnessScore: 0.95, expiryDate: "2020-01-01" }, config, fixedNow)).toBeNull();
  });

  it("returns null when item is already at or past the last discount tier (TIER_3 or EXPIRED)", () => {
    // Score 0.68 is in TIER_3 (0.65 to 0.70), which is already at the last discount tier (-50%)
    expect(nextPriceDrop({ freshnessScore: 0.68 }, config, fixedNow)).toBeNull();
    // Score 0.50 is EXPIRED (< 0.65)
    expect(nextPriceDrop({ freshnessScore: 0.50 }, config, fixedNow)).toBeNull();
    // Inferred TIER_3 (<= 48h left)
    expect(nextPriceDrop({ expiryHoursLeft: 24 }, config, fixedNow)).toBeNull();
  });

  it("returns null when the drop would be more than 24 hours away", () => {
    // Current score: 1.15. Target FRESH threshold: 0.90. Diff: 0.25 / 0.01 = 25 hours > 24 hours.
    expect(nextPriceDrop({ freshnessScore: 1.15 }, config, fixedNow)).toBeNull();
  });

  it("calculates correct nextDiscountPercent and dropsAt for normal drops within 24 hours", () => {
    // 1) From FRESH (0.92) to TIER_1 (0.90, 20% discount):
    // diff = 0.92 - 0.90 = 0.02. hours = 0.02 / 0.01 = 2 hours.
    const drop1 = nextPriceDrop({ freshnessScore: 0.92 }, config, fixedNow);
    expect(drop1).not.toBeNull();
    expect(drop1?.nextDiscountPercent).toBe(20);
    expect(drop1?.dropsAt.getTime()).toBe(fixedNow + 2 * 3600 * 1000);

    // 2) From TIER_1 (0.88) to TIER_2 (0.85, 40% discount):
    // diff = 0.88 - 0.85 = 0.03. hours = 0.03 / 0.01 = 3 hours.
    const drop2 = nextPriceDrop({ freshnessScore: 0.88 }, config, fixedNow);
    expect(drop2).not.toBeNull();
    expect(drop2?.nextDiscountPercent).toBe(40);
    expect(drop2?.dropsAt.getTime()).toBe(fixedNow + 3 * 3600 * 1000);

    // 3) From TIER_2 (0.72) to TIER_3 (0.70, 50% discount):
    // diff = 0.72 - 0.70 = 0.02. hours = 0.02 / 0.01 = 2 hours.
    const drop3 = nextPriceDrop({ freshnessScore: 0.72 }, config, fixedNow);
    expect(drop3).not.toBeNull();
    expect(drop3?.nextDiscountPercent).toBe(50);
    expect(drop3?.dropsAt.getTime()).toBe(fixedNow + 2 * 3600 * 1000);
  });
});

