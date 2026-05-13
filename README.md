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

## API

```http
POST /v1/validate
GET /v1/demo/iphone-13
GET /health
```

Default local URL: `http://localhost:3000`.

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
