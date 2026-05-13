export function getConfig(env = process.env) {
  return {
    port: readInt(env.PORT, 3000, { min: 1, max: 65535, name: "PORT" }),
    marketDataFile: emptyToNull(env.MARKET_DATA_FILE),
    apiKey: emptyToNull(env.API_KEY),
    corsOrigin: env.CORS_ORIGIN || "*",
    requestMaxBytes: readInt(env.REQUEST_MAX_BYTES, 1_000_000, {
      min: 1_024,
      max: 10_000_000,
      name: "REQUEST_MAX_BYTES"
    }),
    minCohortSize: readInt(env.MIN_COHORT_SIZE, 6, { min: 2, max: 100, name: "MIN_COHORT_SIZE" }),
    batchLimit: readInt(env.BATCH_LIMIT, 100, { min: 1, max: 1_000, name: "BATCH_LIMIT" })
  };
}

function emptyToNull(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return String(value);
}

function readInt(value, fallback, options) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    throw new Error(`${options.name} must be an integer from ${options.min} to ${options.max}`);
  }
  return parsed;
}
