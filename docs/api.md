# API Documentation

Base URL examples:

- Local backend: `http://localhost:4000`
- Production: your deployed backend origin

## Health

### `GET /health`

Basic product health endpoint.

### `GET /health/live`

Liveness probe for containers and load balancers.

### `GET /health/ready`

Readiness probe. Returns `503` when dependencies are unavailable.

## Validation Runs

### `POST /api/ideas`

Create a validation run.

Request body:

```json
{
  "ideaText": "An AI tool that validates startup demand before teams build."
}
```

Response includes:

- `idea`
- `research`
- `hypothesis`
- `landingPage`
- `analytics`
- `decision`
- `progress`
- `accessToken`

### `GET /api/ideas/:ideaId`

Fetch the dashboard state for an idea.

Headers:

- `X-Idea-Token`

### `GET /api/analytics/:ideaId`

Fetch analytics, progress, mode, and decision summary.

Headers:

- `X-Idea-Token`

## Public Landing and Waitlist

### `GET /launch/:slug`

Serve the generated landing page and record a visit.

### `POST /api/waitlist`

Capture a waitlist signup from the public landing page.

Request body:

```json
{
  "ideaId": 1,
  "email": "founder@example.com",
  "interviewRequested": true
}
```

## Contact

### `POST /api/contact`

Submit a contact message through the backend.

Request body:

```json
{
  "name": "Ayush",
  "email": "ayush@example.com",
  "message": "I want to discuss a pilot."
}
```

Response:

```json
{
  "success": true,
  "message": "Message received. We will get back to you soon."
}
```

## Authentication

### `POST /api/auth/signup`

Create an account and send a verification email.

Request body:

```json
{
  "name": "Ayush",
  "email": "you@example.com",
  "password": "founder2026"
}
```

### `POST /api/auth/login`

Sign in a verified user.

### `POST /api/auth/logout`

Clear the auth cookie.

### `GET /api/auth/verify-email?token=...`

Verify the email token and sign the user in.

### `POST /api/auth/resend-verification`

Request a fresh verification email.

### `GET /api/auth/me`

Authenticated profile alias.

### `GET /api/auth/profile`

Fetch the signed-in user profile.

### `PATCH /api/auth/profile`

Update user profile fields.

### `POST /api/auth/complete-onboarding`

Mark onboarding as complete.

## Error Format

Errors return:

```json
{
  "error": "Human readable message",
  "code": null,
  "details": null,
  "requestId": "uuid"
}
```

Use `requestId` for log correlation and incident debugging.
