const rateLimit = require("express-rate-limit");
const { corsOrigin } = require("../config");

const RATE_LIMIT_ERROR = "Too many requests. Please try again later.";
const allowedOrigins = corsOrigin
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function corsOriginValidator(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  const error = new Error("Origin not allowed by CORS");
  error.status = 403;
  return callback(error);
}

function buildRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: RATE_LIMIT_ERROR },
  });
}

const globalApiLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const authLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
});

const workflowStartLimiter = buildRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
});

const publicWriteLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
});

const contactLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

module.exports = {
  allowedOrigins,
  corsOriginValidator,
  globalApiLimiter,
  authLimiter,
  workflowStartLimiter,
  publicWriteLimiter,
  contactLimiter,
};
