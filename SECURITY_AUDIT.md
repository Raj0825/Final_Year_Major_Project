# FreshRescue Application Security Audit Report

**Repository:** `freshrescue-backend` (Spring Boot 3.3.4 + Java 17, MongoDB, React/TypeScript/Vite frontend, Python FastAPI ML service)  
**Audit Scope:** Read-only static code and configuration review across all 10 requested security and privacy domains. No source code was modified.  
**Verification Note:** Static findings below cite exact verified file paths and line numbers from the repository. Runtime/environment properties that cannot be determined from source code alone (e.g., production `JWT_SECRET` overrides, hosting dashboard secrets, MongoDB Atlas TLS/IP rules, and live CVE resolution without network scanners) are explicitly marked **unverified**.

---

## Findings Summary Table (Sorted by Severity)

| ID | Severity | Area | File:line | Issue | Exploit scenario | Recommended fix |
|---|---|---|---|---|---|---|
| **SEC-01** | **Critical** | Auth & Privilege Escalation | `src/main/java/com/freshrescue/backend/service/AuthService.java:38-75`, `src/main/java/com/freshrescue/backend/dto/AuthDtos.java:15` | Public `/api/auth/signup` blocks `STORE_STAFF` (`L38-40`) but allows any unauthenticated caller to self-assign `role: STORE_MANAGER`, auto-creating a `Store` and issuing a `STORE_MANAGER` JWT. | Any anonymous user registers with `role=STORE_MANAGER` and immediately gains privileged store API access (`/api/batches/**`, `/api/batches/{id}/scan`, `/api/cloud-sync/inventory`, `/api/cloud-sync/stores`, `/api/orders/store/**`), enabling fraudulent storefront/listing creation and abuse of store-only endpoints. | Restrict public signup to `CUSTOMER` and `NGO` (or require admin/verification approval before activating `STORE_MANAGER`). Ignore/reject privileged roles in `AuthService.signup`. |
| **SEC-02** | **Critical** | Secrets & Repo Hygiene | `src/main/resources/application.yml:23` (introduced in git commit `8d22f39`) | Hardcoded 256-bit default HMAC JWT secret (`404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970`) is committed in `application.yml` as the fallback for `${JWT_SECRET:...}`. Production override in hosting dashboards is **unverified**. | If deployed without `JWT_SECRET` overridden, anyone with repository access can sign valid HS256 JWTs for arbitrary `sub` (`userId`), `role`, and `storeId` claims, completely bypassing authentication and store isolation. | Remove the hardcoded default so startup fails fast if `JWT_SECRET` is unset (`secret: ${JWT_SECRET}`), and rotate the signing key in all environments. |
| **SEC-03** | **Critical** | Authorization & Order Logic | `src/main/java/com/freshrescue/backend/controller/CloudSyncController.java:321-370`, `src/main/java/com/freshrescue/backend/entity/CloudOrder.java:15-35` | `POST /api/cloud-sync/orders` lacks `@PreAuthorize`, trusts client-supplied `status`, `priceAtOrder`, `quantity`, and `storeId`, and updates any matching existing `CloudOrder` by `qrCode` (`L345-354`) or predictable `id` (`"ord-" + System.currentTimeMillis()`, `L356-367`) without verifying caller ownership or store authorization. | Any authenticated customer/NGO can enumerate timestamp-based order IDs or reuse a `qrCode` to overwrite `status`, `notes`, or `pickupTime` on another user's or store's `CloudOrder`, or insert a forged `CloudOrder` pre-marked `FULFILLED` at an arbitrary price. | Restrict `POST /api/cloud-sync/orders` to verified buyers creating `RESERVED` orders from authoritative server inventory prices; reject client-supplied `status` transitions and verify ownership/store authorization before updating any existing order; use random UUIDs for IDs and `@Indexed(unique = true)` on `qrCode`. |
| **SEC-04** | **Critical** | Authorization & Inventory Logic | `src/main/java/com/freshrescue/backend/controller/CloudSyncController.java:222-242` | `POST /api/cloud-sync/inventory/{id}/release` permits `NGO` and `CUSTOMER` roles to increment `available` stock on any `CloudInventoryItem` by any positive finite `quantity` without checking store ownership or a linked cancelled/expired order. | Any logged-in `CUSTOMER` or `NGO` can call `/api/cloud-sync/inventory/{id}/release?quantity=999999` on any store's inventory item, arbitrarily inflating stock counts and breaking inventory integrity. | Restrict `/inventory/{id}/release` to authorized store staff of that item's store (or tie stock release strictly to atomic server-side order cancellation/expiry transitions). |
| **SEC-05** | **High** | Config & Deployment (CORS) | `src/main/java/com/freshrescue/backend/config/SecurityConfig.java:42-55` | `corsConfigurationSource()` hardcodes wildcard origin patterns `"https://*.vercel.app"` and `"https://*.onrender.com"` together with `config.setAllowCredentials(true)` (`L55`). | Any third party can host a malicious web app on `<attacker>.vercel.app` or `<attacker>.onrender.com` and send credentialed cross-origin requests from a victim's browser to read private data or trigger state changes if cookies/credentials or permissive auth are used. | Remove wildcard platform domains (`*.vercel.app`, `*.onrender.com`) and allow only exact origins configured via `CORS_ALLOWED_ORIGINS`. |
| **SEC-06** | **High** | Config & Deployment (ML Service) | `ml_service/app.py:42-48, 130-178, 394-397`, `frontend/src/App.tsx:1958-1971` | FastAPI `/predict` and `/health` have **no authentication**, read entire uploads into RAM unbounded (`contents = await image.read()`, `L156`), rely only on spoofable `image.content_type` (`L145`) with no PIL decompression-bomb cap, configure `allow_origins=["*"]` with `allow_credentials=True` (`L44-45`), and return `str(e)` on HTTP 500 (`L396`). Frontend `App.tsx:1958-1971` calls `VITE_ML_URL` directly from the browser. | Unauthenticated callers can exhaust ML service memory/CPU with oversized or decompression-bomb images (DoS) and inspect internal TensorFlow/Python exceptions; browser calls force the ML service to stay publicly exposed. | Route ML scans solely through the authenticated Spring Boot backend (`/api/batches/{id}/scan`), require a shared service token (`X-Internal-ML-Key`) on `/predict`, enforce a strict max upload byte size + `Image.MAX_IMAGE_PIXELS`, restrict ML CORS, and return generic 500 error messages. |
| **SEC-07** | **High** | Input Validation & File Upload | `src/main/java/com/freshrescue/backend/service/ImageService.java:56-94`, `src/main/java/com/freshrescue/backend/controller/ImageController.java:23-33`, `src/main/java/com/freshrescue/backend/controller/BatchController.java:183-190` | `/api/batches/{id}/scan` does not validate MIME type or magic bytes. `ImageService.resizeToMax1024Jpeg()` (`L58-61`, `L90-93`) silently returns `originalBytes` untouched if `ImageIO.read` returns `null` or fails, storing arbitrary non-image payloads in GridFS that `/api/images/{id}` serves publicly (`permitAll()` at `SecurityConfig.java:74`). | An authenticated store user can upload arbitrary non-image files (HTML, JS, SVG, PDF, executables) via `/scan` and host them persistently on the public `/api/images/{id}` endpoint. | Reject non-image uploads with HTTP 400 by checking magic bytes and failing when `ImageIO.read(...)` returns `null` (or throws) instead of falling back to `originalBytes`; add `X-Content-Type-Options: nosniff` and `Content-Disposition: inline` on `/api/images/{id}`. |
| **SEC-08** | **High** | Authorization & QR Logic | `src/main/java/com/freshrescue/backend/controller/OrderController.java:141-156`, `src/main/java/com/freshrescue/backend/service/OrderService.java:122-143`, `src/main/java/com/freshrescue/backend/security/StoreAuthorizationService.java:47-51, 87-107` | (1) `OrderController.fulfillByCode` (`L144`) and `fulfill` (`L152`) call `resolveAndVerifyStore(auth, null)`, which picks `authorized.iterator().next()` arbitrarily instead of matching the order's `storeId` against all caller-authorized stores; (2) `OrderService.fulfillByCodeOrId` (`L129-131`) and `OrderController.fulfill` (`L153-154`) fall back to Mongo `orderId` when `qrCode` is absent; (3) `StoreAuthorizationService` (`L48-51`) trusts the JWT `storeId` claim even after DB revocation until token expiry. | Staff knowing or guessing an `orderId` (without possessing the buyer's `qrCode`) can mark a reservation `FULFILLED`; multi-store managers are locked to whichever store the `HashSet` iterator yields first; and revoked store staff keep store access for up to 24h via cached JWT claims. | Require explicit `qrCode` validation for pickup fulfillment (remove the `findById` fallback), authorize the order's `storeId` via `storeAuthService.isAuthorizedForStore(auth, order.getStoreId())`, and derive authorized stores strictly from live DB state (`User` + `Store`), not stale JWT claims. |
| **SEC-09** | **High** | Frontend Auth & Session Storage | `frontend/src/App.tsx:310-311, 366-367, 4653-4744`, `frontend/src/api/client.ts:10`, `frontend/src/context/AuthContext.tsx:25-26`, `frontend/src/components/auth/ProtectedRoute.tsx:11-16` | (1) JWT (`fr_token`) and user object (`fr_user`) are stored in `localStorage`, exposing them to any XSS payload; (2) `App.tsx` never uses `ProtectedRoute` (`ProtectedRoute.tsx` is unused) and renders `/supermarket/:rest*` vs `/ngo/:rest*` purely from the URL prefix (`L4655`) without verifying login state or user role. | Any XSS vulnerability can steal `fr_token` from `localStorage` for full account takeover; any unauthenticated user or `CUSTOMER` can browse `/supermarket/*` UI routes directly. | Enforce authentication and server-verified role checks before rendering `/supermarket/*` and `/ngo/*` routes in `App.tsx` (removing dead `react-router-dom` `ProtectedRoute` or adapting it to `wouter`), and migrate JWT transport from `localStorage` to `HttpOnly; Secure; SameSite=Lax` cookies (paired with CSRF protection). |
| **SEC-10** | **High** | Data Exposure (IDOR / Over-sharing) | `src/main/java/com/freshrescue/backend/controller/CloudSyncController.java:52-60, 245-248`, `src/main/java/com/freshrescue/backend/controller/StoreController.java:90-93, 112-117` | `GET /api/cloud-sync/inventory` (`L52-60`) returns `inventoryRepo.findAll()` (including internal `storeId`, `flagged`, `discardedQuantity`, and `"Discarded"` items) to any authenticated user; `GET /api/cloud-sync/stores` (`L245-248`), `GET /api/stores` (`L90-93`), and `GET /api/stores/{id}` (`L112-117`) return raw `CloudStore`/`Store` entities exposing `managerId`, `managerName`, and `phone`. | Any registered `CUSTOMER` can scrape every store's internal waste/discard telemetry, manager user IDs, manager names, and phone numbers across all stores. | Restrict `GET /api/cloud-sync/inventory` by store ownership for managers/staff and return sanitized public buyer projections (filtering out `"Discarded"`/expired items and internal metrics) for buyers; project `Store`/`CloudStore` responses through public DTOs omitting `managerId`, `managerName`, and private contact data. |
| **SEC-11** | **High** | Order & Inventory Logic (Expiry / Hold Leak) | `src/main/java/com/freshrescue/backend/service/OrderService.java:42-58`, `src/main/java/com/freshrescue/backend/controller/CloudSyncController.java:200-220` | `OrderService.reserve` (`L47-54`) does not check that `Listing.tier != EXPIRED` (or `urgent`/batch expiry); `CloudSyncController.reserveInventoryStock` (`L200-220`) decrements `available` without checking expiry/discard status and creates **no `Order` or hold-expiry record**. | Buyers can reserve expired/discarded stock during sync gaps, or lock up all `CloudInventoryItem.available` stock indefinitely via `/cloud-sync/inventory/{id}/reserve` without ever creating a `CloudOrder` or triggering hold expiration. | Enforce `tier != EXPIRED` in `OrderService.reserve`; in `CloudSyncController`, reject expired/discarded items (`freshnessScore < expiredMax`, past `expiryDate`, or `status` `"Discarded"`/`"Discard recommended"`) and execute stock reservation + order creation together in one atomic endpoint with TTL expiry. |
| **SEC-12** | **Medium** | Auth & Brute-Force Protection | `src/main/java/com/freshrescue/backend/controller/AuthController.java:21-29`, `src/main/java/com/freshrescue/backend/service/AuthService.java:30-32, 81-88`, `src/main/java/com/freshrescue/backend/dto/AuthDtos.java:14`, `src/main/java/com/freshrescue/backend/security/JwtService.java:24` | No rate limiting or lockout on `/api/auth/login` and `/api/auth/signup`; `signup` exposes registered emails (`"Email already registered: " + cleanEmail`, `AuthService.java:31`); password validation has no max length (BCrypt 72-byte truncation / DoS on huge inputs) or complexity policy; JWTs last 24h (`expiration-ms: 86400000`) with no refresh/revocation mechanism. | Attackers can enumerate valid accounts via `/signup` and run high-rate credential-stuffing or brute-force attacks against `/login`; compromised tokens stay valid for 24h without server-side revocation. | Add IP + account rate limiting (Bucket4j / reverse-proxy WAF), return a generic signup conflict message, cap password length (`@Size(min = 8, max = 72)`), and move to short-lived access tokens + revocable refresh tokens (or `tokenVersion` on `User`). |
| **SEC-13** | **Medium** | Authorization (Reviews) | `src/main/java/com/freshrescue/backend/controller/StoreController.java:124-159` | `POST /api/stores/{id}/reviews` checks buyer role (`L125`) but never verifies that `req.orderId()` exists, belongs to `auth.getName()`, belongs to store `id`, or is `FULFILLED`, nor prevents multiple reviews per order. Also lacks `@Valid` (`comment` unbounded, store existence not checked before saving `Review`). | Any `CUSTOMER`/`NGO` can fabricate `orderId` values or spam unlimited 1-star/5-star reviews for any store, distorting store ratings. | Validate `Store` existence, enforce `@Valid` on `ReviewRequest`, require a verified `FULFILLED` `Order` owned by `reviewerId` for `storeId`, and add a unique `(storeId, reviewerId, orderId)` index on `reviews`. |
| **SEC-14** | **Medium** | Input Validation & Geo Bounds | `src/main/java/com/freshrescue/backend/controller/ListingController.java:21-28`, `OrderController.java:32-39, 134, 143, 150`, `BatchController.java:60, 128`, `StoreController.java:60, 128`, `UserController.java:32-39, 51-78`, `CloudSyncController.java:64, 95, 252, 322` | Multiple DTOs and query params lack `@Valid` and numeric/bounds constraints: `ListingController.nearby` accepts arbitrary/out-of-range `lat`/`lng`/`radiusKm` (passed straight to `NearQuery` in `ListingService.java:132-135`); `OrderController`, `StoreController`, `UserController`, `BatchController.UpdateTierRequest`, and `CloudSyncController` accept negative prices/quantities, `NaN`/`Infinity`, unbounded strings/lists, or `state=EXPIRED` without clearing `discountPercent`. | Clients can trigger noisy geospatial exceptions/scans, inject negative prices/available quantities via `CloudSyncController`, or send oversized payloads (`preferredCategories`, comments, batch sync arrays). | Add `@Valid` and Bean Validation constraints (`@NotBlank`, `@DecimalMin`/`@DecimalMax` for lat `[-90,90]` / lng `[-180,180]`, finite positive checks, `@Size` caps) across all request DTOs and query parameters. |
| **SEC-15** | **Medium** | Config & Deployment (Headers & Docker) | `src/main/java/com/freshrescue/backend/config/SecurityConfig.java:64-83`, `Dockerfile:2, 13-23`, `ml_service/Dockerfile:1-21` | `SecurityConfig` sets no explicit CSP, `Referrer-Policy`, or `Permissions-Policy`, and lacks `server.forward-headers-strategy` for HSTS behind Render TLS termination. Both `Dockerfile` and `ml_service/Dockerfile` run as `root` with unpinned base image tags (`maven:3.9.6-eclipse-temurin-17`, `eclipse-temurin:17-jre-jammy`, `python:3.11-slim`), and `ml_service/Dockerfile:6-8` keeps `build-essential` in the final image. `.dockerignore:1-7` does not exclude `.env*`, `.agent*`, `.gsd/`, or `frontend/write_lm.py`. | Container compromise grants `root` inside the container; unpinned tags risk upstream drift; missing proxy header config can downgrade HTTPS redirects/HSTS detection behind Render. | Add security headers in `SecurityConfig`, set `server.forward-headers-strategy: framework`, add non-root `USER` and multi-stage builds with `@sha256` digest-pinned base images in both Dockerfiles, and tighten `.dockerignore`. |
| **SEC-16** | **Medium** | Secrets & Repo Hygiene | `.gitignore:16-34`, git commits `413c55d`, `b0e121b`, `frontend/write_lm.py` | `.gitignore:16` only ignores `/fruit_freshness_model.h5` (root-anchored) and line `17` only ignores `.env` (not `.env.*`). Tracked in git: `fruit_freshness_model.h5`, `ml_service/fruit_freshness_model.h5` (~21 MB), `ml_service/fruit_freshness_model.keras` (~23.8 MB), `ml_service/__pycache__/app.cpython-313.pyc`, `.idea/*.xml`, `.agent/`, `.agents/`, `.gemini/`, `.gsd/`, and helper script `frontend/write_lm.py`. | Large binary models bloat git history; `.env.local`/`.env.production` could be committed accidentally; IDE and internal AI-workflow files are exposed in the repository. | Update `.gitignore` for `*.h5`, `*.keras`, `.env.*`, stop tracking already-committed `.idea/`, `__pycache__/`, `.agent*`/`.gemini/`/`.gsd/`, remove `frontend/write_lm.py`, and manage model artifacts via release assets/LFS/object storage. |
| **SEC-17** | **Medium** | Privacy / Compliance (India DPDP Act 2023 & Rules 2025) | `src/main/java/com/freshrescue/backend/entity/User.java:24-38`, `Order.java`, `CloudOrder.java:23-26`, `UserController.java`, `frontend/src/App.tsx:545-604`, `frontend/src/main.tsx:4` | Personal data (`name`, `email`, `passwordHash`, GPS `GeoJsonPoint`, `customerPhone`, `customerLocation`) and Vercel Analytics (`@vercel/analytics`) are collected with: (1) no itemized Privacy Notice / explicit affirmative consent at signup; (2) no account-deletion / data-erasure endpoint (`DELETE /api/users/me`); (3) no retention/TTL purge logic for orders, notifications, or images; (4) no published Grievance Officer contact or redressal flow. | Non-compliance with Sections 5, 6, 8(7), 12, and 13 of India's DPDP Act, 2023 (and DPDP Rules, 2025 notice/retention obligations), blocking lawful production deployment for Indian users. | Add an itemized privacy notice + unbundled consent checkbox at signup, implement `DELETE /api/users/me` (erasing PII and anonymizing order records), add MongoDB TTL/retention policies, and publish a Grievance Officer email/UI flow. |
| **SEC-18** | **Low** | Data Exposure (Error Messages) | `src/main/java/com/freshrescue/backend/config/GlobalExceptionHandler.java:80-105`, `AuthService.java:31`, `StoreAuthorizationService.java:100`, `OrderService.java:57, 134`, `BatchService.java:27, 111` | `GlobalExceptionHandler` masks 500 traces (`L137-141`), but 400/403/404/409 handlers return raw `ex.getMessage()`, exposing email registration status (`AuthService.java:31`), internal IDs (`listingId`, `batchId`), unauthorized `storeId` reflection (`StoreAuthorizationService.java:100`), and raw user `code` reflection (`OrderService.java:134`). | Aids account enumeration and internal ID/state probing. | Return standardized non-enumerating client messages for auth/access errors and log detailed IDs server-side only. |
| **SEC-19** | **Low** | Auth & JWT Implementation | `src/main/java/com/freshrescue/backend/security/JwtAuthFilter.java:37-49`, `src/main/java/com/freshrescue/backend/security/JwtService.java:23, 39-54`, `OrderController.java:136-137` | `JwtAuthFilter` parses and verifies the JWT 4 times per request (`isValid`, `extractUserId`, `extractRole`, `extractStoreId`) and creates `"ROLE_" + role` without null-checking `role`; `JwtService` uses `secret.getBytes()` without explicit `StandardCharsets.UTF_8` and omits `issuer`/`audience` pinning; `JwtAuthFilter` does not check if the user still exists in MongoDB. | Minor per-request CPU overhead, potential platform-charset mismatch, `"ROLE_null"` edge case, and continued API access by deleted users until token expiry. | Parse `Claims` once per request in `JwtAuthFilter`, validate non-null `userId`/`role`, use `StandardCharsets.UTF_8` + `iss`/`aud` claims in `JwtService`, and check user existence/active status. |
| **SEC-20** | **Low** | Frontend & Dependencies | `frontend/src/components/ui/chart.tsx:78`, `frontend/package.json:16-49`, `pom.xml:10, 22`, `ml_service/requirements.txt:1-6` | `chart.tsx:78` uses `dangerouslySetInnerHTML` for CSS variables (currently low risk if `config` is static developer config, risky if untrusted keys/colors enter); `frontend/package.json` includes redundant router dependencies (`react-router-dom` `^7.18.3` alongside `wouter` `^3.11.0`); `ml_service/requirements.txt` uses unpinned `>=` ranges without upper bounds/lockfile; live dependency CVEs are **unverified** offline. | Potential CSS/XSS injection if untrusted keys reach `ChartStyle`, unused dependency surface, and non-reproducible Python builds. | Sanitize/validate CSS identifiers & color values in `ChartStyle`, remove unused `react-router-dom` (`ProtectedRoute.tsx` alignment), pin exact ML dependency versions, and run automated CVE scans (see Dependencies section). |

