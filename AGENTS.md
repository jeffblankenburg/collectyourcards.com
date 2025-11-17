# Repository Guidelines

## Project Structure & Module Organization
- `server/` hosts the Express API; place endpoints under `routes/`, shared business rules in `services/`, middleware such as `auth.js` and `inputSanitization.js` in `middleware/`, and Prisma wiring inside `config/`.
- Client UI lives in `client/` (Vite + React). Pages and widgets sit in `client/src`, static assets in `client/public`, and Vite emits builds to `client/dist`.
- Data definitions reside in `prisma/schema.prisma` and SQL automation lives under `migrations/` and `database-scripts/`.
- Automated and exploratory suites live in `server/tests`, repo-level `tests/`, and `test/`; reuse helpers before creating new harnesses.

## Build, Test, and Development Commands
- `npm run install:all` installs dependencies in both the root and `client/`.
- `npm run dev` runs server (`server:dev`) and client (`client:dev`) concurrently for full-stack development.
- `npm run build` compiles the React client; run before container builds or Vite previews (`cd client && npm run preview`).
- `npm start` serves the production bundle, while `npm run start:minimal` disables optional integrations for smoke tests.
- Database utilities: `npm run db:push` syncs Prisma schema changes, `npm run db:studio` opens Prisma Studio.
- Quality gates: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:coverage`.

## Coding Style & Naming Conventions
- JavaScript/TypeScript files use 2-space indentation, semicolons, and modern ES modules; React components are PascalCase (`SeriesDetail.tsx`), hooks camelCase, API routes kebab-case (`/api/search-v2`).
- Run `eslint server client/src --ext .js,.jsx,.ts,.tsx` before committing; fix or suppress rules only with justification.
- Keep Prisma models singular (`Card`, `Achievement`) and align service filenames with their feature scope (`searchService.js`, `achievementService.js`).

## Testing Guidelines
- Jest + Supertest drive API, utility, and integration specs; mirror filenames with `*.test.js|ts` inside `server/tests` or feature-specific folders.
- Seed the local database via `database/DATABASE_*.sql` or `npm run db:push` before suites that require data.
- Target coverage parity using `npm run test:coverage`; new endpoints need success, validation, and failure-path tests.

## Commit & Pull Request Guidelines
- Commits stay short and imperative (~60 chars) similar to `Production code visibility on series detail page`; keep one functional change per commit.
- PRs must describe scope, link issues or Azure work items, attach screenshots/GIFs for UI changes, and call out schema updates or feature flags.
- Verify `npm run lint`, `npm test`, and relevant build steps locally, and document new env vars in `docs/` or `.env.example`.

## Security & Configuration Tips
- Manage secrets via `.env` files (loaded by `dotenv`); never commit credentials or production connection strings.
- Reference `OPENTELEMETRY_MIGRATION.md` and `AZURE_FUNCTION_DEPLOYMENT.md` before touching telemetry or Azure resources; keep instrumentation toggled via env vars.
- Sanitize and rate-limit user input using existing middleware (`server/middleware/inputSanitization.js`, `server/middleware/rateLimiter.js`), and keep uploads constrained through the configured `multer` settings.
