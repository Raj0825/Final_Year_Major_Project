# FreshRescue

> A food-waste reduction platform that connects supermarkets with customers and NGOs. Near-expiry produce is scored for freshness by a CNN model and sold at automatic tiered discounts (20 / 40 / 60 % off) before it is thrown away.

**Live demo (frontend):** https://final-year-major-project-ashen.vercel.app
**Author:** [@Raj0825](https://github.com/Raj0825)


---

## Table of contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Run it on your machine](#run-it-on-your-machine)
7. [Configuration (environment variables)](#configuration-environment-variables)
8. [Try the app (walkthrough)](#try-the-app-walkthrough)
9. [User roles](#user-roles)
10. [Freshness tiers and background jobs](#freshness-tiers-and-background-jobs)
11. [API overview](#api-overview)
12. [ML service](#ml-service)
13. [Build and deploy](#build-and-deploy)
14. [Troubleshooting](#troubleshooting)
15. [Known limitations](#known-limitations)

---

## What it does

Supermarkets throw away food that is still good because it is close to its expiry date. FreshRescue turns that waste into sales:

- **Stores** add stock batches, photograph the produce, and the ML service scores its freshness. As the score drops, the batch automatically moves through discount tiers and is shown to buyers.
- **NGOs and customers** browse discounted food near them, reserve it, and receive a QR code for pickup.
- **Store staff** scan the QR code (or type the order code) at pickup to complete the sale.
- Reservations expire automatically after a hold time (15 minutes by default) and the stock returns to the feed.

## Architecture

```mermaid
flowchart LR
    FE["React frontend\n(Vite, port 5173)"] -->|REST + JWT| BE["Spring Boot backend\n(port 8080)"]
    BE --> DB[("MongoDB")]
    BE -->|"POST /predict (image)"| ML["Python FastAPI\nCNN service (port 8000)"]
```

Three separate programs run together: the **frontend**, the **backend**, and the **ML service** (optional for the scan feature). All three need MongoDB for the backend.

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Java 17, Spring Boot 3.3.4, Spring Security (JWT), Spring Data MongoDB, Spring Validation, WebClient |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Axios, wouter, Leaflet (maps), Recharts, `qrcode.react` |
| ML service | Python, FastAPI, TensorFlow / Keras (3-class fruit freshness model) |
| Database | MongoDB |
| Deployment | Docker (backend), Vercel (frontend) |

## Project structure

```
freshrescue-backend/                 <- repository root
|
+-- pom.xml                          Maven build (Spring Boot backend)
+-- Dockerfile                       Backend container image
+-- package.json                     Root helper scripts
|
+-- src/main/java/com/freshrescue/backend/
|   +-- controller/                  REST endpoints (Auth, Batch, Listing, Order, Store,
|   |                                User, Notification, Image, CloudSync)
|   +-- service/                     Business logic: batches, listings, orders, discount
|   |                                tiers, notifications, ML client, image storage
|   +-- entity/                      MongoDB documents (User, Store, Batch, Listing,
|   |                                Order, Review, Notification, Cloud*)
|   +-- repository/                  Spring Data repositories
|   +-- dto/                         Request / response objects
|   +-- security/                    JWT filter and token service
|   +-- config/                      Security, CORS, Mongo, WebClient, error handling
|
+-- src/main/resources/application.yml   Backend configuration
|
+-- frontend/                        React + TypeScript app (Vite)
|   +-- src/App.tsx                  Main application (login, dashboards, map, orders)
|   +-- src/api/                     Axios client and API functions
|   +-- src/data/mockStore.ts        Client-side store/inventory state and cloud sync
|   +-- src/components/              Modals, map, dashboards, UI primitives
|   +-- vite.config.js               Dev server (port 5173) and /api proxy
|
+-- ml_service/                      Python FastAPI freshness service
    +-- app.py                       /predict and /health endpoints
    +-- test_model.py                CLI script to evaluate test images
    +-- requirements.txt
    +-- fruit_freshness_model.keras  Trained Keras 3 model (3 classes: fresh, rotten, semifresh)
    +-- run_ml.bat                   Windows shortcut to start the service
```

## Prerequisites

| Layer | Technology |
|---|---|
| Backend | Java 17+, Spring Boot 3, Spring Security (JWT), MongoDB |
| Frontend | React 18, TypeScript, Vite, Axios, Leaflet, Recharts |
| ML Service | Python FastAPI (CNN freshness scoring + OCR) on port 8000 |
| Database | MongoDB (localhost:27017) |

Check what you have:

### Prerequisites
- Java 17+ (JDK 17)
- Maven 3.8+ (or Maven wrapper)
- Node.js 18+
- MongoDB running on localhost:27017
- Python ML service running on localhost:8000 (optional for scan feature)

## Run it on your machine

Open **three terminals**, one per service. Start them in this order.

### 0. Get the code

```bash
git clone https://github.com/Raj0825/Final_Year_Major_Project.git
cd Final_Year_Major_Project
```

### 1. Start MongoDB

Either:

- **Local MongoDB:** install MongoDB Community Server and start it. The default address `mongodb://localhost:27017` is used automatically, with a database named `freshrescue`.
- **MongoDB Atlas (cloud):** create a free cluster, add your IP to the access list, and copy the connection string. You will pass it as `MONGODB_URI` in step 3.

### 2. Start the ML service (optional, needed only for photo scanning)

```bash
cd ml_service

# create and activate a virtual environment
python -m venv venv
venv\Scripts\activate            # Windows (cmd or PowerShell)
# source venv/bin/activate       # macOS / Linux

pip install -r requirements.txt
python app.py
```

The service listens on **http://localhost:8000**. The first start takes a while because TensorFlow loads the model. Check it works: open http://localhost:8000/health. On Windows you can also double-click `ml_service/run_ml.bat` after the packages are installed.

If you skip this step the app still works, but a photo scan will mark the batch for manual review instead of giving a freshness score.

### 3. Start the backend

The backend **will not start** without a `JWT_SECRET`. It signs login tokens, so use a long random value (at least 32 characters) and never commit it.

Generate one:

```bash
# macOS / Linux / Git Bash / WSL
openssl rand -base64 48
```

```powershell
# Windows PowerShell
$b = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Set it, then run the backend from the **repository root**:

```powershell
# Windows PowerShell
$env:JWT_SECRET = "paste-your-long-random-value-here"
# only if you use Atlas or a non-default MongoDB:
# $env:MONGODB_URI = "mongodb+srv://user:password@cluster.mongodb.net/freshrescue"
mvn spring-boot:run
```

```cmd
:: Windows cmd
set JWT_SECRET=paste-your-long-random-value-here
mvn spring-boot:run
```

```bash
# macOS / Linux
export JWT_SECRET="paste-your-long-random-value-here"
mvn spring-boot:run
```

Running from IntelliJ instead: open the project, edit the run configuration of `BackendApplication`, and add `JWT_SECRET=...` under *Environment variables*.

The backend runs on **http://localhost:8080**. It creates the database collections and indexes on first start.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. During development Vite forwards every `/api` request to the backend on port 8080, so no extra frontend configuration is needed.

### Optional: one command for backend and frontend

The root `package.json` has a script that starts both (`npm run dev`), but it calls `mvnw` and the Maven wrapper is not committed yet. Create it once and the script works:

```bash
mvn wrapper:wrapper          # run in the repository root, creates mvnw / mvnw.cmd
npm install                  # installs "concurrently" in the root
npm run install:frontend
npm run dev                  # backend + frontend together
```

Set `JWT_SECRET` in the same terminal first. The ML service still needs its own terminal.

## Configuration (environment variables)

### Backend

`ash
# Backend only
mvn spring-boot:run
# or
npm run backend

Other settings live in `src/main/resources/application.yml`: file upload limit (10 MB), JWT lifetime (24 h), discount tier thresholds, discount percentages and the reservation hold time.

### Frontend

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_URL` | Only for production builds | `/api` | Full URL of the backend API **including `/api`**, for example `https://your-backend.example.com/api` |

For local development leave it unset. Create `frontend/.env.production` or set it in your hosting dashboard for deployments.

## Try the app (walkthrough)

1. Open http://localhost:5173 and **register as a Supermarket** (store manager). Give the store a name and address.
2. In the store dashboard, **add stock** (product, category, quantity, unit, price).
3. Open the item and **scan a photo** of the produce (needs the ML service). The freshness score sets the batch's tier and discount.
4. In a second browser (or a private window), **register as a Customer or NGO**. Browse the discounted food, open the map view, and **reserve** an item.
5. The reservation gives a **QR code / order code** and a 15-minute hold.
6. Back in the store account, open the pending pickups and **scan or enter the code** to complete the sale.

If you do nothing, the hold expires after 15 minutes and the stock returns to the feed.

## User roles

| Role | What they can do |
|------|------------------|
| `CUSTOMER` | Browse listings, reserve food, view their orders, review stores they picked up from |
| `NGO` | Same as a customer (marked as an NGO buyer) |
| `STORE_MANAGER` | Manage their store: create batches, scan photos, change tiers, see orders, fulfil pickups, view analytics |
| `STORE_STAFF` | Same store operations as the manager. Staff accounts cannot be created through public signup. |

Public signup is available for customers, NGOs and store managers. A store manager's store is created automatically at registration.

## Freshness tiers and background jobs

| State | Freshness score | Discount |
|-------|-----------------|----------|
| FRESH | 0.90 and above | 0 % |
| TIER_1 | 0.85 to 0.90 | 20 % |
| TIER_2 | 0.70 to 0.85 | 40 % |
| TIER_3 (urgent) | 0.65 to 0.70 | 50 % |
| EXPIRED | below 0.65 | not sellable (removed from feed) |

Background jobs run inside the backend:

- **Reservation expiry:** every minute, releases reservations whose hold time has passed and returns the stock to the listing.
- **Discount engine:** every hour, re-evaluates batches and lowers the freshness score over time (a stand-in for fresh scans), moving batches to the next tier when thresholds are crossed. Buyers whose preferences match are notified.

## API overview

All endpoints are under `/api`. Protected endpoints need the header `Authorization: Bearer <token>` (the token is returned by login and signup).

| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| POST | `/auth/signup` | Public | Register a customer, NGO or store manager |
| POST | `/auth/login` | Public | Log in and get a JWT |
| GET | `/listings` | Public | All active listings |
| GET | `/listings/nearby?lat=&lng=&radiusKm=` | Public | Listings near a point |
| GET | `/listings/urgent` | Public | Urgent (TIER_3) listings |
| GET | `/images/{id}` | Public | A stored batch photo |
| POST | `/orders/reserve` | NGO, Customer | Reserve a listing |
| GET | `/orders/my-orders` | NGO, Customer | The buyer's orders |
| GET | `/orders/store` | Store roles | Orders of the caller's store |
| GET | `/orders/store/pending` | Store roles | Reservations waiting for pickup |
| POST | `/orders/fulfill-code` | Store roles | Complete a pickup with a QR / order code |
| POST | `/orders/{id}/fulfill` | Store roles | Complete a pickup by order id |
| POST | `/batches` | Store roles | Create a stock batch |
| GET | `/batches/my-batches` | Store roles | The caller's batches |
| GET | `/batches/{id}` | Store roles | One batch |
| PATCH | `/batches/{id}/tier` | Store roles | Change tier or discount |
| POST | `/batches/{id}/scan` | Store roles | Upload a photo for the ML freshness scan (multipart, field `image`) |
| GET | `/stores/my-store` | Store roles | The caller's store |
| GET | `/stores/{id}/analytics` | Store roles | Sales and waste analytics for a store |
| POST | `/stores/{id}/reviews` | NGO, Customer | Review a store |
| GET | `/notifications` | Logged in | The user's notifications |
| GET/PATCH | `/users/me` | Logged in | View or update the profile |
| various | `/cloud-sync/**` | Logged in | Inventory, store and order sync used by the web app |

Errors come back as JSON with `status`, `error` and `message` fields.

## ML service

A small FastAPI app in `ml_service/` that scores freshness from a photo.

- `GET /health` (also `/`): service status and the model's classes.
- `POST /predict`: multipart upload with the field name `image`. Returns a freshness score and a predicted number of days to expiry, plus confidence information.
- The model is a Keras 3 CNN (`fruit_freshness_model.keras`) trained on 3 freshness classes: `fresh`, `rotten`, and `semifresh`.
- Expiry-date OCR is not implemented yet, so the extracted date is always empty.

The backend calls it at `ML_SERVICE_URL`. If the service is down or the call fails, the batch is flagged for manual review instead of guessing a score.

## Build and deploy

### Backend

```bash
mvn clean package -DskipTests
java -jar target/backend-0.1.0.jar        # needs JWT_SECRET set
```

With Docker:

```bash
docker build -t freshrescue-backend .
docker run -p 8080:8080 \
  -e JWT_SECRET="your-long-random-value" \
  -e MONGODB_URI="mongodb+srv://..." \
  -e ML_SERVICE_URL="https://your-ml-service" \
  -e CORS_ALLOWED_ORIGINS="https://your-frontend.example.com" \
  freshrescue-backend
```

The Docker image contains only the Spring Boot backend. Host the ML service separately.

### Frontend

```bash
cd frontend
npm run build          # output in frontend/dist
```

On **Vercel**: import the repository, set the root directory to `frontend`, and add the environment variable `VITE_API_URL=https://your-backend.example.com/api`. `vercel.json` already rewrites all routes to `index.html`.

### Before going live

- Use a **new random `JWT_SECRET`** for production and keep it only in the hosting dashboard.
- Add your exact frontend URL to `CORS_ALLOWED_ORIGINS`.
- Never commit `.env` files or secrets.

## Troubleshooting

| Problem | Likely cause and fix |
|---------|----------------------|
| Backend stops with `Could not resolve placeholder 'JWT_SECRET'` | Set the `JWT_SECRET` environment variable in the same terminal (or IntelliJ run config) before starting. |
| `MongoTimeoutException` or connection refused | MongoDB is not running, or `MONGODB_URI` is wrong. For Atlas, allow your IP in the cluster's network access list. |
| Backend fails on startup with a duplicate key / index error on `users` | Two user documents have the same email once capital letters are ignored. Emails are stored in lowercase and have a unique index. Remove or merge the duplicates, then restart. |
| Login with a correct password says invalid, but the account is old | Older accounts may have capital letters in the stored email. Lowercase the email in the database. |
| `mvnw` is not recognized | The Maven wrapper is not committed. Use `mvn spring-boot:run`, or create the wrapper with `mvn wrapper:wrapper`. |
| Frontend loads but every request fails (404 or HTML instead of JSON) in production | `VITE_API_URL` is not set on the host. It must be the backend URL ending with `/api`. |
| Browser shows a CORS error | Add the frontend URL to `CORS_ALLOWED_ORIGINS` on the backend. |
| Photo scan says "needs manual review" | The ML service is not running or `ML_SERVICE_URL` is wrong. Open `/health` on the ML service. |
| Photo upload fails with "exceeds the maximum allowed limit" | Images are limited to 10 MB. Use a smaller photo. |
| `pip install` fails on TensorFlow | Use Python 3.10 or 3.11 in a fresh virtual environment. |
| Port already in use (8080, 5173 or 8000) | Stop the other program, or change the port (`PORT` for the backend, `vite.config.js` for the frontend). |
| First ML request is slow | TensorFlow loads the model on startup. Wait for the log line saying the model is loaded. |

## Known limitations

- Expiry-date OCR is not implemented; freshness comes from the CNN model only, and it is trained on 3 produce classes (`fresh`, `rotten`, `semifresh`).
- The web app keeps part of its inventory and store state in the browser and syncs it through the `/cloud-sync` endpoints, alongside the main REST endpoints. Moving everything onto the REST endpoints is planned.
- Store staff accounts cannot be created through public signup, and there is no screen yet for a manager to add staff.
- There are no automated tests yet.
- The hourly discount engine lowers scores on a fixed schedule as a stand-in for real re-scans.

## Contributing

1. Fork the repository and create a branch: `git checkout -b feature/my-change`
2. Make your changes and check that the backend compiles (`mvn clean compile`) and the frontend builds (`npm run build` in `frontend/`).
3. Open a pull request describing what changed.