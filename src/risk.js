import { containsAny, suspiciousTerms, urgentTerms } from "./normalization.js";

export class FraudRiskModel {
  score(listing, priceRange, classification, deltaVsMedianPct) {
    const signals = [];
    const text = `${listing.title ?? ""} ${listing.description ?? ""}`;

    if (classification === "underpriced") {
      signals.push({
        code: "deep_discount",
        severity: Math.min(Math.abs(deltaVsMedianPct) / 70, 1),
        message: "Listing is materially below the expected market range."
      });
    }

    if (Number(listing.price) <= Math.max(5, priceRange.median * 0.05)) {
      signals.push({
        code: "placeholder_or_bait_price",
        severity: 0.95,
        message: "Price looks like a placeholder or bait price."
      });
    }

    const suspiciousMatches = containsAny(text, suspiciousTerms);
    if (suspiciousMatches.length) {
      signals.push({
        code: "suspicious_payment_or_contact_language",
        severity: Math.min(0.35 + 0.12 * suspiciousMatches.length, 0.85),
        message: "Description contains suspicious contact or payment language."
      });
    }

    const urgentMatches = containsAny(text, urgentTerms);
    if (urgentMatches.length && classification === "underpriced") {
      signals.push({
        code: "urgent_underpriced_sale",
        severity: 0.45,
        message: "Urgency language appears together with an unusually low price."
      });
    }

    if (!listing.sellerVerified) {
      signals.push({
        code: "unverified_seller",
        severity: 0.18,
        message: "Seller is not verified."
      });
    }

    if (listing.sellerAccountAgeDays !== null && listing.sellerAccountAgeDays < 7) {
      signals.push({
        code: "new_seller_account",
        severity: 0.35,
        message: "Seller account is very new."
      });
    }

    const duplicateImageCount = Number(listing.attributes?.duplicateImageCount ?? listing.attributes?.duplicate_image_count ?? 0);
    if (duplicateImageCount > 0) {
      signals.push({
        code: "duplicate_images",
        severity: Math.min(0.35 + 0.08 * duplicateImageCount, 0.9),
        message: "Images appear in other listings."
      });
    }

    const recentListingCount = Number(
      listing.attributes?.sellerListingCount24h ?? listing.attributes?.seller_listing_count_24h ?? 0
    );
    if (recentListingCount >= 12) {
      signals.push({
        code: "listing_burst",
        severity: 0.4,
        message: "Seller created many listings in a short time window."
      });
    }

    const score = combineSignals(signals);
    return {
      score,
      level: riskLevel(score),
      signals
    };
  }
}

function combineSignals(signals) {
  if (!signals.length) return 5;
  let residualSafeProbability = 1;
  for (const signal of signals) {
    residualSafeProbability *= 1 - Math.min(Math.max(signal.severity, 0), 1) * 0.72;
  }
  return Math.round(Math.min(100, (1 - residualSafeProbability) * 100));
}

function riskLevel(score) {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