---

## Top 5 Fixes to Do First

1. **Remove the hardcoded fallback JWT secret (`SEC-02`)** in `src/main/resources/application.yml:23` (`jwt.secret: ${JWT_SECRET}` with no default) and rotate `JWT_SECRET` in every deployed environment.
2. **Lock down self-assignment of `STORE_MANAGER` at signup (`SEC-01`)** in `AuthService.java:38-47` so public `/api/auth/signup` only registers `CUSTOMER` and `NGO` roles.
3. **Fix `CloudSyncController` IDOR & stock-tampering vulnerabilities (`SEC-03`, `SEC-04`, `SEC-10`, `SEC-11`)** — restrict `POST /orders` against cross-user/cross-store overwrite, restrict `/inventory/{id}/release` to authorized store staff, filter `GET /inventory` and `GET /stores` through safe buyer projections, and enforce expiry checks on reserve.
4. **Harden CORS and lock down the ML service (`SEC-05`, `SEC-06`)** — remove `https://*.vercel.app` and `https://*.onrender.com` wildcard patterns from `SecurityConfig.java:45-46`, proxy ML scans strictly through the Spring Boot backend, require internal service auth + size/pixel limits on `ml_service/app.py`, and fix `ml_service` CORS.
5. **Fix `ImageService` arbitrary-file fallback (`SEC-07`) and frontend route/QR enforcement (`SEC-08`, `SEC-09`)** — reject non-images instead of saving `originalBytes` in GridFS, require actual `qrCode` validation on `/orders/{id}/fulfill`, and wire route auth guards into `frontend/src/App.tsx`.

