# Production Readiness Plan

## Objective

Convert the current ValidationEngine repository into a production-ready system without doing a blind rewrite. The implementation should preserve working product flows where possible, remove demo-only behavior, and add the missing operational, security, testing, and deployment foundations required for a real environment.

## Current State Assessment

### Product and Architecture

- The repository currently contains two separately deployable apps:
  - `frontend/`: React 19 + Vite SPA with React Router, Tailwind, Framer Motion, and localStorage-backed session state.
  - `backend/`: Node.js + Express API with direct SQLite access through `node:sqlite`.
- The main active product flow is the startup validation engine:
  - create idea
  - run research
  - generate hypothesis
  - generate public landing page
  - capture waitlist interest
  - compute decision
- The backend also contains partially separate legacy modules for team management, billing, admin, and a multi-agent workflow. Those modules are only partially integrated and are not production-clean.

### Code and Runtime Observations

- `backend/src/app.js` mounts the validation and auth routes, and conditionally mounts team, billing, and admin routes behind `ENABLE_LEGACY_PLATFORM`.
- `backend/src/routes/workflowRoutes.js` still exists, but it is not mounted by the app, which means that legacy workflow surface is currently dead code.
- `backend/src/db/index.js` boots SQLite directly from `schema.sql` on process start and performs ad hoc schema drift repair with `ALTER TABLE`.
- `backend/schema.sql` and `backend/schema.postgres.sql` describe different shapes of the system. The PostgreSQL schema is more production-oriented, but it is not the schema used by the running app.
- `frontend/src/lib/runtime.js` resolves API base URL from localStorage, a Vercel runtime endpoint, or localhost inference. `frontend/.env.example` documents `VALIDATION_ENGINE_API_BASE`, but the SPA does not read it directly.
- `frontend/src/pages/ContactPage.jsx` is explicitly frontend-only and not connected to any backend delivery path.

### Testing and Tooling

- Backend testing exists only as executable smoke/security/auth scripts:
  - `backend/scripts/smoke-test.js`
  - `backend/scripts/security-test.js`
  - `backend/scripts/auth-test.js`
- Frontend currently has lint and build only. There is no automated frontend test harness.
- There is no root CI/CD pipeline, no repo-level GitHub Actions workflow, and no Docker assets.
- There is no consistent workspace-level developer tooling at the repository root.

### Security and Production Gaps

- Email verification links can be logged when SMTP is not configured, and signup succeeds even when real delivery is impossible.
- Email verification tokens do not expire.
- Auth/session handling is split between bearer token storage in `localStorage` and auth cookies, without a hardened production policy around CSRF/session lifecycle.
- Rate limiting depends on `req.ip`, while `trust proxy` is always enabled, which is unsafe for direct deployments.
- Public landing page URLs are derived from request headers and persisted, making host-header poisoning possible.
- Input validation is present but inconsistent and hand-rolled. There is no centralized schema validation framework.
- There is no structured logging, no request correlation, no audit logging, no Sentry/APM integration, and no production monitoring hooks.
- No deployment health/readiness separation exists beyond simple health endpoints.

### Operational Gaps

- The backend is currently coupled to SQLite and local disk, which is not suitable for horizontally scaled or ephemeral production environments.
- Research, AI generation, decision recomputation, and page generation run inline in the request cycle instead of through background jobs.
- No caching layer exists for search/research results, rate limiting state, or repeated decision inputs.
- There is no queue, no async job orchestration, and no retry policy for external provider failures.

## Recommended Direction

### Default Recommendation

Use an incremental hardening strategy on the existing stack first:

1. Keep `frontend/` and `backend/` as separate deployable applications for the first production pass.
2. Harden the current React + Vite frontend instead of rewriting immediately to Next.js.
3. Harden the current Express backend instead of doing a framework rewrite in the same pass.
4. Migrate production data to PostgreSQL and treat SQLite as local-dev and test-only.
5. Quarantine or remove unfinished legacy surfaces unless they are explicitly in production scope.

This is lower risk, preserves current product behavior, and gets to a stable production baseline faster than combining hardening with a full platform rewrite.

### Deferred Optional Future State

After the core system is stable, the repository can optionally be reorganized into a monorepo with `apps/web`, `apps/api`, and shared packages. That is not the recommended first move unless a broader product rewrite is explicitly desired.

## Target Production Architecture

