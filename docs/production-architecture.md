# AI Startup Validation Engine

Production architecture for a real SaaS product that founders can use for grounded startup validation.

## 1. System Architecture Diagram

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                                 Clients                                   │
│  Founder Dashboard (Next.js)      Public Landing Pages (Next.js static)   │
└───────────────────────────────┬───────────────────────────────┬───────────┘
                                │                               │
                                │ HTTPS                         │ HTTPS
                                ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              Edge / CDN / WAF                             │
│          Vercel Edge / CloudFront / Fastly + rate limiting + TLS          │
└───────────────────────────────┬───────────────────────────────┬───────────┘
                                │                               │
                                ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                             Application Layer                             │
│  Next.js App Router                                                      │
│  - auth UI                                                               │
│  - founder dashboard                                                     │
│  - experiment analytics UI                                               │
│  - public landing page renderer                                          │
└───────────────────────────────┬───────────────────────────────┬───────────┘
                                │ API calls                     │ event ingest
                                ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Backend API (Node.js)                           │
│  Express or NestJS                                                       │
│  - Auth service                                                          │
│  - Idea service                                                          │
│  - Research service                                                      │
│  - Hypothesis service                                                    │
│  - Landing page service                                                  │
│  - Experiment service                                                    │
│  - Event ingestion service                                               │
│  - Decision engine                                                       │
│  - Webhook / deploy integration                                          │
└───────────────┬──────────────────────┬──────────────────────┬────────────┘
                │                      │                      │
                ▼                      ▼                      ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