---

## Things That Look Good

- **Password hashing (`SecurityConfig.java:35-36`, `AuthService.java:45, 86`):** Uses `BCryptPasswordEncoder` for all password storage and verification (`passwordEncoder.matches`), and emails are normalized (`trim().toLowerCase()`) with a `@Indexed(unique = true)` constraint (`User.java:26`).
- **Strong JWT library & verification (`pom.xml:50-65`, `JwtService.java:48-53`):** Uses modern `jjwt` `0.12.6` with `Jwts.parser().verifyWith(key).build().parseSignedClaims(token)` enforcing signature and expiration checks (`alg=none` rejected by JJWT).
- **Atomic stock & order state transitions in core REST services (`OrderService.java:47-55, 154-172, 231-247`):** Core `/api/orders/reserve`, `fulfillByCodeOrId`, and `expireReservation` use atomic MongoDB `findAndModify` predicates (`quantityAvailable >= quantity`, `status == RESERVED && storeId == ...`) plus rollback compensation (`L80-87`, `L108-119`), preventing concurrent double-booking, double-fulfillment, or double-release, and rejecting expired holds (`holdExpiresAt.isBefore(Instant.now())`).
- **CSPRNG QR tokens in core `OrderService` (`OrderService.java:101`):** Core reservations generate `UUID.randomUUID().toString()` (122 bits of random entropy) rather than sequential numbers.
- **Automated hold expiry cleanup (`ReservationExpiryService.java:1-28`):** `@Scheduled(fixedRate = 60_000)` periodically sweeps expired holds and returns stock to `Listing` and `Batch`.
- **Safe Spring Data query construction:** Repositories (`OrderRepository`, `BatchRepository`, `CloudOrderRepository`, `UserRepository`, `ListingRepository`, `StoreRepository`) and `MongoTemplate` queries use parameterized `Criteria` / derived method queries — no raw string-concatenated `$where` or BSON JSON string parsing (`NoSQL operator injection` not observed in repository/service code).
- **Generic 500 error handling (`GlobalExceptionHandler.java:134-142`):** Unhandled exceptions log the stack trace server-side and return a generic 500 JSON payload without stack traces or internal class names.
- **No Actuator exposure (`pom.xml:25-93`) and well-scoped `WatchlistController` / `NotificationController`:** `spring-boot-starter-actuator` is absent; watchlist and notification endpoints verify caller ownership (`userId`) and bound `radiusKm` (1–50 km), `keyword` length (<= 40 chars), and watch count (<= 20).

