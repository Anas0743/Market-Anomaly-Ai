# Real-World Setup

This project is now ready for small production pilots: load your own marketplace history, protect the scoring API with an API key, run it with Docker, and integrate via single or batch validation endpoints.

## 1. Prepare Historical Listings

The pricing engine needs comparable historical listings from your marketplace. Use sold listings when possible. If you only have active listings, remove spam, duplicates, and obvious fake prices before using them as market history.

Recommended minimum per category/product cohort:

- 30 or more listings for reliable price ranges.
- 10 or more listings for early pilots.
- Fewer than 6 listings works, but confidence will drop and fallback ranges become wider.

Supported file formats:

- `.json`: a JSON array or an object with a `listings` array.
- `.jsonl`: one listing object per line.

Required fields:

```json
{
  "listingId": "hist-001",
  "category": "phone",
  "price": 255
}
```

Strongly recommended fields:

```json
{
  "listingId": "hist-001",
  "category": "phone",
  "brand": "Apple",
  "model": "iPhone 13",
  "condition": "used_excellent",
  "city": "Amman",
  "currency": "JOD",
  "storageGb": 128,
  "year": 2021,
  "mileageKm": 90000,
  "areaSqm": 120,
  "title": "iPhone 13 128GB used excellent condition",
  "description": "Original battery, no repairs.",
  "sellerVerified": true,
  "sellerAccountAgeDays": 180,
  "attributes": {
    "duplicateImageCount": 0,
    "sellerListingCount24h": 2
  }
}
```

## 2. Run Locally With Your Data

PowerShell:

```powershell
$env:MARKET_DATA_FILE="C:\path\to\market-history.json"
$env:API_KEY="change-this-secret"
npm.cmd start
```

Check readiness:

```powershell
curl.exe http://localhost:3000/ready
```

Score a listing:

```powershell
curl.exe -X POST http://localhost:3000/v1/validate `
  -H "Content-Type: application/json" `
  -H "X-API-Key: change-this-secret" `
  -d "{\"listingId\":\"live-001\",\"category\":\"phone\",\"title\":\"iPhone 13 128GB used excellent\",\"city\":\"Amman\",\"price\":700}"
```

## 3. Run With Docker

Build once:

```powershell
docker build -t market-anomaly-ai .
```

Run with a mounted data folder:

```powershell
docker run --rm -p 3000:3000 `
  -e MARKET_DATA_FILE=/data/market-history.json `
  -e API_KEY=change-this-secret `
  -v "${PWD}\data:/data:ro" `
  market-anomaly-ai
```

Or use Compose:

```powershell
docker compose up --build
```

The included Compose file uses `data/market-history.example.json`. Replace it with your real exported data when you are ready.

## 4. Real Integration Flow

Use this service before publishing a marketplace listing:

1. Your app sends the listing to `POST /v1/validate`.
2. If `classification` is `normal`, publish normally.
3. If `overpriced`, show a seller suggestion with the returned `normalRange`.
4. If `underpriced` and `risk.level` is `medium` or `high`, send it to manual review or require seller verification.
5. Store the returned `modelVersion`, `cohort`, `reasons`, and `risk.signals` for audit/debugging.

For imports, moderation queues, or nightly checks, use `POST /v1/validate/batch`.

## 5. Privacy And Safety

- Do not store raw phone numbers, emails, national IDs, or private chat content in the market-history file.
- Hash seller IDs before adding them to model features.
- Keep buyer-facing reasons separate from internal fraud signals.
- Review high-risk decisions before taking irreversible action.
- Rebuild market history regularly so prices stay fresh.
