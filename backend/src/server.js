const app = require("./app");
const { port } = require("./config");
const { closeDatabase } = require("./db");

const server = app.listen(port, () => {
  console.log(`AI Startup Validation Engine backend listening on port ${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    closeDatabase()
      .catch((error) => {
        console.error("Failed to close database cleanly", error);
      })
      .finally(() => {
        process.exit(0);
      });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
