export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.code = "validation_error";
    this.statusCode = 422;
    this.details = details;
  }
}

export function validateListingInput(input, options = {}) {
  const label = options.label ?? "listing";
  const requireListingId = options.requireListingId ?? true;
  const errors = [];

  if (!isPlainObject(input)) {
    throw new ValidationError(`${label} must be a JSON object`, [
      { field: label, issue: "must_be_object" }
    ]);
  }

  const listing = { ...input };
  const listingId = listing.listingId ?? listing.listing_id;

  if (requireListingId && !hasText(listingId)) {
    errors.push({ field: `${label}.listingId`, issue: "required" });
  }
  if (hasText(listingId) && String(listingId).length > 128) {
    errors.push({ field: `${label}.listingId`, issue: "max_length_128" });
  }

  if (!hasText(listing.category)) {
    errors.push({ field: `${label}.category`, issue: "required" });
  }

  const price = Number(listing.price);
  if (!Number.isFinite(price) || price <= 0) {
    errors.push({ field: `${label}.price`, issue: "must_be_positive_number" });
  } else {
    listing.price = price;
  }

  validateOptionalText(errors, listing.currency, `${label}.currency`, 3, /^[A-Za-z]{3}$/);
  validateOptionalText(errors, listing.title, `${label}.title`, 500);
  validateOptionalText(errors, listing.description, `${label}.description`, 5_000);
  validateOptionalText(errors, listing.city, `${label}.city`, 120);
  validateOptionalText(errors, listing.brand, `${label}.brand`, 120);
  validateOptionalText(errors, listing.model, `${label}.model`, 120);

  normalizeOptionalNumber(listing, "storageGb", "storage_gb", errors, label, { min: 1, max: 8_192 });
  normalizeOptionalNumber(listing, "year", null, errors, label, { min: 1900, max: 2100 });
  normalizeOptionalNumber(listing, "mileageKm", "mileage_km", errors, label, { min: 0, max: 5_000_000 });
  normalizeOptionalNumber(listing, "areaSqm", "area_sqm", errors, label, { min: 1, max: 1_000_000 });
  normalizeOptionalNumber(listing, "sellerAccountAgeDays", "seller_account_age_days", errors, label, {
    min: 0,
    max: 100_000
  });

  if (listing.attributes !== undefined && !isPlainObject(listing.attributes)) {
    errors.push({ field: `${label}.attributes`, issue: "must_be_object" });
  }

  if (listing.imageHashes !== undefined && !Array.isArray(listing.imageHashes)) {
    errors.push({ field: `${label}.imageHashes`, issue: "must_be_array" });
  }
  if (listing.image_hashes !== undefined && !Array.isArray(listing.image_hashes)) {
    errors.push({ field: `${label}.image_hashes`, issue: "must_be_array" });
  }

  if (errors.length) {
    throw new ValidationError(`${label} is invalid`, errors);
  }

  return listing;
}

export function validateBatchInput(input, batchLimit) {
  const listings = Array.isArray(input) ? input : input?.listings;
  if (!Array.isArray(listings)) {
    throw new ValidationError("Body must be an array or an object with a listings array", [
      { field: "listings", issue: "must_be_array" }
    ]);
  }
  if (listings.length === 0) {
    throw new ValidationError("Batch must contain at least one listing", [
      { field: "listings", issue: "min_items_1" }
    ]);
  }
  if (listings.length > batchLimit) {
    throw new ValidationError(`Batch can contain at most ${batchLimit} listings`, [
      { field: "listings", issue: `max_items_${batchLimit}` }
    ]);
  }

  return listings.map((listing, index) => validateListingInput(listing, { label: `listings[${index}]` }));
}

function normalizeOptionalNumber(listing, camelName, snakeName, errors, label, range) {
  const sourceName = listing[camelName] !== undefined ? camelName : snakeName;
  if (!sourceName || listing[sourceName] === undefined || listing[sourceName] === null || listing[sourceName] === "") {
    return;
  }

  const value = Number(listing[sourceName]);
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    errors.push({ field: `${label}.${sourceName}`, issue: `must_be_number_${range.min}_to_${range.max}` });
    return;
  }

  listing[camelName] = value;
}

function validateOptionalText(errors, value, field, maxLength, pattern = null) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string" && typeof value !== "number") {
    errors.push({ field, issue: "must_be_text" });
    return;
  }
  const text = String(value);
  if (text.length > maxLength) {
    errors.push({ field, issue: `max_length_${maxLength}` });
  }
  if (pattern && !pattern.test(text)) {
    errors.push({ field, issue: "invalid_format" });
  }
}

function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
