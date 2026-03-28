function write(level, message, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "validation-engine-backend",
    message,
    ...meta,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    stack: error.stack,
    code: error.code || null,
    status: error.status || null,
  };
}

const logger = {
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  },
};

module.exports = {
  logger,
  serializeError,
};
