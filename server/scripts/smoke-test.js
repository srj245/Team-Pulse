const { spawn } = require("child_process");
const path = require("path");
const { createTestDatabase } = require("./testDb");

async function waitForServer(baseUrl, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Server did not become healthy before timeout");
}

async function request(baseUrl, pathname, options = {}) {
  const { headers = {}, ...restOptions } = options;
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:8080",
      ...headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${data.error || response.statusText}`);
  }

  return data;
}

function buildEnv(port, databaseEnv) {
  return {
    ...process.env,
    PORT: String(port),
    CORS_ORIGIN: "http://localhost:8080",
    FRONTEND_URL: "http://localhost:8080",
    JWT_SECRET: "test-jwt-secret",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_test_placeholder",
    STRIPE_PRICE_ID_PRO_MONTHLY: "price_test_placeholder",
    SMTP_HOST: "",
    SMTP_PORT: "587",
    SMTP_USER: "",
    SMTP_PASS: "",
    EMAIL_FROM: "ValidationEngine <no-reply@example.com>",
    ADMIN_API_KEY: "admin-test-key",
    API_KEY: "",
    ...databaseEnv,
  };
}

async function main() {
  const port = 4173;
  const baseUrl = `http://127.0.0.1:${port}`;
  const database = await createTestDatabase("validation-engine-smoke");

  const server = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: buildEnv(port, database.env),
    stdio: "inherit",
  });

  const shutdown = () => {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  };

  process.on("exit", shutdown);

  try {
    await waitForServer(baseUrl, 15000);

    const startPayload = await request(baseUrl, "/api/ideas", {
      method: "POST",
      body: JSON.stringify({
        ideaText: "An AI tool that validates new SaaS ideas by publishing landing pages and tracking waitlist demand.",
      }),
    });

    if (!startPayload.idea?.id || !startPayload.accessToken) {
      throw new Error("Expected workflow start to return an idea id and access token");
    }

    if (!Array.isArray(startPayload.research) || startPayload.research.length < 1) {
      throw new Error("Expected at least one research result");
    }

    if (!startPayload.hypothesis?.targetUser || !startPayload.landingPage?.url) {
      throw new Error("Expected hypothesis and landing page output");
    }

    const landingResponse = await fetch(startPayload.landingPage.url);
    const landingHtml = await landingResponse.text();
    if (!landingResponse.ok || !landingHtml.includes("waitlist")) {
      throw new Error("Expected landing page to be publicly accessible");
    }

    const waitlistPayload = await request(baseUrl, "/api/waitlist", {
      method: "POST",
      body: JSON.stringify({
        ideaId: startPayload.idea.id,
        email: "tester@example.com",
        interviewRequested: true,
      }),
    });

    if (waitlistPayload.analytics.signups !== 1) {
      throw new Error("Expected waitlist signup to increment signups");
    }

    const statePayload = await request(baseUrl, `/api/ideas/${startPayload.idea.id}`, {
      headers: {
        "X-Idea-Token": startPayload.accessToken,
      },
    });

    if ((statePayload.analytics.visits || 0) < 1) {
      throw new Error("Expected page visit analytics to increment after landing page view");
    }

    if (!["go", "pivot", "kill"].includes(statePayload.decision?.decision)) {
      throw new Error("Expected decision engine output");
    }

    if (!statePayload.decision?.evidenceStatus || !statePayload.decision?.experimentPlan?.successMetric) {
      throw new Error("Expected decision engine to include evidence state and experiment plan");
    }

    console.log("Smoke test passed");
  } finally {
    shutdown();
    await new Promise((resolve) => server.once("exit", resolve));
    await database.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
