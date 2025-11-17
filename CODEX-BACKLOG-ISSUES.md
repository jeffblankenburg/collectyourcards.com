# CODEX Backlog Issues

Prioritized GitHub issue briefs derived from `CODEX-ASSESSMENT.md`. Each entry includes a ready-to-copy title, severity, context, and acceptance criteria so the work can be scheduled over the next several weeks.

## Security & Compliance

### Issue: Lock down diagnostics and production status routes
- **Severity:** Critical
- **Summary:** `/api/production-status`, `/api/db-test`, and `/api/debug/prisma` return hostnames, Prisma diagnostics, env vars, and file listings without authentication (see `server/server-setup.js:161`, `:317`, `:344`).
- **Acceptance Criteria:**
  - Require admin authentication and rate limiting for any remaining diagnostics endpoints, or remove them entirely in production builds.
  - Strip responses down to minimal health signals (no env vars, stack traces, directory listings, or Prisma configs).
  - Ensure CI/CD fails if diagnostic routes are exposed without auth.

### Issue: Stop logging/storing raw JWT secrets
- **Severity:** Critical
- **Summary:** `auth` middleware logs Authorization headers and decoded JWT payloads, and `user_session` records plaintext tokens alongside hashes (`server/middleware/auth.js:10-31`, `:146-160`, `server/routes/auth.js:387`).
- **Acceptance Criteria:**
  - Remove console logging of Authorization headers and decoded payloads.
  - Persist only hashed tokens (with salts) for comparison; never store or echo raw JWTs.
  - Add regression tests ensuring logs stay silent and DB rows omit the token column.

### Issue: Stream uploads and lock Azure blobs
- **Severity:** High
- **Summary:** Card/profile uploads load multiple 10 MB files into RAM and create world-readable containers on each request (`server/routes/user-card-photos.js:10-24`, `:177-216`, `server/routes/user-profile.js:765-855`).
- **Acceptance Criteria:**
  - Switch to streamed uploads (multer streaming or Azure BlockBlobClient uploadStream) with tight per-file limits.
  - Provision a single private container up front; expose assets via time-bound SAS URLs.
  - Add integration tests verifying oversized payloads are rejected and containers remain private.

### Issue: Eliminate unsafe SQL execution paths
- **Severity:** High
- **Summary:** Several endpoints craft SQL via `$queryRawUnsafe` and the admin query tester runs arbitrary statements from the request body (`server/routes/cards.js:328-397`, `server/routes/user-cards.js:70-205`, `server/routes/admin-query-tester.js:1-150`).
- **Acceptance Criteria:**
  - Refactor affected endpoints to Prisma query builders or `$queryRaw` with placeholders.
  - Remove or heavily restrict the admin query tester feature.
  - Add Jest tests covering SQL injection attempts to confirm parameterization.

### Issue: Secure database stats and status endpoints
- **Severity:** High
- **Summary:** The “admin-only” database refresh and `/status` router are unauthenticated and even fetch `http://localhost:3001/health`, which will hang behind load balancers (`server/routes/database-stats.js:95-112`, `server/routes/status.js:1-210`).
- **Acceptance Criteria:**
  - Gate both endpoints behind admin auth + rate limiting, and short-circuit requests with in-process health data.
  - Remove the localhost fetch dependency; expose health metrics through shared services instead.
  - Document operational access requirements in `README.md`.

### Issue: Modernize input sanitization strategy
- **Severity:** Medium
- **Summary:** The sanitizer blocks apostrophes/SQL keywords yet is unused on high-risk routes like search or the query tester, causing both false positives and residual risk (`server/middleware/inputSanitization.js:25-68`).
- **Acceptance Criteria:**
  - Relax regexes to permit legitimate characters (O’Neil, etc.) and rely on parameterized queries for safety.
  - Apply targeted validation middleware to routes that must strip HTML/JS.
  - Cover the new sanitizer behavior with unit tests.

## Architecture & Reliability

### Issue: Enforce a single Prisma client per process
- **Severity:** High
- **Summary:** Most routes call `new PrismaClient()` and eBay utilities keep their own pool manager, exhausting connections and causing `P2024` errors (`server/routes/user-profile.js:1-5`, `server/routes/user-cards.js:1-12`, `server/routes/achievements.js:4-8`, `server/utils/prisma-pool-manager.js`).
- **Acceptance Criteria:**
  - Export a singleton from `server/config/prisma-singleton` and update all routes/services to import it.
  - Delete `server/utils/prisma-pool-manager.js` and redundant instantiations.
  - Add integration tests confirming concurrent requests reuse the singleton (inspect metrics/logs).

### Issue: Fail fast when route modules cannot load
- **Severity:** High
- **Summary:** Production boot silently swaps failed `require` calls with mock handlers returning `{ message: 'X route mock' }`, masking missing features (`server/server-setup.js:203-304`).
- **Acceptance Criteria:**
  - Remove the mock fallback; throw during boot if a route fails to load.
  - Add health checks/alerts so deployments fail when a route import breaks.
  - Document expected behavior in deployment runbooks.

### Issue: Rein in card search query load and caching
- **Severity:** Medium
- **Summary:** `/api/cards/search` allows `limit=10000`, assembles massive SQL strings, and never uses the declared LRU cache (`server/routes/cards.js:63-397`).
- **Acceptance Criteria:**
  - Enforce sane paging limits (e.g., 100–250) with validation errors for higher values.
  - Either implement the cache with invalidation hooks or remove the dead code.
  - Add performance tests demonstrating stable response times under load.