### Frontend

- Keep SPA deployment for phase 1.
- Move toward feature-based organization:
  - `frontend/src/app`
  - `frontend/src/features/auth`
  - `frontend/src/features/ideas`
  - `frontend/src/features/experiments`
  - `frontend/src/features/settings`
  - `frontend/src/components`
  - `frontend/src/lib`
  - `frontend/src/test`
- Replace fragile route-level side effects with stable hooks and request state boundaries.
- Remove demo-only UX that pretends to persist data when it does not.
- Add a proper API client, typed response contracts, and centralized error handling.

### Backend

- Reorganize backend by domain modules instead of broad service buckets:
  - `backend/src/app`
  - `backend/src/config`
  - `backend/src/modules/auth`
  - `backend/src/modules/ideas`
  - `backend/src/modules/research`
  - `backend/src/modules/hypotheses`
  - `backend/src/modules/landing-pages`
  - `backend/src/modules/analytics`
  - `backend/src/modules/decisions`
  - `backend/src/modules/public`
  - `backend/src/modules/health`
  - `backend/src/platform/db`
  - `backend/src/platform/logging`
  - `backend/src/platform/queue`
  - `backend/src/platform/providers`
- Introduce `api/v1` route versioning for all supported production endpoints.
- Separate public, authenticated, admin, and internal routes.

### Data Layer

- Choose one authoritative schema.
- Use migrations instead of runtime schema mutation.
- Move production persistence to PostgreSQL.
- Keep SQLite only for local dev/test if required.
- Ensure analytics and experiment data model is versioned and index-backed.

## Folder Structure Cleanup Plan

### Repository Level

- Keep `frontend/` and `backend/` for the first production pass.
- Add a root `.gitignore` if still missing at repo level.
- Add root-level operational assets:
  - `plan.md`
  - `docker-compose.yml`
  - `README.md`
  - `.github/workflows/ci.yml`
  - optional `Makefile` or root helper scripts

### Backend Cleanup

- Remove dead route mounts and unreachable legacy modules or move them behind explicit feature boundaries.
- Split middleware into:
  - auth
  - validation
  - security
  - error handling
  - observability
- Move provider integrations to dedicated clients.
- Introduce repository/service layering where business logic and persistence are separated.

### Frontend Cleanup

- Move route files into feature folders.
- Move API calls out of pages into service modules/hooks.
- Standardize UI primitives and routing/link usage.
- Remove invalid nested interactive elements.

## API Design Improvements

### API Versioning

- Introduce `/api/v1` for all supported production routes.
- Keep existing endpoints temporarily with compatibility shims only during migration.

### Endpoint Shape

