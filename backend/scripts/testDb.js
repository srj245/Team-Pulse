const fs = require("fs");
const os = require("os");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

async function createTestDatabase(prefix) {
  const provider = String(process.env.DB_PROVIDER || "sqlite").trim().toLowerCase() || "sqlite";

  if (provider === "mongo") {
    const mongoServer = await MongoMemoryServer.create();
    return {
      env: {
        DB_PROVIDER: "mongo",
        MONGO_URI: mongoServer.getUri("validation_engine"),
        DATABASE_PATH: "",
      },
      cleanup: async () => {
        await mongoServer.stop();
      },
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const databasePath = path.join(tempDir, `${prefix}.db`);

  return {
    env: {
      DB_PROVIDER: "sqlite",
      DATABASE_PATH: databasePath,
    },
    cleanup: async () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

module.exports = {
  createTestDatabase,
};