---

## Detailed Domain Notes & Audit Commands

### Area 6: Secrets & Repo Hygiene
- Checked `.env*` on disk and in git history: **no `.env` file is currently present or committed**.
- Searched `src/`, `frontend/`, `ml_service/`, `.idea/`, `.agent/`, `.agents/`, `.gemini/`, `.gsd/` and git commits:
  - **Committed secret:** `src/main/resources/application.yml:23` contains a hardcoded default `JWT_SECRET` (`404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970`, added in commit `8d22f39`).
  - **`.idea/` (`6` XML files), `.agent/`, `.agents/`, `.gemini/`, `.gsd/`:** All are tracked in git despite `.gitignore:20-34` listing them because they were committed before/alongside `.gitignore`. `.idea/copilot.data.migration.ask2agent.xml` contains no credentials, only plugin migration state.
  - **Model files & `.gitignore`:** `.gitignore:16` only matches `/fruit_freshness_model.h5`, not `*.h5` or `*.keras`. Both `fruit_freshness_model.h5` (root), `ml_service/fruit_freshness_model.h5` (~21 MB, commit `413c55d`), `ml_service/fruit_freshness_model.keras` (~23.8 MB, commit `b0e121b`), and `ml_service/__pycache__/app.cpython-313.pyc` are tracked in git.

