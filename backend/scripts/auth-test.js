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
  const port = 4175;
  const baseUrl = `http://127.0.0.1:${port}`;
  const database = await createTestDatabase("validation-engine-auth");

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

    const signup = await request(baseUrl, "/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "Ayush",
        email: "ayush@example.com",
        password: "password123",
      }),
    });

    if (signup.status !== 201 || !signup.data.requiresEmailVerification) {
      throw new Error("Expected signup to require email verification");
    }

    if (!signup.data.developmentVerificationUrl) {
      throw new Error("Expected a development verification URL");
    }

    const verifyUrl = new URL(signup.data.developmentVerificationUrl);
    const token = verifyUrl.searchParams.get("token");

    if (!token) {
      throw new Error("Expected signup response to include a verification token");
    }

    const blockedLogin = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "ayush@example.com",
        password: "password123",
      }),
    });

    if (blockedLogin.status !== 403) {
      throw new Error("Expected login to be blocked before email verification");
    }

    const verify = await request(baseUrl, `/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });

    if (verify.status !== 200 || !verify.data.authToken || !verify.data.user?.emailVerified) {
      throw new Error("Expected verify-email to sign the user in and mark the email verified");
    }

    const profile = await request(baseUrl, "/api/auth/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${verify.data.authToken}`,
      },
    });

    if (profile.status !== 200 || profile.data.user?.name !== "Ayush") {
      throw new Error("Expected profile endpoint to return the signed-in user");
    }

    const updateProfile = await request(baseUrl, "/api/auth/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${verify.data.authToken}`,
      },
      body: JSON.stringify({
        name: "Ayush Singh",
      }),
    });

    if (updateProfile.status !== 200 || updateProfile.data.user?.name !== "Ayush Singh") {
      throw new Error("Expected profile update to persist the new name");
    }

    const login = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "ayush@example.com",
        password: "password123",
      }),
    });

    if (login.status !== 200 || !login.data.authToken) {
      throw new Error("Expected verified user login to return an auth token");
    }

    console.log("Auth test passed");
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
