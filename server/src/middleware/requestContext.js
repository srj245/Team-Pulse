const { randomUUID } = require("crypto");
const { logger } = require("../utils/logger");

function attachRequestContext(req, res, next) {
  const headerRequestId = String(req.headers["x-request-id"] || "").trim();
  req.requestId = headerRequestId || randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

function logRequestLifecycle(req, res, next) {
  res.on("finish", () => {
    const durationMs = Date.now() - (req.requestStartedAt || Date.now());
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("request.completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
    });
  });

  next();
}

module.exports = {
  attachRequestContext,
  logRequestLifecycle,
};