### Area 8: Dependencies & Commands to Run
Manifests reviewed:
- **`pom.xml`:** Spring Boot `3.3.4` (Java 17), `io.jsonwebtoken:jjwt-*` `0.12.6`, `spring-boot-starter-web`, `spring-boot-starter-data-mongodb`, `spring-boot-starter-validation`, `spring-boot-starter-security`, `spring-boot-starter-webflux`, `lombok`. No OWASP dependency-check plugin is configured.
- **`frontend/package.json`:** `react` `^19.2.8`, `vite` `^8.2.2`, `axios` `^1.20.0`, `leaflet` `^1.9.4`, `recharts` `^3.10.1`, `wouter` `^3.11.0`, `react-router-dom` `^7.18.3` (unused at runtime), `@vercel/analytics` `^2.0.1`.
- **`ml_service/requirements.txt`:** `fastapi>=0.110.0`, `uvicorn>=0.28.0`, `python-multipart>=0.0.9`, `tensorflow>=2.20.0`, `pillow>=10.0.0`, `numpy>=1.24.0` (unpinned upper bounds).

Live CVE status is **unverified** offline. Run these commands in an online CI or local environment:

```bash
# 1. Backend (Java / Maven) — OWASP Dependency-Check
mvn org.owasp:dependency-check-maven:check

# 2. Frontend (Node / npm)
cd frontend && npm audit --audit-level=moderate

# 3. ML Service (Python)
cd ml_service && pip install pip-audit && pip-audit -r requirements.txt
```

