const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const db = require("./db");
const {
  enableLegacyPlatform,
  trustProxy,
} = require("./config");
const { corsOriginValidator, globalApiLimiter } = require("./middleware/security");
const { JSON_BODY_LIMIT } = require("./middleware/validation");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { attachRequestContext, logRequestLifecycle } = require("./middleware/requestContext");
const authRoutes = require("./routes/authRoutes");
const validationRoutes = require("./routes/validationRoutes");

const app = express();

app.set("trust proxy", trustProxy);
app.use(attachRequestContext);
app.use(
  cors({
    credentials: true,
    origin: corsOriginValidator,
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);
app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);
app.use(logRequestLifecycle);

app.get("/health/live", (req, res) => {
  res.json({
    status: "ok",
    service: "validation-engine-backend",
  });
});

app.get("/health/ready", async (req, res) => {
  try {
    await db.healthcheck();
    res.json({
      status: "ok",
      service: "validation-engine-backend",
      checks: {
        database: "ok",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "validation-engine-backend",
      checks: {
        database: "error",
      },
    });
  }
});

app.use(globalApiLimiter);

app.use(validationRoutes);
app.use("/api/auth", authRoutes);

if (enableLegacyPlatform) {
  const teamRoutes = require("./routes/teamRoutes");
  const billingRoutes = require("./routes/billingRoutes");
  const adminRoutes = require("./routes/adminRoutes");

  app.use("/api/team", teamRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/admin", adminRoutes);
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
