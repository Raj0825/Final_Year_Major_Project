# FreshRescue

> A food-waste reduction platform that connects grocery stores with customers and NGOs,
> selling near-expiry produce at automatic freshness-tiered discounts (20 / 40 / 60% off).

## Project Structure

`
freshrescue-backend/          <- project root (Spring Boot + React monorepo)
|
+-- src/                      <- Spring Boot Java source
|   +-- main/java/com/freshrescue/backend/
|       +-- controller/       <- REST API (Auth, Batch, Listing, Order)
|       +-- service/          <- Business logic + ML pipeline
|       +-- entity/           <- MongoDB documents
|       +-- dto/              <- Request / Response DTOs
|       +-- security/         <- JWT filter + Spring Security config
|       +-- config/           <- CORS, audit config
|
+-- frontend/                 <- React + TypeScript frontend (Vite)
|   +-- src/
|       +-- api/              <- Axios client + API functions
|       +-- components/       <- Reusable UI components
|       +-- context/          <- AuthContext, ToastContext
|       +-- pages/            <- All 8 pages
|       +-- styles/           <- Global CSS design system
|       +-- types/            <- TypeScript interfaces
|   +-- package.json
|   +-- vite.config.js
|
+-- pom.xml                   <- Maven (Spring Boot)
+-- package.json              <- Root scripts (run both servers)
+-- README.md
`

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3, Spring Security (JWT), MongoDB |
| Frontend | React 18, TypeScript, Vite, Axios, Leaflet, Recharts |
| ML Service | Python FastAPI (CNN freshness scoring + OCR) on port 8000 |
| Database | MongoDB (localhost:27017) |

## Getting Started

### Prerequisites
- Java 21+
- Maven (or use the included mvnw)
- Node.js 18+
- MongoDB running on localhost:27017
- Python ML service running on localhost:8000 (optional for scan feature)

### Run both servers together

`ash
# Install root dependencies once
npm install

# Install frontend dependencies once
npm run install:frontend

# Start both backend + frontend concurrently
npm run dev
`

This will start:
- **Backend** → http://localhost:8080
- **Frontend** → http://localhost:5173

### Run individually

`ash
# Backend only
.\mvnw spring-boot:run

# Frontend only
npm run frontend
`

### Build frontend for production

`ash
npm run build:frontend
# Output: frontend/dist/
`

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/signup | Public | Register new user |
| POST | /api/auth/login | Public | Login, get JWT |
| GET | /api/listings/nearby | Public | Listings near lat/lng |
| GET | /api/listings/urgent | Public | TIER_3 urgent listings |
| POST | /api/orders/reserve | NGO/CUSTOMER | Reserve a listing |
| POST | /api/orders/:id/fulfill | STORE | Fulfill via QR code |
| POST | /api/batches | STORE | Create a batch |
| GET | /api/batches/store/:id | STORE | Store's batch list |
| GET | /api/batches/:id | STORE | Single batch detail |
| POST | /api/batches/:id/scan | STORE | Upload image → ML scan |

## User Roles

| Role | Access |
|---|---|
| CUSTOMER | Browse listings, reserve food, view orders |
| NGO | Same as customer (marked as NGO buyer type) |
| STORE_STAFF | Create/scan batches, fulfill orders |
| STORE_MANAGER | Full store access (same as staff) |

## Freshness Tier System

| Tier | Freshness Score | Discount |
|---|---|---|
| FRESH | > 0.70 | 0% |
| TIER_1 | 0.50 – 0.70 | 20% |
| TIER_2 | 0.30 – 0.50 | 40% |
| TIER_3 (Urgent) | 0.10 – 0.30 | 60% |
| EXPIRED | < 0.10 | Removed from listings |