### Area 10: India DPDP Act 2023 & Rules 2025 Gap Checklist
- **Personal data processed:** `User.name`, `User.email`, `User.passwordHash`, `User.location` (GPS `GeoJsonPoint`), `CloudOrder.customerName`/`customerEmail`/`customerPhone`/`customerLocation`, order history, and client telemetry (`@vercel/analytics`).
- **Missing controls:**
  1. **Notice & Consent (Sec. 5 & 6; Rules 2025):** Signup screen (`frontend/src/App.tsx:545-604`) collects PII and location with no privacy notice describing purpose, retention, or withdrawal rights, and no explicit opt-in consent record stored on `User`.
  2. **Right to Erasure / Account Deletion (Sec. 12):** `UserController` has no `DELETE /api/users/me` flow to erase account PII/location/watches/notifications and anonymize historical orders.
  3. **Retention Limitation (Sec. 8(7)):** No TTL indexes (`@Indexed(expireAfter=...)`) or scheduled purge jobs exist for expired orders, notifications, or orphaned GridFS images.
  4. **Grievance Redressal (Sec. 13):** No Grievance Officer name/email or grievance-submission mechanism is present in the UI or API.

---

## Minimal Defensive Code Diff Suggestions (Critical & High Only — NOT Applied)

### SEC-01 — Prevent `STORE_MANAGER` Self-Assignment at Public Signup (`AuthService.java`)

```diff
--- a/src/main/java/com/freshrescue/backend/service/AuthService.java
+++ b/src/main/java/com/freshrescue/backend/service/AuthService.java
@@ -35,8 +35,8 @@ public class AuthService {
             throw new IllegalArgumentException("Choosing a storeId during registration is not permitted");
         }
 
-        if (req.role() == User.Role.STORE_STAFF) {
-            throw new IllegalArgumentException("STORE_STAFF cannot be registered via public signup");
+        if (req.role() != User.Role.CUSTOMER && req.role() != User.Role.NGO) {
+            throw new IllegalArgumentException("Only CUSTOMER or NGO accounts can be registered via public signup");
         }
 
         User user = User.builder()
```

### SEC-02 — Remove Hardcoded Fallback JWT Secret (`application.yml`)

```diff
--- a/src/main/resources/application.yml
+++ b/src/main/resources/application.yml
@@ -20,7 +20,7 @@ ml:
     predict-path: /predict
 
 jwt:
-  secret: ${JWT_SECRET:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}
+  secret: ${JWT_SECRET}
   expiration-ms: 86400000 # 24h
 
 # Discount tier thresholds, kept configurable rather than hardcoded in the service
```

### SEC-03 — Enforce Role, Ownership & Server-Side Pricing on `CloudSyncController.saveOrder`

```diff
--- a/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
+++ b/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
@@ -320,6 +320,7 @@ public class CloudSyncController {
     }
 
     @PostMapping("/orders")
+    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
     public ResponseEntity<?> saveOrder(@RequestBody CloudOrder order, Authentication auth) {
         boolean hasId = order.getId() != null && !order.getId().isBlank();
         boolean hasQrCode = order.getQrCode() != null && !order.getQrCode().isBlank();
@@ -342,30 +343,19 @@ public class CloudSyncController {
             }
         }
 
-        // Idempotency: If an order with the same qrCode already exists, update it (keep existing id)
         if (hasQrCode) {
             Optional<CloudOrder> existingByQr = orderRepo.findByQrCode(order.getQrCode().trim());
             if (existingByQr.isPresent()) {
-                CloudOrder ex = existingByQr.get();
-                if (order.getStatus() != null) ex.setStatus(order.getStatus());
-                if (order.getNotes() != null) ex.setNotes(order.getNotes());
-                if (order.getPickupTime() != null) ex.setPickupTime(order.getPickupTime());
-                return ResponseEntity.ok(orderRepo.save(ex));
+                return ResponseEntity.status(HttpStatus.CONFLICT)
+                        .body(Map.of("message", "Order with this QR code already exists."));
             }
         }
 
-        if (hasId) {
-            Optional<CloudOrder> existing = orderRepo.findById(order.getId().trim());
-            if (existing.isPresent()) {
-                CloudOrder ex = existing.get();
-                if (order.getStatus() != null) ex.setStatus(order.getStatus());
-                if (order.getNotes() != null) ex.setNotes(order.getNotes());
-                if (order.getPickupTime() != null) ex.setPickupTime(order.getPickupTime());
-                return ResponseEntity.ok(orderRepo.save(ex));
-            }
-        } else {
-            order.setId("ord-" + System.currentTimeMillis());
+        if (hasId && orderRepo.existsById(order.getId().trim())) {
+            return ResponseEntity.status(HttpStatus.CONFLICT)
+                    .body(Map.of("message", "Order ID already exists."));
         }
+        order.setId("ord-" + UUID.randomUUID());
+        order.setQrCode(UUID.randomUUID().toString());
+        order.setStatus("RESERVED");
 
         return ResponseEntity.ok(orderRepo.save(order));
     }
```

### SEC-04 — Restrict `/cloud-sync/inventory/{id}/release` to Authorized Store Staff

```diff
--- a/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
+++ b/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
@@ -220,10 +220,16 @@ public class CloudSyncController {
     }
 
     @PostMapping("/inventory/{id}/release")
-    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER', 'STORE_MANAGER', 'STORE_STAFF')")
-    public ResponseEntity<?> releaseInventoryStock(@PathVariable String id, @RequestParam double quantity) {
+    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
+    public ResponseEntity<?> releaseInventoryStock(
+            @PathVariable String id, @RequestParam double quantity, Authentication auth) {
         if (Double.isNaN(quantity) || Double.isInfinite(quantity) || quantity <= 0) {
             return ResponseEntity.badRequest().body(Map.of("message", "Quantity must be a positive finite number."));
         }
+        CloudInventoryItem item = inventoryRepo.findById(id).orElse(null);
+        if (item == null) {
+            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Item not found."));
+        }
+        storeAuthService.resolveAndVerifyStore(auth, item.getStoreId());
 
         Query query = Query.query(Criteria.where("id").is(id));
```

### SEC-05 — Remove Wildcard Hosting Patterns from Backend CORS (`SecurityConfig.java`)

