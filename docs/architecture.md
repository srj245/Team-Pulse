# System Architecture

ValidationEngine is split into a React + Vite frontend and a Node.js + Express backend.

## High-Level Flow

```mermaid
graph TD;
    Client[React Frontend] -->|REST API calls| API[Node.js Express API]
    API --> Workflow[Validation Workflow]

    subgraph Core Services
        Workflow -->|Query competitors| Search[Tavily / SerpApi]
        Workflow -->|Generate outputs| LLM[Gemini / LLM API]
        Workflow -->|Persist state| DB[(SQLite)]
    end

    Client -->|Open launch page| LandingPage[Generated Landing Page]
    LandingPage -->|Capture waitlist lead| API
    API -->|Refresh analytics and decision| DB
```

## Frontend

- Single frontend lives in `frontend/`
- React Router handles landing, dashboard, auth, profile, and content routes
- Vite handles local development and production builds
- Vercel runtime config injects the backend base URL for deployed environments

## Backend

- `validationWorkflow`: orchestrates research, hypothesis, landing page, and decision generation
- `authService`: handles sign-up, sign-in, verification, and profile updates
- `researchService`: interfaces with search providers
- `landingPageService`: builds the public launch page
- `decisionService`: scores outcomes from current evidence
- `validationStore`: persists validation state in SQLite
