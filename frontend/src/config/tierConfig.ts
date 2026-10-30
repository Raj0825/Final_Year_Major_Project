// tierConfig.ts - Shared tier thresholds, decay rate, dynamic configuration, and next price drop calculation

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

// Production defaults matching application.yml single source of truth
export let TIER_CONFIG: TierConfig = {
  tier1Max: 0.90, // >= 0.90 is FRESH (0% discount)
  tier2Max: 0.85, // 0.85 to 0.90 is TIER_1 (20% discount)
  tier3Max: 0.70, // 0.70 to 0.85 is TIER_2 (40% discount)
  expiredMax: 0.65, // 0.65 to 0.70 is TIER_3 (50% discount, urgent), < 0.65 is EXPIRED
  tier1Percent: 20,
  tier2Percent: 40,
  tier3Percent: 50,
  decayPerHour: 0.01, // Single source decay rate from application.yml
};

/**
 * Loads tier values dynamically from GET /api/config/tiers at startup.
 * Falls back safely to hardcoded defaults if network is unavailable.
 */
export async function loadTierConfig(): Promise<TierConfig> {
  try {
    const res = await fetch("/api/config/tiers");
    if (res.ok) {
      const data = await res.json();
      TIER_CONFIG = {
        tier1Max: typeof data.tier1Max === "number" ? data.tier1Max : TIER_CONFIG.tier1Max,
        tier2Max: typeof data.tier2Max === "number" ? data.tier2Max : TIER_CONFIG.tier2Max,
        tier3Max: typeof data.tier3Max === "number" ? data.tier3Max : TIER_CONFIG.tier3Max,
        expiredMax: typeof data.expiredMax === "number" ? data.expiredMax : TIER_CONFIG.expiredMax,
        tier1Percent: typeof data.tier1Percent === "number" ? data.tier1Percent : TIER_CONFIG.tier1Percent,
        tier2Percent: typeof data.tier2Percent === "number" ? data.tier2Percent : TIER_CONFIG.tier2Percent,
        tier3Percent: typeof data.tier3Percent === "number" ? data.tier3Percent : TIER_CONFIG.tier3Percent,
        decayPerHour: typeof data.decayPerHour === "number" ? data.decayPerHour : TIER_CONFIG.decayPerHour,
      };
    }
  } catch {
    // Keep hardcoded fallback
  }
  return TIER_CONFIG;
}

// Initialise tier configuration at browser startup
if (typeof window !== "undefined") {
  loadTierConfig().catch(() => {});
}

export function isPrintedDateInPast(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  try {
    const trimmed = expiryDate.trim();
    if (trimmed.length >= 10 && trimmed.charAt(4) === "-" && trimmed.charAt(7) === "-") {
      const d = new Date(trimmed.substring(0, 10));
      d.setHours(23, 59, 59, 999);
      return d.getTime() < Date.now();
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime() < Date.now();
    }
  } catch {}
  return false;
}

export interface NextPriceDropResult {
  nextDiscountPercent: number;
  dropsAt: Date;
}

/**
 * Pure function: calculates the next expected discount tier and when it will drop.
 *
 * Rules:
 * - Uses configured tier thresholds and decay rate from config/application.yml.
 * - Returns null when:
 *   - the item has no freshness or expiry data,
 *   - printed expiry date (expiryDate) is in the past,
 *   - is already at the last tier (TIER_3 or EXPIRED),
 *   - or the drop would be more than 24 hours away.
 */
export function nextPriceDrop(
  item?: {
    freshnessScore?: number | null;
    expiryHoursLeft?: number | null;
    discountPercent?: number | null;
    expiryDate?: string | null;
    [key: string]: any;
  } | null,
  config: TierConfig = TIER_CONFIG,
  nowMs: number = Date.now()
): NextPriceDropResult | null {
  if (!item) return null;

  // Safety rule: printed expiry in past means EXPIRED
  if (isPrintedDateInPast(item.expiryDate)) {
    return null;
  }

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
      currentScore = 0.68; // TIER_3
    } else if (hrs <= 96) {
      currentScore = 0.78; // TIER_2
    } else if (hrs <= 168) {
      currentScore = 0.88; // TIER_1
    } else {
      currentScore = 0.95; // FRESH
    }
  }

  // Already at or past the last discount tier (TIER_3 / 50% or EXPIRED)
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
    // Current: TIER_2 (40%). Next: TIER_3 (50%)
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
