const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..");
const nodeEnv = process.env.NODE_ENV || "development";
const isTest = nodeEnv === "test";
const isProduction = nodeEnv === "production";

function readStringEnv(name, { required = false, allowEmpty = false } = {}) {
  const value = process.env[name];
  const normalized = typeof value === "string" ? value.trim() : "";

  if (required && !allowEmpty && !normalized) {
    throw new Error(`Missing required ${name}. Set it in backend/.env before starting the server.`);
  }

  return normalized;
}

function readNumberEnv(name, fallback, { required = false } = {}) {
  const value = process.env[name];

  if (value == null || String(value).trim() === "") {
    if (required) {
      throw new Error(`Missing required ${name}. Set it in backend/.env before starting the server.`);
    }

    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}. Expected a numeric value.`);
  }

  return parsed;
}

function readBooleanEnv(name, fallback = false) {
  const value = process.env[name];

  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function readDbProviderEnv() {
  const value = readStringEnv("DB_PROVIDER").toLowerCase();

  if (!value) {
    return "sqlite";
  }

  if (!["sqlite", "mongo"].includes(value)) {
    throw new Error("Invalid DB_PROVIDER. Use sqlite or mongo.");
  }

  return value;
}

const corsOrigin = String(process.env.CORS_ORIGIN || "").trim();
const apiKey = String(process.env.API_KEY || "").trim();
const aiModel = String(
  process.env.AI_MODEL || process.env.OPENAI_MODEL || "gemini-2.5-flash"
).trim();
const tavilyApiKey = String(process.env.TAVILY_API_KEY || "").trim();
const serpApiKey = String(process.env.SERPAPI_KEY || "").trim();
const dbProvider = readDbProviderEnv();
const enableLegacyPlatform = readBooleanEnv("ENABLE_LEGACY_PLATFORM", false);
const frontendUrl = readStringEnv("FRONTEND_URL");
const publicBackendUrl = readStringEnv("BACKEND_PUBLIC_URL");
const mongoUri = readStringEnv("MONGO_URI", {
  required: dbProvider === "mongo",
});
const jwtSecret = readStringEnv("JWT_SECRET", { required: !isTest });
const stripeSecretKey = readStringEnv("STRIPE_SECRET_KEY", {
  required: enableLegacyPlatform && !isTest,
});
const stripeWebhookSecret = readStringEnv("STRIPE_WEBHOOK_SECRET", {
  required: enableLegacyPlatform && !isTest,
});
const stripePriceIdProMonthly = readStringEnv("STRIPE_PRICE_ID_PRO_MONTHLY", {
  required: enableLegacyPlatform && !isTest,
});
const smtpHost = readStringEnv("SMTP_HOST");
const smtpPort = readNumberEnv("SMTP_PORT", 587);
const smtpUser = readStringEnv("SMTP_USER");
const smtpPass = readStringEnv("SMTP_PASS");
const emailFrom = readStringEnv("EMAIL_FROM");
const adminApiKey = readStringEnv("ADMIN_API_KEY", { required: enableLegacyPlatform && !isTest });
const authCookieDomain = readStringEnv("AUTH_COOKIE_DOMAIN");
const emailVerificationTtlMinutes = readNumberEnv("EMAIL_VERIFICATION_TTL_MINUTES", 24 * 60);
const allowEmailPreview = readBooleanEnv("ALLOW_EMAIL_PREVIEW", !isProduction);
const contactToEmail = readStringEnv("CONTACT_TO_EMAIL");

function readTrustProxyEnv() {
  const value = readStringEnv("TRUST_PROXY");

  if (!value) {
    return isProduction ? 1 : 0;
  }

  const normalized = value.toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  throw new Error("Invalid TRUST_PROXY. Use true, false, or a non-negative integer.");
}

function readSameSiteEnv() {
  const value = readStringEnv("AUTH_COOKIE_SAME_SITE").toLowerCase();

  if (!value) {
    return isProduction ? "none" : "lax";
  }

  if (!["lax", "strict", "none"].includes(value)) {
    throw new Error("Invalid AUTH_COOKIE_SAME_SITE. Use lax, strict, or none.");
  }

  return value;
}

if (!isTest && !corsOrigin) {
  throw new Error(
    "Missing required CORS_ORIGIN. Set the exact frontend origin before starting the server."
  );
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  corsOrigin,
  dbProvider,
  databasePath: path.resolve(
    rootDir,
    process.env.DATABASE_PATH || "./data/startup-validation.db"
  ),
  mongoUri,
  apiKey,
  aiModel,
  tavilyApiKey,
  serpApiKey,
  enableLegacyPlatform,
  rootDir,
  nodeEnv,
  isTest,
  isProduction,
  trustProxy: readTrustProxyEnv(),
  jwtSecret,
  frontendUrl,
  publicBackendUrl,
  stripeSecretKey,
  stripeWebhookSecret,
  stripePriceIdProMonthly,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  emailFrom,
  adminApiKey,
  authCookieSameSite: readSameSiteEnv(),
  authCookieDomain,
  emailVerificationTtlMinutes,
  allowEmailPreview,
  contactToEmail,
};
