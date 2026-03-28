const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const {
  corsOrigin,
  frontendUrl,
  jwtSecret,
  isProduction,
  nodeEnv,
  authCookieSameSite,
  authCookieDomain,
  emailVerificationTtlMinutes,
} = require("../config");
const { getUserTeams } = require("./teamService");
const { getUsageForUser } = require("./planService");
const { sendVerificationEmail, sendWelcomeEmail } = require("./emailService");
const { logger, serializeError } = require("../utils/logger");

const AUTH_COOKIE_NAME = "teampulse_auth";
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function createToken(user) {
  return jwt.sign({ email: user.email }, jwtSecret, {
    subject: String(user.id),
    expiresIn: "7d",
  });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name || "",
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    emailVerifiedAt: user.email_verified_at || null,
    plan: user.plan,
    billingStatus: user.billing_status,
    onboardingCompleted: Boolean(user.onboarding_completed),
    createdAt: user.created_at,
  };
}

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction || authCookieSameSite === "none",
    sameSite: authCookieSameSite,
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  };
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
  });
}

function setAuthCookie(res, req, user) {
  res.cookie(AUTH_COOKIE_NAME, createToken(user), getAuthCookieOptions());
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getPublicFrontendUrl(req) {
  if (frontendUrl) {
    return frontendUrl.replace(/\/$/, "");
  }

  const firstAllowedOrigin = String(corsOrigin || "")
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  if (firstAllowedOrigin) {
    return firstAllowedOrigin.replace(/\/$/, "");
  }

  if (req?.headers?.origin) {
    return String(req.headers.origin).replace(/\/$/, "");
  }

  return "http://localhost:8080";
}

function buildVerificationUrl(req, token) {
  const baseUrl = getPublicFrontendUrl(req);
  return `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

function parseSqliteTimestamp(value) {
  if (!value) {
    return null;
  }

  return new Date(String(value).replace(" ", "T") + "Z");
}

function isVerificationWindowExpired(sentAt) {
  const sentAtDate = parseSqliteTimestamp(sentAt);

  if (!sentAtDate || Number.isNaN(sentAtDate.getTime())) {
    return true;
  }

  return Date.now() - sentAtDate.getTime() > emailVerificationTtlMinutes * 60 * 1000;
}

async function getProfilePayload(user) {
  const [teams, planAccess] = await Promise.all([getUserTeams(user.id), getUsageForUser(user.id)]);

  return {
    user: sanitizeUser(user),
    teams,
    planAccess,
  };
}

function getVerificationResponse(user, verificationUrl) {
  return {
    user: sanitizeUser(user),
    requiresEmailVerification: !Boolean(user.email_verified),
    message: "Account created. Verify your email before signing in.",
    ...(nodeEnv !== "production" ? { developmentVerificationUrl: verificationUrl } : {}),
  };
}

async function getUserById(userId, projection = null) {
  return db.queryOne("users", {
    filter: { id: userId },
    projection:
      projection || [
        "id",
        "name",
        "email",
        "email_verified",
        "email_verified_at",
        "plan",
        "billing_status",
        "onboarding_completed",
        "created_at",
      ],
  });
}

async function signupUser(name, email, password, req, res) {
  const existingUser = await db.queryOne("users", {
    filter: { email },
    projection: ["id"],
  });

  if (existingUser) {
    const error = new Error("Email is already registered");
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = generateVerificationToken();
  const verificationTokenHash = hashVerificationToken(verificationToken);
  const now = db.now();
  const result = await db.insert(
    "users",
    {
      name: name || "",
      email,
      password_hash: passwordHash,
      email_verified: 0,
      email_verification_token_hash: verificationTokenHash,
      email_verification_sent_at: now,
      email_verified_at: null,
      last_login_at: null,
      plan: "free",
      billing_status: "inactive",
      onboarding_completed: 0,
      stripe_customer_id: null,
      welcome_email_sent_at: null,
      created_at: now,
      updated_at: now,
    },
    { autoId: true }
  );

  const user = await getUserById(result.insertedId);
  const verificationUrl = buildVerificationUrl(req, verificationToken);

  try {
    await sendVerificationEmail({
      email: user.email,
      verificationUrl,
    });
  } catch (error) {
    await db.delete("users", {
      filter: { id: user.id },
    });
    logger.error("auth.signup_email_failed", {
      userId: user.id,
      email: user.email,
      error: serializeError(error),
    });
    throw error;
  }

  return getVerificationResponse(user, verificationUrl);
}

async function loginUser(email, password, req, res) {
  const user = await db.queryOne("users", {
    filter: { email },
    projection: [
      "id",
      "name",
      "email",
      "password_hash",
      "email_verified",
      "email_verified_at",
      "plan",
      "billing_status",
      "onboarding_completed",
      "created_at",
    ],
  });

  if (!user) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  if (!user.email_verified) {
    const error = new Error("Verify your email before signing in");
    error.status = 403;
    throw error;
  }

  await db.update("users", {
    filter: { id: user.id },
    set: {
      last_login_at: db.now(),
      updated_at: db.now(),
    },
  });

  setAuthCookie(res, req, user);

  return {
    ...(await getProfilePayload(user)),
    authToken: createToken(user),
  };
}

function logoutUser(req, res) {
  clearAuthCookie(res);
}

async function getCurrentUserProfile(userId) {
  const user = await getUserById(userId);

  if (!user) {
    const error = new Error("Invalid or expired token");
    error.status = 401;
    throw error;
  }

  return getProfilePayload(user);
}

async function verifyUserEmail(token, req, res) {
  const tokenHash = hashVerificationToken(token);
  const user = await db.queryOne("users", {
    filter: { email_verification_token_hash: tokenHash },
    projection: [
      "id",
      "name",
      "email",
      "email_verified",
      "email_verified_at",
      "email_verification_sent_at",
      "plan",
      "billing_status",
      "onboarding_completed",
      "created_at",
    ],
  });

  if (!user) {
    const error = new Error("Verification link is invalid or expired");
    error.status = 400;
    throw error;
  }

  if (isVerificationWindowExpired(user.email_verification_sent_at)) {
    await db.update("users", {
      filter: { id: user.id },
      set: {
        email_verification_token_hash: null,
        email_verification_sent_at: null,
        updated_at: db.now(),
      },
    });

    const error = new Error("Verification link is invalid or expired");
    error.status = 400;
    throw error;
  }

  await db.update("users", {
    filter: { id: user.id },
    set: {
      email_verified: 1,
      email_verified_at: db.now(),
      email_verification_token_hash: null,
      updated_at: db.now(),
    },
  });

  const verifiedUser = await getUserById(user.id);
  setAuthCookie(res, req, verifiedUser);

  sendWelcomeEmail(verifiedUser.email).catch((error) => {
    logger.error("auth.welcome_email_failed", {
      userId: verifiedUser.id,
      email: verifiedUser.email,
      error: serializeError(error),
    });
  });

  return {
    ...(await getProfilePayload(verifiedUser)),
    authToken: createToken(verifiedUser),
    message: "Email verified. You are now signed in.",
  };
}

async function resendVerificationEmail(email, req) {
  const user = await getUserById(
    (
      await db.queryOne("users", {
        filter: { email },
        projection: ["id"],
      })
    )?.id,
    [
      "id",
      "name",
      "email",
      "email_verified",
      "email_verified_at",
      "plan",
      "billing_status",
      "onboarding_completed",
      "created_at",
    ]
  );

  if (!user || user.email_verified) {
    return {
      message: "If the account exists and still needs verification, a fresh link has been sent.",
    };
  }

  const verificationToken = generateVerificationToken();
  const verificationTokenHash = hashVerificationToken(verificationToken);
  const verificationUrl = buildVerificationUrl(req, verificationToken);

  await db.update("users", {
    filter: { id: user.id },
    set: {
      email_verification_token_hash: verificationTokenHash,
      email_verification_sent_at: db.now(),
      updated_at: db.now(),
    },
  });

  await sendVerificationEmail({
    email: user.email,
    verificationUrl,
  });

  return {
    message: "If the account exists and still needs verification, a fresh link has been sent.",
    ...(nodeEnv !== "production" ? { developmentVerificationUrl: verificationUrl } : {}),
  };
}

async function updateUserProfile(userId, { name }) {
  await db.update("users", {
    filter: { id: userId },
    set: {
      name: name || "",
      updated_at: db.now(),
    },
  });

  return getCurrentUserProfile(userId);
}

async function completeUserOnboarding(userId) {
  await db.update("users", {
    filter: { id: userId },
    set: {
      onboarding_completed: 1,
      updated_at: db.now(),
    },
  });

  return getCurrentUserProfile(userId);
}

module.exports = {
  signupUser,
  loginUser,
  verifyUserEmail,
  resendVerificationEmail,
  logoutUser,
  getCurrentUserProfile,
  updateUserProfile,
  completeUserOnboarding,
};