```diff
--- a/src/main/java/com/freshrescue/backend/config/SecurityConfig.java
+++ b/src/main/java/com/freshrescue/backend/config/SecurityConfig.java
@@ -41,10 +41,6 @@ public class SecurityConfig {
     public CorsConfigurationSource corsConfigurationSource() {
         CorsConfiguration config = new CorsConfiguration();
         java.util.List<String> patterns = new java.util.ArrayList<>(List.of(
-            "http://localhost:*",
-            "http://127.0.0.1:*",
-            "https://*.vercel.app",
-            "https://*.onrender.com"
+            "http://localhost:5173",
+            "http://127.0.0.1:5173"
         ));
         if (allowedOrigins != null) {
```

### SEC-06 — Authenticate ML Service, Cap Upload Size/Pixels & Restrict CORS (`ml_service/app.py`)

```diff
--- a/ml_service/app.py
+++ b/ml_service/app.py
@@ -11,10 +11,11 @@ import logging
 
 import numpy as np
 from PIL import Image
+Image.MAX_IMAGE_PIXELS = 25_000_000
 
-from fastapi import FastAPI, File, UploadFile, HTTPException
+from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends
 from fastapi.middleware.cors import CORSMiddleware
 
 import tensorflow as tf
@@ -41,11 +42,20 @@ app = FastAPI(
 # ============================================================
 
+ML_INTERNAL_KEY = os.environ.get("ML_INTERNAL_API_KEY", "")
+MAX_IMAGE_BYTES = 10 * 1024 * 1024
+
+def require_internal_key(x_internal_key: str = Header(default="")):
+    if not ML_INTERNAL_KEY or x_internal_key != ML_INTERNAL_KEY:
+        raise HTTPException(status_code=401, detail="Unauthorized")
+
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["*"],
-    allow_credentials=True,
-    allow_methods=["*"],
-    allow_headers=["*"],
+    allow_origins=os.environ.get("ML_ALLOWED_ORIGINS", "http://localhost:8080").split(","),
+    allow_credentials=False,
+    allow_methods=["POST", "GET"],
+    allow_headers=["X-Internal-Key", "Content-Type"],
 )
@@ -128,7 +138,7 @@ def health_check():
 
 @app.post("/predict")
-async def predict_freshness(image: UploadFile = File(...)):
+async def predict_freshness(image: UploadFile = File(...), _=Depends(require_internal_key)):
 
     try:
@@ -153,7 +163,9 @@ async def predict_freshness(image: UploadFile = File(...)):
         # 2. Read image
         # ----------------------------------------------------
 
-        contents = await image.read()
+        contents = await image.read(MAX_IMAGE_BYTES + 1)
+        if len(contents) > MAX_IMAGE_BYTES:
+            raise HTTPException(status_code=413, detail="Image exceeds 10MB limit")
 
         if not contents:
@@ -391,7 +403,7 @@ async def predict_freshness(image: UploadFile = File(...)):
         logger.exception("Prediction failed")
         raise HTTPException(
             status_code=500,
-            detail=f"Prediction failed: {str(e)}"
+            detail="Prediction failed"
         )
```

### SEC-07 — Reject Non-Image Payloads in `ImageService.java` and Harden Response Headers (`ImageController.java`)

```diff
--- a/src/main/java/com/freshrescue/backend/service/ImageService.java
+++ b/src/main/java/com/freshrescue/backend/service/ImageService.java
@@ -56,8 +56,8 @@ public class ImageService {
     public byte[] resizeToMax1024Jpeg(byte[] originalBytes) {
         try {
             BufferedImage img = ImageIO.read(new ByteArrayInputStream(originalBytes));
             if (img == null) {
-                return originalBytes;
+                throw new IllegalArgumentException("Invalid or unsupported image file");
             }
 
             int width = img.getWidth();
@@ -88,8 +88,9 @@ public class ImageService {
             ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ImageIO.write(resized, "jpg", baos);
             return baos.toByteArray();
+        } catch (IllegalArgumentException e) {
+            throw e;
         } catch (Exception e) {
-            log.warn("Could not resize image, storing original bytes: {}", e.getMessage());
-            return originalBytes;
+            throw new IllegalArgumentException("Failed to process uploaded image");
         }
     }
```

```diff
--- a/src/main/java/com/freshrescue/backend/controller/ImageController.java
+++ b/src/main/java/com/freshrescue/backend/controller/ImageController.java
@@ -28,6 +28,7 @@ public class ImageController {
         }
         return ResponseEntity.ok()
                 .contentType(MediaType.IMAGE_JPEG)
+                .header("X-Content-Type-Options", "nosniff")
                 .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                 .body(resource);
     }
```

### SEC-08 — Require Valid `qrCode` & Verify Against All Caller-Authorized Stores (`OrderController.java`, `OrderService.java`, `StoreAuthorizationService.java`)

```diff
--- a/src/main/java/com/freshrescue/backend/controller/OrderController.java
+++ b/src/main/java/com/freshrescue/backend/controller/OrderController.java
@@ -141,18 +141,18 @@ public class OrderController {
     @PostMapping("/fulfill-code")
     @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
     public Order fulfillByCode(@RequestBody FulfillCodeRequest request, Authentication auth) {
-        String staffStoreId = storeAuthService.resolveAndVerifyStore(auth, null);
-        return orderService.fulfillByCodeOrId(request.code(), staffStoreId);
+        Set<String> authorizedStoreIds = storeAuthService.getAuthorizedStoreIds(auth);
+        return orderService.fulfillByQrCode(request != null ? request.code() : null, authorizedStoreIds);
     }
 
     @PostMapping("/{id}/fulfill")
     @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
     public Order fulfill(@PathVariable String id, @RequestBody(required = false) FulfillRequest request,
             Authentication auth) {
-        String staffStoreId = storeAuthService.resolveAndVerifyStore(auth, null);
-        String code = (request != null && request.qrCode() != null && !request.qrCode().isBlank()) ? request.qrCode()
-                : id;
-        return orderService.fulfillByCodeOrId(code, staffStoreId);
+        Set<String> authorizedStoreIds = storeAuthService.getAuthorizedStoreIds(auth);
+        String qrCode = (request != null) ? request.qrCode() : null;
+        return orderService.fulfillOrderWithQr(id, qrCode, authorizedStoreIds);
     }
```

