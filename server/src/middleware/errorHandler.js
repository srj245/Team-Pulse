const { JSON_BODY_LIMIT } = require("./validation");
const { logger, serializeError } = require("../utils/logger");

function notFoundHandler(req, res) {
  res.status(404).json({ error: "Route not found" });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: `Request payload too large. JSON bodies must be ${JSON_BODY_LIMIT} or smaller.`,
    });
  }

  const status = error.status || 500;
  const userMessage = status >= 500
    ? "Something went wrong on our side. Please try again."
    : error.message;

  if (status >= 500) {
    logger.error("request.failed", {
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      error: serializeError(error),
    });
  }

  res.status(status).json({
    error: userMessage,
    code: error.code || null,
    details: error.details || null,
    requestId: req.requestId || null,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