- Auth:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/resend-verification`
  - `GET /api/v1/auth/me`
- Ideas:
  - `POST /api/v1/ideas`
  - `GET /api/v1/ideas/:ideaId`
  - `GET /api/v1/ideas`
- Research:
  - `POST /api/v1/ideas/:ideaId/research`
  - `GET /api/v1/ideas/:ideaId/research`
- Hypothesis:
  - `POST /api/v1/ideas/:ideaId/hypothesis`
  - `GET /api/v1/ideas/:ideaId/hypothesis`
- Experiments / landing pages:
  - `POST /api/v1/ideas/:ideaId/experiments`
  - `GET /api/v1/experiments/:experimentId`
  - `GET /api/v1/public/experiments/:slug`
- Waitlist:
  - `POST /api/v1/public/experiments/:slug/waitlist`
- Analytics:
  - `POST /api/v1/public/events`
  - `GET /api/v1/experiments/:experimentId/analytics`
- Decisions:
  - `POST /api/v1/experiments/:experimentId/decision`
  - `GET /api/v1/experiments/:experimentId/decision`

### Contract Standards

- Standardize response envelope for errors:
  - `code`
  - `message`
  - `details`
  - `requestId`
- Add pagination, filtering, and sort support to list endpoints.
- Move public waitlist submission to slug-based submission rather than raw `ideaId`.
- Stop exposing unstable internal implementation details in public responses.

## Database Schema Validation Plan

### Current Problem

- `schema.sql` is authoritative for the running app.
- `schema.postgres.sql` is more mature but not wired to runtime.
- Legacy workflow tables and current validation tables coexist in one schema without a clear ownership boundary.

### Execution

1. Compare current runtime entities against product requirements.
2. Decide authoritative production entities:
   - users
   - ideas
   - research runs and sources
   - hypotheses
   - experiments / landing pages
   - events
   - waitlist signups
   - decisions
3. Deprecate or isolate unused legacy entities:
   - startup projects
   - workflow artifacts
   - agent runs
   - unfinished team/billing entities if they are not in scope
4. Add migration tooling.
5. Add schema validation in CI.

### Required Production Data Rules

- Unique constraints on user email, public slug, and per-experiment waitlist email.
- Foreign keys and indexed query paths for all high-read tables.
- Versioned landing pages and decision snapshots.
- Explicit timestamps for created, updated, verified, deployed, and processed events.
- Event model designed for append-only ingest and rollup aggregation.

## Security Fix Plan

### Authentication and Authorization

- Move to one production auth policy:
  - recommended: HttpOnly secure auth cookies with signed tokens or server-backed sessions
- Remove dual-state confusion between localStorage bearer auth and cookie auth.
- Add token expiration, rotation policy, and logout invalidation behavior.
- Add email verification token expiry and resend throttling.
- Add stronger password rules and login brute-force protections.
- Add role/permission boundaries for admin-only surfaces.

### Validation and Sanitization

- Replace ad hoc validators with a schema-based validator.
- Validate all path, query, and body inputs.
- Sanitize user-generated content rendered into landing pages.
- For research fetching, add URL validation and SSRF guardrails.

### HTTP and Platform Security

- Make `trust proxy` environment-driven.
- Use canonical base URLs from environment, not request headers, for persisted public URLs.
- Add CSRF protection if cookie-based browser auth is used.
- Tighten CSP, CORS, and secure cookie settings per environment.
- Add rate limiting policies for:
  - auth
  - waitlist
  - public events
  - research generation
  - contact submissions

### Secrets and Auditability

- Remove secret leakage paths from logs.
- Standardize `.env.example` coverage for all required runtime variables.
- Add audit logs for login, verification, publish, billing, and admin actions.

## Performance Optimization Plan

### Request Path

- Remove long-running synchronous generation work from the request/response cycle where possible.
- Cache repeated research queries and provider responses with TTL.
- Avoid redundant frontend refetch loops and duplicated verification calls.
- Add pagination and projection to avoid oversized payloads.

### Computation and Analytics

- Introduce cached analytics rollups.
- Reduce repeated decision recomputation by using event-triggered invalidation.
- Precompute experiment metrics instead of scanning raw tables on every request.

### Frontend

- Consolidate API state management.
- Avoid effect dependency bugs and unstable callback churn.
- Remove invalid interactive nesting and improve accessibility.

## Scalability Plan

### Phase 1

- Single backend service + PostgreSQL + optional Redis.
- Background jobs for research, landing generation, and decision refresh.
- Queue retries for provider failures.

### Phase 2

- Redis-backed rate limiting and cache.
- Dedicated worker process for async jobs.
- Rollup tables/materialized metrics for analytics.
- Separate public event ingestion path from authenticated dashboard APIs.

### Phase 3

- Horizontal API scaling.
- Object storage or CDN for landing assets.
- Provider abstraction with failover and circuit-breaking.

## Missing Production Essentials to Add

- Structured logging
- Request IDs and correlation IDs
- Monitoring hooks and health probes
- Readiness and liveness endpoints
- Contact form backend integration
- Dockerfile for frontend
- Dockerfile for backend
- `docker-compose.yml` for local full-stack boot
- GitHub Actions CI pipeline
- Expanded `.env.example` coverage
- Production build and start scripts

## Health and Observability Plan

### Health Endpoints

- `GET /health/live`
- `GET /health/ready`
- Optionally `GET /health/deps` for internal diagnostics only

### Logging

- Introduce structured JSON logs.
- Include:
  - timestamp
  - level
  - service
  - requestId
  - route
  - latency
  - userId where safe

### Monitoring

- Add Sentry or equivalent error monitoring.
- Add basic metrics hooks for:
  - request count
  - latency
  - error rate
  - queue depth
  - provider failures

## Testing Plan

### Backend

- Add unit tests for:
  - auth token creation/verification
  - decision engine thresholds
  - validation helpers
  - research normalization
- Add integration tests for:
  - auth lifecycle
  - idea creation
  - waitlist submission
  - analytics rollup
  - error handling
- Add regression tests for known issues:
  - expired verification token
  - host header poisoning prevention
  - trust proxy behavior
  - resend-verification enumeration prevention

### Frontend

- Add component and route tests for:
  - auth pages
  - verification flow
  - dashboard data flow
  - runtime config resolution
  - contact form behavior
- Add accessibility checks for core navigation and form flows.

### CI Quality Gates

- lint
- build
- unit tests
- integration tests
- migration validation
- optional dependency audit

## DevOps and Deployment Plan

### Containerization

- Backend:
  - multi-stage Dockerfile
  - production `NODE_ENV=production`
  - healthcheck
- Frontend:
  - build in one stage, serve with static server or nginx if needed

### Local Orchestration

- `docker-compose.yml` with:
  - frontend
  - backend
  - postgres
  - redis

### CI/CD

- GitHub Actions pipeline:
  - install
  - lint
  - test
  - build
  - docker build
  - migration check
- Add deployment workflows for preview/staging/production.

### Recommended Production Topology

- Frontend: Vercel
- Backend: Render, Railway, Fly.io, or ECS/Fargate
- Database: PostgreSQL managed service
- Redis: managed Redis
- Monitoring: Sentry + log drain

## Documentation Plan

### README

- Root setup
- local development
- environment variables
- test commands
- Docker flow
- deployment flow
- operational notes

### API Documentation

- versioned endpoint reference
- request/response examples
- auth model
- error format

### Operations Documentation

- migration steps
- rollback plan
- secrets management
- incident checklist

## Verification Loop

After each major implementation phase:

1. run automated checks
2. run targeted manual validation
3. fix failures immediately
4. update docs if behavior changed
5. only then move to the next phase

### Verification Gates by Phase

- Phase A: repo cleanup and environment standardization
  - app boots locally
  - existing flows still work
- Phase B: auth/security hardening
  - signup/login/verify/logout all pass
  - new negative-path tests pass
- Phase C: data layer migration
  - migrations apply cleanly
  - seed and tests pass
- Phase D: frontend stabilization
  - route tests pass
  - accessibility regressions checked
- Phase E: Docker and CI/CD
  - containers build and start
  - CI passes from clean checkout
- Phase F: docs and release prep
  - deployment instructions validated

## Phased Execution Plan

### Phase 0: Decision Lock

- Confirm production scope.
- Confirm stack direction.
- Confirm database direction.
- Confirm whether unfinished legacy modules stay or go.

### Phase 1: Repository and Config Hardening

- Normalize environment contracts.
- Add missing examples and startup validation.
- Remove dead/demo-only repo artifacts.
- Add root-level operational files.

### Phase 2: Backend Hardening

- Modularize backend.
- Add structured logging and request IDs.
- Fix auth/email verification issues.
- Fix host/proxy/rate-limit issues.
- Add proper health probes.

### Phase 3: Frontend Hardening

- Fix verification loop and redundant effects.
- Replace fake contact flow.
- Stabilize runtime config usage.
- Add tests and accessibility fixes.

### Phase 4: Data and Persistence

- Introduce authoritative production schema and migrations.
- Move to PostgreSQL production path.
- Keep SQLite only if needed for local dev/test.

### Phase 5: Background Jobs and Performance

- Move research/decision generation off critical request paths.
- Add cache and queue layer.
- Add analytics rollups.

### Phase 6: Testing and CI

- Add unit and integration tests.
- Add GitHub Actions.
- Add migration validation and build verification.

### Phase 7: Deployment and Operations

- Add Dockerfiles and compose.
- Add deployment docs and production startup scripts.
- Add monitoring and release checklist.

## Blocking Decisions Requiring Confirmation Before Implementation

1. Whether to harden the current React + Vite / Express stack or do a larger rewrite toward the future-state architecture in `docs/production-architecture.md`.
2. Whether PostgreSQL should become mandatory now for production scope, with SQLite kept only for local development.
3. Whether legacy modules (`team`, `billing`, `admin`, `workflow`) are in production scope for this pass or should be removed/quarantined.

## Planned Deliverables

- Production-hardened frontend and backend
- Cleaned project structure
- Secure auth and validation model
- Structured logging and health endpoints
- Unit and integration tests
- Docker and docker-compose
- GitHub Actions CI/CD
- Updated root README and API documentation
- Deployment instructions for cloud and container flows
