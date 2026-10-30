// tierConfig.ts - Shared tier thresholds, decay rate, and next price drop calculation

export interface TierConfig {
  tier1Max: number;
  tier2Max: number;
  tier3Max: number;
  expiredMax: number;
  tier1Percent: number;
  tier2Percent: number;
  tier3Percent: number;
  decayPerHour: number;
}

// Production defaults matching application.yml
export const TIER_CONFIG: TierConfig = {
  tier1Max: 0.70, // >= 0.70 is FRESH (0% discount)
  tier2Max: 0.50, // 0.50 to 0.70 is TIER_1 (20% discount)
  tier3Max: 0.30, // 0.30 to 0.50 is TIER_2 (40% discount)
  expiredMax: 0.10, // 0.10 to 0.30 is TIER_3 (60% discount), < 0.10 is EXPIRED
  tier1Percent: 20,
  tier2Percent: 40,
  tier3Percent: 60,
  decayPerHour: 0.01, // 0.01 decay per hour as used by DiscountEngineService
};

export interface NextPriceDropResult {
  nextDiscountPercent: number;
  dropsAt: Date;
}

/**
 * Pure function: calculates the next expected discount tier and when it will drop.
 *
 * Rules:
 * - Uses existing tier thresholds and decay rate (0.01/hr) from TIER_CONFIG.
 * - Returns null when:
 *   - the item has no freshness or expiry data,
 *   - is already at the last tier (TIER_3 or EXPIRED),
 *   - or the drop would be more than 24 hours away.
 */
export function nextPriceDrop(item?: {
  freshnessScore?: number | null;
  expiryHoursLeft?: number | null;
  discountPercent?: number | null;
  [key: string]: any;
} | null, config: TierConfig = TIER_CONFIG, nowMs: number = Date.now()): NextPriceDropResult | null {
  if (!item) return null;

  const hasScore = typeof item.freshnessScore === "number" && !isNaN(item.freshnessScore) && item.freshnessScore > 0;
  const hasExpiry = typeof item.expiryHoursLeft === "number" && !isNaN(item.expiryHoursLeft);

  if (!hasScore && !hasExpiry) {
    return null;
  }

  let currentScore: number;
  if (hasScore) {
    currentScore = item.freshnessScore!;
  } else {
    // Infer estimated score from hours until expiry based on DiscountEngineService alignment
    const hrs = item.expiryHoursLeft!;
    if (hrs <= 48) {
      currentScore = 0.25; // TIER_3
    } else if (hrs <= 96) {
      currentScore = 0.45; // TIER_2
    } else if (hrs <= 168) {
      currentScore = 0.65; // TIER_1
    } else {
      currentScore = 0.85; // FRESH
    }
  }

  // Already at or past the last discount tier (TIER_3 / 60% or EXPIRED)
  if (currentScore < config.tier3Max) {
    return null;
  }

  let nextDiscountPercent: number;
  let targetThreshold: number;

  if (currentScore >= config.tier1Max) {
    // Current: FRESH (0%). Next: TIER_1 (20%)
    nextDiscountPercent = config.tier1Percent;
    targetThreshold = config.tier1Max;
  } else if (currentScore >= config.tier2Max) {
    // Current: TIER_1 (20%). Next: TIER_2 (40%)
    nextDiscountPercent = config.tier2Percent;
    targetThreshold = config.tier2Max;
  } else {
    // Current: TIER_2 (40%). Next: TIER_3 (60%)
    nextDiscountPercent = config.tier3Percent;
    targetThreshold = config.tier3Max;
  }

  const scoreDiff = currentScore - targetThreshold;
  if (scoreDiff <= 0) {
    return null;
  }

  const hoursToDrop = scoreDiff / config.decayPerHour;

  // Drop must be positive and at most 24 hours away
  if (hoursToDrop <= 0 || hoursToDrop > 24) {
    return null;
  }

  const dropsAt = new Date(nowMs + Math.round(hoursToDrop * 3600000));
  return { nextDiscountPercent, dropsAt };
}

/**
 * Formats time remaining until drop (e.g. "2h 10m" or "45m")
 */
export function formatTimeRemaining(dropsAt: Date, nowMs: number = Date.now()): string {
  const diffMs = dropsAt.getTime() - nowMs;
  if (diffMs <= 0) return "soon";
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

