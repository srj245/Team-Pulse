# ValidationEngine

ValidationEngine is a startup-validation platform with two deployable applications:

- `frontend/`: React + Vite dashboard and public site shell
- `backend/`: Express API for auth, validation runs, waitlist capture, decisioning, and contact delivery

This repository has been hardened toward production on the current stack instead of being rewritten into a different framework.

## Stack

- Frontend: React 19, Vite, React Router, Tailwind CSS
- Backend: Node.js 24, Express
- Persistence: SQLite for local development, PostgreSQL documented as the production target schema
- Integrations: Gemini, Tavily, SerpAPI, SMTP
- DevOps: Docker, docker-compose, GitHub Actions

## Repository Layout

```text
.
|- backend/
|- docs/
|- frontend/
|- docker-compose.yml
|- plan.md
```

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm test
npm run start
```

Backend runs on `http://localhost:4000`.

Health probes:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`

### Frontend

```bash
cd frontend
npm install
npm run lint
npm test
npm run dev
```

Frontend runs on `http://localhost:8080`.

If you are not using the Vercel runtime config endpoint, set:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

## Docker

Start both apps together:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:4000`

## Environment Variables

### Backend

See [backend/.env.example](/c:/Team-Pulse/backend/.env.example).

Important variables:

- `CORS_ORIGIN`
- `FRONTEND_URL`
- `BACKEND_PUBLIC_URL`
- `JWT_SECRET`
- `SMTP_*`
- `CONTACT_TO_EMAIL`
- `ALLOW_EMAIL_PREVIEW`
- `EMAIL_VERIFICATION_TTL_MINUTES`
- `TRUST_PROXY`

### Frontend

See [frontend/.env.example](/c:/Team-Pulse/frontend/.env.example).

Important variables:

- `VITE_API_BASE_URL`
- `VALIDATION_ENGINE_API_BASE` for the optional Vercel runtime endpoint

## Test Commands

### Backend

```bash
cd backend
npm test
```

This runs:

- unit tests
- smoke tests
- auth integration tests
- security integration tests

### Frontend

```bash
cd frontend
npm run lint
npm test
npm run build
```

## Deployment

### Frontend

- Recommended: Vercel or static hosting behind a CDN
- Build command: `npm run build`
- Output directory: `dist`

### Backend

- Recommended: Render, Railway, Fly.io, ECS/Fargate, or another long-running Node host
- Start command: `npm run start`
- Do not rely on ephemeral disk for production data

### Production Notes

- Use PostgreSQL for production persistence
- Keep SQLite for local development and tests only
- Configure SMTP; do not rely on preview email mode in production
- Set a canonical `BACKEND_PUBLIC_URL`
- Restrict `CORS_ORIGIN` to exact frontend origins

## API Documentation

Current API reference lives in [docs/api.md](/c:/Team-Pulse/docs/api.md).

## Architecture and Plan

- Current hardening plan: [plan.md](/c:/Team-Pulse/plan.md)
- Product architecture notes: [docs/architecture.md](/c:/Team-Pulse/docs/architecture.md)
- Target production direction: [docs/production-architecture.md](/c:/Team-Pulse/docs/production-architecture.md)
