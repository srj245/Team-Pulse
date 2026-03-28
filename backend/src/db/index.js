const { dbProvider, databasePath, mongoUri, rootDir } = require("../config");
const { createMongoProvider } = require("./mongoProvider");
const { createSqliteProvider } = require("./sqliteProvider");
const { formatTimestamp, isUniqueConstraintError } = require("./shared");

let providerPromise;

function buildProvider() {
  if (dbProvider === "mongo") {
    return createMongoProvider({
      mongoUri,
    });
  }

  return createSqliteProvider({
    databasePath,
    rootDir,
  });
}

async function getProvider() {
  if (!providerPromise) {
    providerPromise = Promise.resolve(buildProvider());
  }

  return providerPromise;
}

function createFacade(resolver) {
  return {
    now: formatTimestamp,
    queryOne: async (...args) => (await resolver()).queryOne(...args),
    queryMany: async (...args) => (await resolver()).queryMany(...args),
    insert: async (...args) => (await resolver()).insert(...args),
    update: async (...args) => (await resolver()).update(...args),
    delete: async (...args) => (await resolver()).delete(...args),
    count: async (...args) => (await resolver()).count(...args),
    healthcheck: async () => (await resolver()).healthcheck(),
    transaction: async (operation) => {
      const provider = await resolver();
      return provider.transaction(async (transactionProvider) =>
        operation(createFacade(() => Promise.resolve(transactionProvider)))
      );
    },
    isUniqueConstraintError,
  };
}

const db = createFacade(getProvider);

async function closeDatabase() {
  if (!providerPromise) {
    return;
  }

  const provider = await providerPromise;
  providerPromise = null;
  await provider.close();
}

module.exports = db;
module.exports.closeDatabase = closeDatabase;
