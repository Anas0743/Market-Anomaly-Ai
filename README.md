# Market Anomaly AI

Intelligent Price Validation Engine for detecting abnormal marketplace prices in Jordan-first, globally scalable marketplaces.

This repository contains a dependency-free Node.js MVP:

- Robust market range modeling from comparable listings.
- Arabic and English text normalization.
- Price anomaly classification: `normal`, `overpriced`, `underpriced`.
- Fraud-risk scoring for suspicious underpriced listings.
- HTTP API endpoints for product integration.
- CLI demo and unit tests.

## Requirements

- Node.js 20 or newer for local development.
- Docker Desktop for running the portable container version.

## Quick Start

```powershell
npm test
npm run demo
npm start
```

On Windows PowerShell, if script execution blocks `npm.ps1`, use `npm.cmd test`, `npm.cmd run demo`, and `npm.cmd start`.

CLI with custom data:

```powershell
npm.cmd run demo -- --history data/market-history.example.json --price 700
npm.cmd run demo -- --history data/market-history.example.json --listing examples/listing.example.json
```

## Run With Docker

Install Docker Desktop, then run the app from the project folder:

```powershell
docker compose up --build
```

Open `http://localhost:3000` in your browser.

To stop it:

```powershell
docker compose down
```

You can also build and run it without Compose:

```powershell
docker build -t market-anomaly-ai .
docker run --rm -p 3000:3000 market-anomaly-ai
```

## Use Real Market Data

The API can load your own historical marketplace listings from JSON or JSONL:

```powershell
$env:MARKET_DATA_FILE="C:\path\to\market-history.json"
npm.cmd start
```

With Docker:

```powershell
docker run --rm -p 3000:3000 `
  -e MARKET_DATA_FILE=/data/market-history.example.json `
  -v "${PWD}\data:/data:ro" `
  market-anomaly-ai
```

Market history can be either a JSON array or an object with a `listings` array. Each listing should include at least:

```json
{
  "listingId": "hist-001",
  "category": "phone",
  "brand": "Apple",
  "model": "iPhone 13",
  "condition": "used_excellent",
  "city": "Amman",
  "currency": "JOD",
  "price": 255,
  "title": "iPhone 13 128GB used excellent condition"
}
```

See [data/market-history.example.json](data/market-history.example.json) and [docs/REAL_WORLD_SETUP.md](docs/REAL_WORLD_SETUP.md).

## Production Configuration

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port. |
| `MARKET_DATA_FILE` | built-in demo data | JSON or JSONL history file. |
| `API_KEY` | none | Protects `/v1/*` endpoints when set. |
| `CORS_ORIGIN` | `*` | Allowed browser origin. |
| `MIN_COHORT_SIZE` | `6` | Minimum comparable listings before fallback. |
| `BATCH_LIMIT` | `100` | Maximum listings in one batch request. |
| `REQUEST_MAX_BYTES` | `1000000` | Maximum JSON request body size. |

## API

```http
POST /v1/validate
POST /v1/validate/batch
GET /v1/market-summary
GET /v1/categories
GET /v1/demo/iphone-13
GET /health
GET /ready
GET /openapi.json
```

Default local URL: `http://localhost:3000`.

If `API_KEY` is set, call protected endpoints with either:

```http
X-API-Key: your-secret-key
```

or:

```http
Authorization: Bearer your-secret-key
```

## Upload To GitHub

1. Create a new empty repository on GitHub.
2. In this project folder, run:

```powershell
git add .
git commit -m "Initial Dockerized Market Anomaly AI"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

Replace `YOUR-USERNAME` and `YOUR-REPO-NAME` with your GitHub username and repository name.

## Production Direction

The MVP uses deterministic robust statistics and risk rules so behavior is explainable. In production, the same interfaces should be backed by a feature store, category-specific regression models, streaming cohort statistics, and seller/image risk services.

Python/ML services can be introduced behind the same API contracts once enough training data exists.
