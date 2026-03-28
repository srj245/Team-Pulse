# AI Startup Validation Engine Backend

Express backend for the startup validation flow.

It takes one raw startup idea and turns it into:

- sourced competitor research
- a validation hypothesis
- a live landing page
- waitlist and interview capture
- a verdict driven by real demand signals

## Core API

### `GET /health`

Health check.

### `POST /api/ideas`

Creates a validation run.

Request:

```json
{
  "ideaText": "An AI tool that helps founders validate pricing before building."
}
```

Response includes:

- `idea`
- `research`
- `hypothesis`
- `landingPage`
- `analytics`
- `decision`
- `accessToken`

### `GET /api/ideas/:ideaId`

Loads the saved dashboard state.
Requires `X-Idea-Token`.

### `GET /api/analytics/:ideaId`

Returns analytics, progress, mode, and decision.
Requires `X-Idea-Token`.

### `POST /api/waitlist`

Captures a public signup from the generated landing page.

### `GET /launch/:slug`

Serves the public landing page and records a visit.

### `POST /api/auth/signup`

Creates an account and sends an email verification link.

### `POST /api/auth/login`

Signs in a verified user and returns an `authToken`.

### `GET /api/auth/verify-email?token=...`

Verifies the account email and signs the user in.

### `GET /api/auth/profile`

Returns the signed-in user profile. Supports `Authorization: Bearer <token>`.

### `PATCH /api/auth/profile`

Updates the signed-in user profile.

## Environment

Only the validation flow is required for the core demo.

- `PORT`
- `DB_PROVIDER` `sqlite` or `mongo`
- `DATABASE_PATH` for SQLite
- `MONGO_URI` for MongoDB
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `JWT_SECRET`
- `API_KEY` optional
- `AI_MODEL` optional
- `SMTP_HOST` optional
- `SMTP_PORT` optional
- `SMTP_USER` optional
- `SMTP_PASS` optional
- `EMAIL_FROM` optional
- `TAVILY_API_KEY` optional
- `SERPAPI_KEY` optional

Recommended Gemini setup:

```bash
API_KEY=your-gemini-api-key
AI_MODEL=gemini-2.5-flash
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:8080
```

`CORS_ORIGIN` supports comma-separated origins, for example:

```bash
http://localhost:8080,http://127.0.0.1:8080,https://your-project.vercel.app
```

Legacy auth, billing, and team-management modules are disabled by default.
Their extra environment variables are intentionally omitted from `.env.example` because they are not needed for the current validation flow.

## Run

```bash
cd backend
npm install
copy .env.example .env
node src/server.js
```

## Vercel

If you deploy the backend as its own Vercel project:

1. Set the Vercel project root directory to `backend`
2. Keep [backend/vercel.json](/c:/Team-Pulse/backend/vercel.json)
3. Add the environment variables from [backend/.env.example](/c:/Team-Pulse/backend/.env.example)

The current SQLite storage is suitable for demos, but Vercel does not provide persistent disk storage for production data.

For Mongo-backed validation runs:

```bash
npm run test:mongo
```

## Verify

```bash
cd backend
node scripts/smoke-test.js
node scripts/security-test.js
node scripts/auth-test.js
```

## Demo Seed

```bash
cd backend
node scripts/seed-demo.js
```

This creates one ready-to-demo validation run with sample waitlist activity.
