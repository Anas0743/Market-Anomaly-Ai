import { enrichListing, PriceRangeEstimator } from "./pricing.js";
import { FraudRiskModel } from "./risk.js";

export const MODEL_VERSION = "robust-file-backed-v0.2";

const thresholds = {
  phone: { under: -22, over: 25 },
  phones: { under: -22, over: 25 },
  car: { under: -18, over: 22 },
  cars: { under: -18, over: 22 },
  real_estate: { under: -20, over: 25 },
  property: { under: -20, over: 25 },
  electronics: { under: -25, over: 30 },
  default: { under: -25, over: 30 }
};

export class AnomalyEngine {
  constructor(history, options = {}) {
    this.modelVersion = options.modelVersion ?? MODEL_VERSION;
    this.estimator = new PriceRangeEstimator(history, options);
    this.riskModel = new FraudRiskModel();
  }

  validate(listing) {
    const enriched = enrichListing(listing);
    const priceRange = this.estimator.estimate(enriched);
    const deltaVsMedianPct = deltaPct(Number(enriched.price), priceRange.median);
    const classification = this.classify(enriched, priceRange.low, priceRange.high, deltaVsMedianPct);
    const confidence = this.confidence(enriched, priceRange, classification);
    const risk = this.riskModel.score(enriched, priceRange, classification, deltaVsMedianPct);

    return {
      listingId: enriched.listingId ?? enriched.listing_id,
      classification,
      confidence,
      price: round2(Number(enriched.price)),
      currency: enriched.currency,
      predictedMedian: priceRange.median,
      normalRange: {
        low: priceRange.low,
        high: priceRange.high
      },
      deltaVsMedianPct: Math.round(deltaVsMedianPct * 10) / 10,
      risk: {
        score: risk.score,
        level: risk.level,
        signals: risk.signals
      },
      reasons: reasons(enriched, classification, priceRange, deltaVsMedianPct),
      cohort: priceRange,
      modelVersion: this.modelVersion
    };
  }

  marketSummary() {
    return {
      modelVersion: this.modelVersion,
      ...this.estimator.summary()
    };
  }

  classify(listing, normalLow, normalHigh, deltaVsMedianPct) {
    const categoryThresholds = thresholds[listing.category] ?? thresholds.default;
    if (Number(listing.price) < normalLow && deltaVsMedianPct <= categoryThresholds.under) return "underpriced";
    if (Number(listing.price) > normalHigh && deltaVsMedianPct >= categoryThresholds.over) return "overpriced";
    return "normal";
  }

  confidence(listing, priceRange, classification) {
    let score = 38;
    score += Math.min(priceRange.sampleSize * 3, 30);
    score += Math.max(0, 14 - priceRange.fallbackLevel * 3);

    const fields = [
      listing.brand,
      listing.model,
      listing.condition,
      listing.city,
      listing.storageGb,
      listing.year,
      listing.mileageKm ?? listing.mileage_km,
      listing.areaSqm ?? listing.area_sqm
    ];
    score += Math.min(fields.filter((field) => field !== null && field !== undefined).length * 3, 18);

    const relativeWidth = (priceRange.high - priceRange.low) / Math.max(priceRange.median, 1);
    if (relativeWidth > 0.7) score -= 14;
    else if (relativeWidth > 0.45) score -= 7;

    if (classification !== "normal") score += 8;
    if (priceRange.fallbackLevel >= 5) score -= 10;
    if (priceRange.sampleSize < 6) score -= 15;

    return Math.max(15, Math.min(98, Math.round(score)));
  }
}

function deltaPct(price, medianPrice) {
  if (medianPrice <= 0) return 0;
  return ((price - medianPrice) / medianPrice) * 100;
}

function reasons(listing, classification, priceRange, deltaVsMedianPct) {
  const direction = deltaVsMedianPct >= 0 ? "above" : "below";
  const headline =
    classification === "normal"
      ? "Price falls within the modeled normal market range."
      : classification === "overpriced"
        ? "Price is above the modeled normal market range."
        : "Price is below the modeled normal market range.";

  return [
    headline,
    `Listing price is ${Math.abs(deltaVsMedianPct).toFixed(1)}% ${direction} the comparable-market median of ${priceRange.median.toFixed(2)} ${listing.currency}.`,
    `Expected range is ${priceRange.low.toFixed(2)}-${priceRange.high.toFixed(2)} ${listing.currency} from cohort '${priceRange.cohortKey}' using ${priceRange.sampleSize} comparable listings.`
  ];
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
