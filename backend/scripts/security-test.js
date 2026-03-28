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

async function request(baseUrl, pathName, options = {}) {
  const { headers = {}, ...restOptions } = options;
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:8080",
      ...headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
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
  const port = 4174;
  const baseUrl = `http://127.0.0.1:${port}`;
  const database = await createTestDatabase("validation-engine-security");

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

    const emptyIdea = await request(baseUrl, "/api/ideas", {
      method: "POST",
      body: JSON.stringify({ ideaText: "" }),
    });

    if (emptyIdea.status !== 400) {
      throw new Error(`Expected 400 for empty idea, received ${emptyIdea.status}`);
    }

    const startPayload = await request(baseUrl, "/api/ideas", {
      method: "POST",
      body: JSON.stringify({
        ideaText: "AI tool for validating startup demand with landing pages.",
      }),
    });

    const unauthorizedFetch = await request(baseUrl, `/api/ideas/${startPayload.data.idea.id}`, {
      method: "GET",
    });

    if (unauthorizedFetch.status !== 401) {
      throw new Error(`Expected 401 for missing idea token, received ${unauthorizedFetch.status}`);
    }

    const badTokenFetch = await request(baseUrl, `/api/ideas/${startPayload.data.idea.id}`, {
      method: "GET",
      headers: {
        "X-Idea-Token": "bad-token",
      },
    });

    if (badTokenFetch.status !== 403) {
      throw new Error(`Expected 403 for invalid idea token, received ${badTokenFetch.status}`);
    }

    const invalidWaitlist = await request(baseUrl, "/api/waitlist", {
      method: "POST",
      body: JSON.stringify({
        ideaId: startPayload.data.idea.id,
        email: "not-an-email",
      }),
    });

    if (invalidWaitlist.status !== 400) {
      throw new Error(`Expected 400 for invalid email, received ${invalidWaitlist.status}`);
    }

    const firstSignup = await request(baseUrl, "/api/waitlist", {
      method: "POST",
      body: JSON.stringify({
        ideaId: startPayload.data.idea.id,
        email: "dup@example.com",
        interviewRequested: false,
      }),
    });

    if (firstSignup.status !== 201) {
      throw new Error(`Expected first signup to succeed, received ${firstSignup.status}`);
    }

    const duplicateSignup = await request(baseUrl, "/api/waitlist", {
      method: "POST",
      body: JSON.stringify({
        ideaId: startPayload.data.idea.id,
        email: "dup@example.com",
        interviewRequested: true,
      }),
    });

    if (duplicateSignup.status !== 409) {
      throw new Error(`Expected duplicate signup to be rejected, received ${duplicateSignup.status}`);
    }

    const signupPayload = await request(baseUrl, "/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "Security Tester",
        email: "auth-security@example.com",
        password: "password123",
      }),
    });

    if (signupPayload.status !== 201 || !signupPayload.data.requiresEmailVerification) {
      throw new Error("Expected signup to require email verification");
    }

    const blockedLogin = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "auth-security@example.com",
        password: "password123",
      }),
    });

    if (blockedLogin.status !== 403) {
      throw new Error(`Expected unverified login to be blocked, received ${blockedLogin.status}`);
    }

    console.log("Security test passed");
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
