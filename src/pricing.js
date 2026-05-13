import {
  canonicalKey,
  inferBrand,
  inferCondition,
  inferModel,
  inferStorageGb
} from "./normalization.js";

export function enrichListing(listing) {
  const text = `${listing.title ?? ""} ${listing.description ?? ""}`;
  return {
    ...listing,
    category: canonicalKey(listing.category),
    currency: (listing.currency ?? "JOD").toUpperCase(),
    city: listing.city ? canonicalKey(listing.city) : null,
    brand: inferBrand(text, listing.brand ?? null),
    model: inferModel(text, listing.model ?? null),
    storageGb: inferStorageGb(text, listing.storageGb ?? listing.storage_gb ?? null),
    condition: inferCondition(text, listing.condition ?? null),
    sellerVerified: Boolean(listing.sellerVerified ?? listing.seller_verified ?? false),
    sellerAccountAgeDays: listing.sellerAccountAgeDays ?? listing.seller_account_age_days ?? null,
    imageHashes: listing.imageHashes ?? listing.image_hashes ?? [],
    attributes: listing.attributes ?? {}
  };
}

export function quantile(values, q) {
  if (!values.length) throw new Error("quantile requires at least one value");
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.length === 1) return ordered[0];
  const position = (ordered.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, ordered.length - 1);
  const weight = position - lower;
  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
}

export function median(values) {
  return quantile(values, 0.5);
}

export function medianAbsoluteDeviation(values) {
  const med = median(values);
  return median(values.map((value) => Math.abs(value - med)));
}

export class PriceRangeEstimator {
  constructor(history, options = {}) {
    this.minCohortSize = options.minCohortSize ?? 6;
    this.history = history
      .filter((listing) => Number(listing.price) > 0)
      .map((listing) => enrichListing(listing));
  }

  estimate(targetListing) {
    const target = enrichListing(targetListing);
    const { comparables, fallbackLevel, cohortKey } = this.selectComparables(target);
    let prices = this.trimOutliers(comparables.map((listing) => Number(listing.price)));
    let finalFallbackLevel = fallbackLevel;
    let finalCohortKey = cohortKey;

    if (!prices.length) {
      prices = [Number(target.price)];
      finalFallbackLevel = 99;
      finalCohortKey = "self-only";
    }

    const q1 = quantile(prices, 0.25);
    const q3 = quantile(prices, 0.75);
    let low = quantile(prices, 0.1);
    let high = quantile(prices, 0.9);
    const med = median(prices);
    const mad = medianAbsoluteDeviation(prices);

    if (prices.length < this.minCohortSize) {
      const spread = Math.max(mad * 2.5, med * 0.18, 1);
      low = Math.max(1, med - spread);
      high = med + spread;
    }

    return {
      currency: target.currency,
      cohortKey: finalCohortKey,
      sampleSize: prices.length,
      fallbackLevel: finalFallbackLevel,
      median: round2(med),
      low: round2(low),
      high: round2(high),
      q1: round2(q1),
      q3: round2(q3),
      mad: round2(mad)
    };
  }

  selectComparables(target) {
    const targetId = listingId(target);
    const candidates = this.history.filter(
      (listing) =>
        listingId(listing) !== targetId &&
        listing.currency === target.currency &&
        listing.category === target.category
    );

    const tiers = [
      {
        level: 0,
        key: "exact-city-condition",
        match: (item) => this.sameProduct(item, target) && item.condition === target.condition && item.city === target.city
      },
      {
        level: 1,
        key: "exact-country-condition",
        match: (item) => this.sameProduct(item, target) && item.condition === target.condition
      },
      { level: 2, key: "exact-product", match: (item) => this.sameProduct(item, target) },
      { level: 3, key: "brand-model", match: (item) => item.brand === target.brand && item.model === target.model },
      { level: 4, key: "category-brand", match: (item) => item.brand === target.brand },
      { level: 5, key: "category", match: () => true }
    ];

    for (const tier of tiers) {
      const comparables = candidates.filter(tier.match);
      if (comparables.length >= this.minCohortSize) {
        return { comparables, fallbackLevel: tier.level, cohortKey: tier.key };
      }
    }

    if (candidates.length) {
      return { comparables: candidates, fallbackLevel: 5, cohortKey: "category" };
    }
    return { comparables: [], fallbackLevel: 99, cohortKey: "no-comparables" };
  }

  sameProduct(item, target) {
    if (item.brand !== target.brand || item.model !== target.model) return false;
    if (target.storageGb !== null && target.storageGb !== undefined && item.storageGb !== target.storageGb) return false;
    if (target.year !== null && target.year !== undefined && item.year !== target.year) return false;
    return true;
  }

  trimOutliers(prices) {
    if (prices.length < 8) return prices;
    const q1 = quantile(prices, 0.25);
    const q3 = quantile(prices, 0.75);
    const iqr = q3 - q1;
    if (iqr <= 0) return prices;
    const lower = Math.max(1, q1 - 3 * iqr);
    const upper = q3 + 3 * iqr;
    const trimmed = prices.filter((price) => price >= lower && price <= upper);
    return trimmed.length ? trimmed : prices;
  }
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

function listingId(listing) {
  return listing.listingId ?? listing.listing_id ?? null;
}