### Issue: Migrate legacy import workflow to Prisma
- **Severity:** Medium
- **Summary:** The import workflow manages a separate MSSQL pool and bespoke retry logic, preventing reuse of Prisma migrations/transactions (`server/routes/import-workflow.js:34-174`, `:304-402`).
- **Acceptance Criteria:**
  - Reimplement the workflow using Prisma models/transactions.
  - Remove direct MSSQL driver dependencies and redundant retry code.
  - Provide migration guides/tests for the new flow.

### Issue: Provide an in-process health signal
- **Severity:** Medium
- **Summary:** The status router calls back into `http://localhost:3001/health`, which fails once the app sits behind Azure Front Door or containers (`server/routes/status.js:151`).
- **Acceptance Criteria:**
  - Replace the HTTP self-call with shared health state from background probes.
  - Ensure the `/status` endpoint responds quickly even when external calls hang.
  - Add monitoring covering both public and internal health endpoints.

### Issue: Defer telemetry initialization outside production
- **Severity:** Medium
- **Summary:** `telemetryService` bootstraps OpenTelemetry + Dynatrace exporters on module load for every environment, slowing tests and spamming logs (`server/services/telemetryService.js:1-210`).
- **Acceptance Criteria:**
  - Initialize telemetry lazily and guard it behind env vars/feature flags.
  - Provide no-op exporters for local/test environments.
  - Add unit tests verifying telemetry stays disabled when flags are off.

## Front-end & UX

### Issue: Fix user list routing precedence
- **Severity:** High
- **Summary:** Route registration adds `/:username` before `/:username/:listSlug`, causing list URLs to resolve to the profile page (`client/src/main.jsx:148-164`).
- **Acceptance Criteria:**
  - Reorder or namespace routes so list slugs match before generic usernames.
  - Add router tests ensuring list URLs hit the correct component.

### Issue: Normalize AuthContext user shape
- **Severity:** Medium
- **Summary:** Components expect `user.userId`/`user.user_id` while AuthContext provides `user.id`, breaking owner checks, admin actions, and logger metadata (`client/src/components/CommentsSection.jsx:185-205`, `client/src/utils/logger.js:90-99`).
- **Acceptance Criteria:**
  - Align the server `/api/auth/profile` response and client context to expose consistent IDs.
  - Update components/tests to rely on a single property.

### Issue: Stabilize search results interactions
- **Severity:** Medium
- **Summary:** Search results ship a hard-coded “jeffblankenburg” Easter egg payload and never cancel inflight Axios calls, leading to stale/fake data (`client/src/pages/SearchResults.jsx:51-220`).
- **Acceptance Criteria:**
  - Remove the mock payload and rely on live API data.
  - Use `AbortController`/cancellation + debouncing to avoid race conditions.
  - Add smoke tests verifying responses correspond to the final query.

### Issue: Guard axios interceptors from leaking payloads
- **Severity:** Medium
- **Summary:** Interceptors log every request/response and include error payloads even in production builds (`client/src/utils/axios-interceptor.js:19-88`).
- **Acceptance Criteria:**
  - Restrict verbose logging to `import.meta.env.DEV` or redact payload data in production.
  - Add unit tests confirming logs stay silent in prod mode.

### Issue: Consolidate upload flows on shared axios auth
- **Severity:** Medium
- **Summary:** Upload-heavy components manually read tokens from `localStorage`, bypassing the global axios defaults set in AuthContext (`client/src/components/Header.jsx:119-188`, `client/src/components/CommentsSection.jsx:189-205`).
- **Acceptance Criteria:**
  - Refactor those components to use the shared axios instance/context.
  - Add regression tests for logout/login flows to ensure headers clear correctly.

### Issue: Remove unused client UI artifacts
- **Severity:** Low
- **Summary:** `PerformanceMonitor`, `global-design-system.css`, `design-system.html`, `css-test.html`, and `console.txt` are no longer referenced, bloating the bundle.
- **Acceptance Criteria:**
  - Delete or archive the unused components/assets, updating docs if examples should live elsewhere.
  - Confirm Vite build stats drop accordingly.

## Testing, Docs, and Cleanup

### Issue: Expand backend regression coverage
- **Severity:** High
- **Summary:** Only a handful of Jest specs exist; search V2, achievements, lists, photo uploads, and Azure/eBay flows lack automated tests.
- **Acceptance Criteria:**
  - Create targeted Jest + Supertest suites for the missing areas with seeded data.
  - Integrate the suites into `npm run test` and CI coverage gates.

### Issue: Introduce client-side testing
- **Severity:** Medium
- **Summary:** There are zero unit/integration/E2E tests for routing, AuthContext, universal search, or admin UI.
- **Acceptance Criteria:**
  - Stand up Vitest (unit) and/or Cypress (E2E) smoke suites covering routing, Auth flows, and search.
  - Add coverage thresholds to CI.

### Issue: Enforce telemetry documentation and CI hooks
- **Severity:** Low
- **Summary:** Docs like `OPENTELEMETRY_MIGRATION.md` aren’t referenced anywhere, so instrumentation can silently drift.
- **Acceptance Criteria:**
  - Link telemetry/health docs in `README.md` or developer onboarding.
  - Add CI checks or lint steps ensuring telemetry env vars/configs stay in sync.

### Issue: Retire unused legacy server routes
- **Severity:** Low
- **Summary:** Files such as `server/routes/achievements-broken.js`, `import.js`, `search-optimized.js`, `players-list.js`, and `diagnostic.js` are never registered.
- **Acceptance Criteria:**
  - Delete or archive the unused route files with documentation about their replacements.
  - Ensure `server/server-setup.js` no longer references them.
