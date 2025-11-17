Security & Compliance

  - [Critical] /api/production-status, /api/db-test, and /api/debug/prisma are exposed without auth and disclose hostnames, env vars, DB connectivity, and the node_modules directory (server/server-setup.js:161, server/server-setup.js:317,
    server/server-setup.js:344); remove or lock them behind admin auth before shipping another build.
  - [Critical] The auth middleware prints whether an Authorization header is present and even logs decoded JWT payloads, and the login flow persists the raw JWT token in user_session alongside the hash (server/middleware/auth.js:10-31, server/
    middleware/auth.js:146-160, server/routes/auth.js:387); strip those logs and only store hashed tokens so a log leak or DB dump can’t be replayed.
  - [High] Card photo and profile uploads both read up to five 10 MB files into RAM and create world-readable Azure Blob containers on every request (server/routes/user-card-photos.js:10-24 & server/routes/user-card-photos.js:177-216, server/
    routes/user-profile.js:765-855), so any authenticated user can exhaust memory and every avatar/card photo is publicly retrievable; switch to streamed uploads plus private containers/SAS URLs.
  - [High] Several routes build SQL manually via $queryRawUnsafe (for example server/routes/cards.js:328-397, server/routes/user-cards.js:70-205) and the admin query tester executes arbitrary SELECT statements off the request body (server/
    routes/admin-query-tester.js:1-150); even with some escaping this is a permanent injection and data-exfiltration risk, so refactor them to Prisma’s query builder or at least parameterized $queryRaw.
  - [High] The “admin only” database stats refresh endpoint and the status router are unauthenticated (server/routes/database-stats.js:95-112, server/routes/status.js:1-210); tighten those routes to authenticated admins only and remove the
    internal fetch('http://localhost:3001/health') call that will hang behind load balancers.
  - [Medium] The sanitizer forbids apostrophes, semicolons, and SQL keywords for most fields (server/middleware/inputSanitization.js:25-68) yet it’s not used on high-risk routes like search/admin query tester, which means legitimate names
    (O’Neil, D’Angelo) are rejected while unsafe SQL still exists; rely on parameterization for safety and relax the regexes so user data can contain real-world characters.

  Architecture & Reliability

  - [High] Almost every route spins up its own new PrismaClient() (e.g., server/routes/user-profile.js:1-5, server/routes/user-cards.js:1-12, server/routes/achievements.js:4-8) and the eBay utilities even import server/utils/prisma-pool-
    manager.js; this shards the connection pool and is the root cause of intermittent P2024 errors—migrate all modules to const { prisma } = require('../config/prisma-singleton') and delete the duplicate pool manager.
  - [High] Production boot silently swaps any route that fails to require with a mock handler that returns { message: 'X route mock' } (server/server-setup.js:203-304), so broken features ship without detection; fail fast instead of masking
    missing routes.
  - [Medium] The card search endpoint allows limit=10000, assembles huge SQL strings, and never touches the declared LRU cache (server/routes/cards.js:63-155, server/routes/cards.js:171-397), so every request pounds the DB and stale cache-hit
    metrics are meaningless; either implement proper caching with invalidation or remove the unused cache scaffolding and enforce lower limits.
  - [Medium] The legacy import workflow keeps a parallel mssql connection pool and its own retry logic (server/routes/import-workflow.js:34-174, server/routes/import-workflow.js:304-402), making it impossible to reuse Prisma migrations/
    transactions; refactor those services onto Prisma so the platform has a single database abstraction.
  - [Medium] The status router still assumes it can talk to itself on http://localhost:3001/health (server/routes/status.js:151) which is false once the app sits behind Azure Front Door or a container orchestrator; expose an in-process health
    into a background job and gate the endpoint with auth + rate limiting.

  Front-end & UX

  - [High] Route declaration order registers /:username before /:username/:listSlug, so per-user list URLs are unreachable and fall back to the public profile page (client/src/main.jsx:148-164); reorder those routes or namespace lists.
  - [Medium] Comments, admin screens, and the logger expect user.userId/user.user_id (client/src/components/CommentsSection.jsx:185-205, client/src/utils/logger.js:90-99, plus multiple admin pages), yet the AuthContext only provides user.id,
    which means owner checks, delete buttons, and log context never work; normalize the shape returned by /api/auth/profile and the client context.
  - [Medium] The search results page ships a hard-coded Easter egg payload when someone searches “jeffblankenburg” and never cancels inflight Axios calls (client/src/pages/SearchResults.jsx:56-220, client/src/pages/SearchResults.jsx:51-120), so
    users can see stale or fake data; drop the mock, use an AbortController, and debounce properly.
  - [Medium] Axios interceptors log every request/response—including errorData—to the browser console by default (client/src/utils/axios-interceptor.js:19-88); that leaks user-specific payloads to anybody with DevTools open, so guard the logger
    behind import.meta.env.DEV or strip payload data in production.
  - [Medium] Upload-heavy screens pull tokens manually from localStorage (client/src/components/Header.jsx:119-188, client/src/components/CommentsSection.jsx:189-205), bypassing the global axios defaults set in AuthContext; move those callers to
    the shared axios instance so logout/login flows stay consistent.
  - [Low] client/src/components/PerformanceMonitor.jsx and the global design-system CSS are no longer imported anywhere (confirmed via rg), which bloats the bundle without benefit; remove or fold them into Storybook docs.

  - [High] The backend ships with only a handful of Jest specs (e.g., server/tests/integration/player-matching.test.js, tests/sql-injection-protection.test.js) and there are zero automated tests for search V2, achievements, lists, photo uploads,
    or Azure/eBay integrations; add regression suites before refactoring any of those areas.
  - [Medium] There are no client-side tests (unit, integration, or end-to-end) for routing, AuthContext, universal search, or the admin UI, so regressions like the broken /:username/:listSlug route make it to production unnoticed; introduce at
    least smoke tests via Vitest or Cypress.
  - [Medium] The telemetry service initialises OpenTelemetry + Dynatrace exporters on module load for every environment (server/services/telemetryService.js:1-210), which slows local tests and produces noisy console output; lazily initialize it
    behind a feature flag or environment check.
  - [Low] Health/status docs such as OPENTELEMETRY_MIGRATION.md aren’t referenced anywhere in code or CI, so new developers have no enforcement that instrumentation stays enabled; link those docs in README/AGENTS.md and codify telemetry
    requirements in CI.

  Candidate Removals / Dead Files

  - Legacy routes that are never registered (server/routes/achievements-broken.js, server/routes/import.js, server/routes/search-optimized.js, server/routes/players-list.js, server/routes/diagnostic.js) only add confusion—server/server-setup.js
    loads the optimized equivalents instead, so archive or delete the old files.
  - Front-end leftovers (client/src/components/PerformanceMonitor.jsx, client/src/styles/global-design-system.css, design-system.html, css-test.html, the empty console.txt) aren’t referenced anywhere per rg; either move them into docs/examples
    or remove them to keep the repo lean.
  uploads so these issues don’t reappear.