```diff
--- a/src/main/java/com/freshrescue/backend/security/StoreAuthorizationService.java
+++ b/src/main/java/com/freshrescue/backend/security/StoreAuthorizationService.java
@@ -44,12 +44,6 @@ public class StoreAuthorizationService {
 
         Set<String> storeIds = new HashSet<>();
 
-        // 1. JWT Details storeId
-        Object details = auth.getDetails();
-        if (details instanceof String detailsStr && !detailsStr.isBlank()) {
-            storeIds.add(detailsStr.trim());
-        }
-
         // 2. User entity storeId
         if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) {
             storeIds.add(user.getStoreId().trim());
```

### SEC-09 — Enforce Auth & Role Guard on Frontend Product Routes (`frontend/src/App.tsx`)

```diff
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -4651,8 +4651,21 @@ function NotificationsPage() {
 // PRODUCT ROUTE DISPATCHER
 // -------------------------------------------------------------
 function ProductRoute() {
-  const [location] = useLocation();
+  const [location, setLocation] = useLocation();
   const role: AppWorkspaceRole = location.startsWith("/ngo") ? "ngo" : "supermarket";
+  const token = typeof localStorage !== "undefined" ? localStorage.getItem("fr_token") : null;
+  const rawUser = typeof localStorage !== "undefined" ? localStorage.getItem("fr_user") : null;
+  const parsedUser = rawUser ? (() => { try { return JSON.parse(rawUser); } catch { return null; } })() : null;
+  const isStoreUser = parsedUser?.role === "STORE_MANAGER" || parsedUser?.role === "STORE_STAFF";
+
+  useEffect(() => {
+    if (!token || !parsedUser) {
+      setLocation("/login");
+    } else if (role === "supermarket" && !isStoreUser) {
+      setLocation("/ngo/overview");
+    }
+  }, [token, parsedUser, role, isStoreUser, setLocation]);
+  if (!token || !parsedUser || (role === "supermarket" && !isStoreUser)) return null;
```

*(Note: Full XSS resistance also requires migrating `fr_token` out of `localStorage` into an `HttpOnly; Secure; SameSite=Lax` cookie issued by `/api/auth/login` and `/api/auth/signup`.)*

### SEC-10 — Restrict `GET /api/cloud-sync/inventory` & Sanitize Store Responses (`CloudSyncController.java`, `StoreController.java`)

```diff
--- a/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
+++ b/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
@@ -50,9 +50,18 @@ public class CloudSyncController {
 
     // --- Inventory Sync ---
     @GetMapping("/inventory")
-    public List<CloudInventoryItem> getAllInventory() {
-        List<CloudInventoryItem> all = inventoryRepo.findAll();
-        // Item D: Exclude freshnessHistory from GET /cloud-sync/inventory responses (served only through /history)
+    public List<CloudInventoryItem> getAllInventory(Authentication auth) {
+        boolean isStoreRole = auth != null && auth.getAuthorities().stream()
+                .anyMatch(a -> a.getAuthority().equals("ROLE_STORE_MANAGER") || a.getAuthority().equals("ROLE_STORE_STAFF"));
+        List<CloudInventoryItem> all;
+        if (isStoreRole) {
+            Set<String> storeIds = storeAuthService.getAuthorizedStoreIds(auth);
+            all = storeIds.isEmpty() ? Collections.emptyList() : inventoryRepo.findByStoreIdIn(storeIds);
+        } else {
+            all = inventoryRepo.findAll().stream()
+                    .filter(i -> i.getAvailable() > 0 && !"Discarded".equalsIgnoreCase(i.getStatus()) && !"Discard recommended".equalsIgnoreCase(i.getStatus()))
+                    .toList();
+        }
         for (CloudInventoryItem item : all) {
             item.setFreshnessHistory(null);
         }
```

```diff
--- a/src/main/java/com/freshrescue/backend/controller/StoreController.java
+++ b/src/main/java/com/freshrescue/backend/controller/StoreController.java
@@ -87,9 +87,13 @@ public class StoreController {
         return ResponseEntity.ok(saved);
     }
 
+    public record PublicStoreSummary(String id, String name, String address, double averageRating, int reviewCount) {}
+
     @GetMapping
-    public List<Store> getAllStores() {
-        return storeRepository.findAll();
+    public List<PublicStoreSummary> getAllStores() {
+        return storeRepository.findAll().stream()
+                .map(s -> new PublicStoreSummary(s.getId(), s.getName(), s.getAddress(), s.getAverageRating(), s.getReviewCount()))
+                .toList();
     }
```

### SEC-11 — Block Reservation of Expired Items (`OrderService.java`, `CloudSyncController.java`)

```diff
--- a/src/main/java/com/freshrescue/backend/service/OrderService.java
+++ b/src/main/java/com/freshrescue/backend/service/OrderService.java
@@ -45,7 +45,9 @@ public class OrderService {
         }
 
         Query query = Query.query(
-                Criteria.where("id").is(listingId).and("quantityAvailable").gte(quantity)
+                Criteria.where("id").is(listingId)
+                        .and("quantityAvailable").gte(quantity)
+                        .and("tier").ne(Batch.BatchState.EXPIRED)
         );
         Update update = new Update().inc("quantityAvailable", -quantity);
```

```diff
--- a/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
+++ b/src/main/java/com/freshrescue/backend/controller/CloudSyncController.java
@@ -204,7 +204,11 @@ public class CloudSyncController {
             return ResponseEntity.badRequest().body(Map.of("message", "Quantity must be a positive finite number."));
         }
 
-        Query query = Query.query(Criteria.where("id").is(id).and("available").gte(quantity));
+        Query query = Query.query(Criteria.where("id").is(id)
+                .and("available").gte(quantity)
+                .and("freshnessScore").gte(batchStateService.getExpiredMax())
+                .and("status").nin("Discarded", "Discard recommended"));
         Update update = new Update().inc("available", -quantity);
```