│   PostgreSQL         │   │  Redis Cache/Queue   │   │ Object Storage      │
│ - ideas              │   │ - research cache     │   │ - landing bundles   │
│ - sources            │   │ - rate-limit state   │   │ - assets            │
│ - hypotheses         │   │ - job queue          │   │ - exports           │
│ - experiments        │   └──────────────────────┘   └────────────────────┘
│ - events             │
│ - decisions          │
└───────────────┬──────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          External Integrations                            │
│  Gemini API      Tavily/SerpAPI      Stripe      PostHog/Plausible        │
│  Render/Vercel   SMTP provider       Logging/APM  Sentry                  │
└───────────────────────────────────────────────────────────────────────────┘
```

## 2. Production Folder Structure

```text
apps/
|- web/                              # Next.js app
|  |- src/
|  |  |- app/
|  |  |  |- (auth)/
|  |  |  |- dashboard/
|  |  |  |- experiments/[experimentId]/
|  |  |  |- launch/[slug]/
|  |  |- components/
|  |  |  |- dashboard/
|  |  |  |- charts/
|  |  |  |- forms/
|  |  |  |- launch/
|  |  |- lib/
|  |  |  |- api-client.ts
|  |  |  |- auth.ts
|  |  |  |- analytics.ts
|  |  |- styles/
|  |- public/
|
|- api/                              # Express or NestJS app
|  |- src/
|  |  |- modules/
|  |  |  |- auth/
|  |  |  |- users/
|  |  |  |- ideas/
|  |  |  |- research/
|  |  |  |- hypotheses/
|  |  |  |- landing-pages/
|  |  |  |- experiments/
|  |  |  |- events/
|  |  |  |- decisions/
|  |  |  |- deployments/
|  |  |- clients/
|  |  |  |- openai.client.ts
|  |  |  |- tavily.client.ts
|  |  |  |- serpapi.client.ts
|  |  |  |- deploy.client.ts
|  |  |- db/
|  |  |  |- prisma/
|  |  |  |- migrations/
|  |  |- jobs/
|  |  |  |- research.job.ts
|  |  |  |- deployment.job.ts
|  |  |  |- decision.job.ts
|  |  |- middleware/
|  |  |- utils/
|  |- test/
|
packages/
|- shared-types/
|- landing-renderer/                 # reusable landing page generator
|- eslint-config/
|- tsconfig/
|
infrastructure/
|- terraform/
|- docker/
|- github-actions/
|
docs/
|- production-architecture.md
```

## 3. Backend API Design

### Auth

- `POST /v1/auth/register`
  - create account
- `POST /v1/auth/login`
  - session or JWT cookie
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

### Ideas

- `POST /v1/ideas`
  - create idea
  - payload: `{ ideaText, companyContext?, marketContext? }`
  - creates initial idea record and experiment container
- `GET /v1/ideas/:ideaId`
  - returns idea, latest hypothesis, latest decision, linked experiment
- `GET /v1/ideas`
  - paginated founder idea list

### Research

- `POST /v1/ideas/:ideaId/research/run`
  - enqueue research refresh
- `GET /v1/ideas/:ideaId/research`
  - returns normalized sources with URL, snippet, fetched timestamp, pricing extraction

Research service logic:
- build search queries from idea + category terms
- fetch top sources through Tavily/SerpAPI
- resolve landing/pricing pages
- extract structured competitor data
- persist raw source metadata and normalized records
- cache query results in Redis by normalized query hash for 24 hours

### Hypothesis

- `POST /v1/ideas/:ideaId/hypothesis/generate`
- `GET /v1/ideas/:ideaId/hypothesis`

Hypothesis service logic:
- use only grounded research inputs
- reject generation if source count is below threshold
- generate:
  - target user
  - problem statement
  - value proposition
  - testable hypothesis
  - falsifiable success metric
- store model version, prompt version, and response validation status

### Landing Pages / Experiments

- `POST /v1/ideas/:ideaId/experiments`
  - create experiment from hypothesis
- `GET /v1/experiments/:experimentId`
- `POST /v1/experiments/:experimentId/deploy`
  - trigger Vercel deployment or build export bundle
- `GET /v1/experiments/:experimentId/public-page`
  - returns deployment metadata

Experiment service logic:
- create versioned landing page content
- assign slug and deployment target
- emit build job
- store deployment URL and build status

### Waitlist / Leads

- `POST /v1/public/experiments/:slug/waitlist`
  - capture email, optional interview request, optional role
- `GET /v1/experiments/:experimentId/signups`
  - founder-facing leads view

### Events / Analytics

- `POST /v1/public/events`
  - ingestion endpoint for visit/click/form events
- `GET /v1/experiments/:experimentId/analytics`
  - unique visitors, signups, conversion, trend lines, referral breakdown

Event service logic:
- write append-only events
- dedupe unique visitors using anonymous cookie + IP hash + UA hash
- aggregate rollups on ingest or via periodic jobs

### Decisions

- `POST /v1/experiments/:experimentId/decision/run`
- `GET /v1/experiments/:experimentId/decision`

Decision engine logic:
- compute hard metrics:
  - unique visitors
  - signup conversion
  - interview request rate
  - repeat visits
- apply rule-based classification first
- call AI only for explanation and recommended next actions
- never let AI override the computed class without explicit review

## 4. Frontend Pages and Components

### Pages

- `/login`
- `/register`
- `/dashboard`
- `/ideas/new`
- `/ideas/[ideaId]`
- `/experiments/[experimentId]`
- `/launch/[slug]`
- `/settings`

### Dashboard Components

- `IdeaInputForm`
- `ResearchSourcesTable`
- `ResearchSourceCard`
- `HypothesisPanel`
- `ExperimentStatusCard`
- `OpenLivePageButton`
- `AnalyticsOverview`
- `SignupTrendChart`
- `LeadTable`
- `DecisionSummary`
- `ActivityFeed`

### Real-time updates

- use SSE first for simplicity
- upgrade to websockets only if interactive collaboration is required

## 5. PostgreSQL Schema

Authoritative schema is in [schema.postgres.sql](/c:/Team-Pulse/backend/schema.postgres.sql).

Core entities:

- `users`
- `ideas`
- `research_runs`
- `research_sources`
- `hypotheses`
- `landing_pages`
- `experiments`
- `event_sessions`
- `events`
- `waitlist_signups`
- `decisions`

Key design choices:

- append-only `events` table for auditability
- rollup-friendly indexes on `experiment_id`, `event_type`, and time buckets
- versioned `landing_pages` and `hypotheses`
- soft deletes on user-owned entities if compliance requires recovery windows

## 6. Landing Page Generation System

### Requirements

- every landing page is versioned
- each version is tied to one experiment
- each page has:
  - unique slug
  - headline, subheadline, CTA
  - benefits and proof points
  - waitlist form
  - analytics script

### Generation pipeline

1. hypothesis is approved or auto-generated
2. landing content generator produces validated JSON
3. renderer converts JSON into React component props
4. page snapshot is stored in `landing_pages`
5. deployment job either:
   - publishes to Vercel via API, or
   - creates static artifact and uploads to object storage/CDN

### Production constraint

Do not deploy raw LLM HTML. Generate structured content only, then render through trusted components.

## 7. Analytics Tracking System

### Events captured

- `page_view`
- `cta_click`
- `form_started`
- `waitlist_submitted`
- `interview_requested`

### Unique visitor logic

- anonymous visitor id cookie
- IP hash and user-agent hash for abuse mitigation
- server-side dedupe window configurable, default 24h

### Aggregations

- daily unique visitors
- total signups
- interview request rate
- conversion rate by page version
- source/referrer breakdown

### Storage pattern

- raw event append table
- materialized rollups:
  - `experiment_daily_metrics`
  - `experiment_version_metrics`

## 8. Deployment Plan

### Recommended

- Frontend: Vercel
- API: Railway or AWS ECS/Fargate
- Database: Neon, RDS, or Supabase Postgres
- Redis: Upstash or ElastiCache
- Storage: S3 or Cloudflare R2
- Logging/APM: Sentry + Datadog or Better Stack

### Vercel

- deploy Next.js app
- serve public landing pages from the same app
- use environment separation: preview, staging, production

### Railway / AWS

- run API service separately
- private DB networking where possible
- health checks and autoscaling enabled

### CI/CD

- GitHub Actions
- steps:
  - lint
  - typecheck
  - unit tests
  - integration tests
  - migration validation
  - deploy to preview
  - manual approval for production

## 9. Security Best Practices

- HttpOnly secure session cookies or signed JWT cookies
- CSRF protection for authenticated browser flows
- zod or class-validator request validation on all inputs
- strict CSP on public pages
- rate limiting:
  - auth endpoints
  - waitlist submit endpoint
  - event ingestion endpoint
- source URL sanitization and SSRF protections in scraping pipeline
- encryption at rest for secrets and provider credentials
- audit logging for sensitive actions:
  - login
  - deployment
  - experiment publish
  - lead export
- hashed IP storage for analytics privacy
- double opt-in optional for waitlist leads in privacy-sensitive regions

## 10. Scaling Considerations

### Near term

- cache research queries
- materialize analytics rollups every 1-5 minutes
- move deployment and decision recomputation to background jobs

### Mid term

- partition events by month
- archive raw HTML snapshots and old page versions to object storage
- shard background queues by job type

### Product correctness

- research extraction confidence score per source
- provider failover: Tavily -> SerpAPI -> manual review queue
- block low-source-count hypothesis generation
- decision engine requires minimum traffic before strong recommendation

## Decision Engine Rules

Rule-based layer comes first.

Example default thresholds:

- `GO`
  - unique visitors >= 150
  - signup conversion >= 12%
  - interview request rate >= 2%
- `PIVOT`
  - unique visitors >= 75
  - signup conversion between 4% and 12%
  - signs of interest but weak conversion
- `KILL`
  - unique visitors >= 75
  - signup conversion < 4%
  - low interview intent
- `INSUFFICIENT_DATA`
  - not enough traffic to judge yet

AI explanation layer inputs:

- metrics
- traffic sources
- page version
- grounded research summary
- prior experiment changes

AI explanation layer outputs:

- rationale summary
- likely friction points
- next 3 recommended actions

The AI layer must not invent facts and must cite only stored metrics or stored research.
