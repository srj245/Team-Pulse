"use strict";

const { MongoClient } = require("mongodb");
const {
  AUTO_ID_COLLECTIONS,
  MONGO_INDEX_SPECS,
  formatTimestamp,
  getMongoDatabaseName,
  getProjectionFields,
  isPlainObject,
  stripMongoId,
  stripMongoIds,
} = require("./shared");

function toMongoProjection(projection) {
  const fields = getProjectionFields(projection);

  if (!fields || !fields.length) {
    return { _id: 0 };
  }

  return fields.reduce(
    (result, field) => ({
      ...result,
      [field]: 1,
      _id: 0,
    }),
    {}
  );
}

function toMongoUpdate(options = {}) {
  const update = {};

  if (options.set && Object.keys(options.set).length) {
    update.$set = options.set;
  }

  if (options.unset && Object.keys(options.unset).length) {
    update.$unset = Object.keys(options.unset).reduce(
      (result, field) => ({
        ...result,
        [field]: 1,
      }),
      {}
    );
  }

  if (options.inc && Object.keys(options.inc).length) {
    update.$inc = options.inc;
  }

  return update;
}

function toUpsertDocument(filter = {}, options = {}) {
  const document = {};

  for (const [field, value] of Object.entries(filter)) {
    if (!isPlainObject(value)) {
      document[field] = value;
    }
  }

  return {
    ...document,
    ...(options.setOnInsert || {}),
    ...(options.set || {}),
  };
}

async function ensureIndexes(database) {
  for (const spec of MONGO_INDEX_SPECS) {
    await database.collection(spec.collection).createIndex(spec.index, spec.options);
  }
}

function createMongoProvider({ mongoUri }) {
  const client = new MongoClient(mongoUri);
  const databaseName = getMongoDatabaseName(mongoUri);
  let database;

  async function connect() {
    if (database) {
      return database;
    }

    await client.connect();
    database = client.db(databaseName);
    await ensureIndexes(database);
    return database;
  }

  async function collection(name) {
    const connected = await connect();
    return connected.collection(name);
  }

  async function nextSequence(name) {
    const counters = await collection("__counters");
    const result = await counters.findOneAndUpdate(
      { _id: name },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: "after" }
    );

    return result.sequence;
  }

  async function assignId(collectionName, document, options = {}) {
    if (!AUTO_ID_COLLECTIONS.has(collectionName)) {
      return { ...document };
    }

    if (!options.autoId && Object.prototype.hasOwnProperty.call(document, "id")) {
      return { ...document };
    }

    if (Object.prototype.hasOwnProperty.call(document, "id")) {
      return { ...document };
    }

    return {
      ...document,
      id: await nextSequence(collectionName),
    };
  }

  async function queryOne(collectionName, options = {}) {
    const target = await collection(collectionName);
    const document = await target.findOne(options.filter || {}, {
      projection: toMongoProjection(options.projection),
      sort: options.sort,
    });

    return stripMongoId(document);
  }

  async function queryMany(collectionName, options = {}) {
    const target = await collection(collectionName);
    let cursor = target.find(options.filter || {}, {
      projection: toMongoProjection(options.projection),
      sort: options.sort,
    });

    if (Number.isInteger(options.skip)) {
      cursor = cursor.skip(options.skip);
    }

    if (Number.isInteger(options.limit)) {
      cursor = cursor.limit(options.limit);
    }

    const documents = await cursor.toArray();
    return stripMongoIds(documents);
  }

  async function insert(collectionName, value, options = {}) {
    const target = await collection(collectionName);
    const documents = Array.isArray(value) ? value : [value];
    const preparedDocuments = [];

    for (const document of documents) {
      preparedDocuments.push(await assignId(collectionName, document, options));
    }

    if (preparedDocuments.length === 1) {
      await target.insertOne(preparedDocuments[0], { session: options.session });
      return {
        insertedId: preparedDocuments[0].id ?? null,
        insertedIds: [preparedDocuments[0].id ?? null],
      };
    }

    await target.insertMany(preparedDocuments, { session: options.session });
    return {
      insertedId: null,
      insertedIds: preparedDocuments.map((document) => document.id ?? null),
    };
  }

  async function update(collectionName, options = {}) {
    const target = await collection(collectionName);
    const {
      filter = {},
      sort,
      many = false,
      returnDocument = "none",
      upsert = false,
      session,
    } = options;
    const update = toMongoUpdate(options);

    if (many) {
      const result = await target.updateMany(filter, update, { session, upsert });
      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        value: null,
      };
    }

    const existing = await target.findOne(filter, { sort, session });

    if (!existing && !upsert) {
      return {
        matchedCount: 0,
        modifiedCount: 0,
        value: null,
      };
    }

    if (!existing && upsert) {
      const document = await assignId(collectionName, toUpsertDocument(filter, options), options);
      await target.insertOne(document, { session });
      return {
        matchedCount: 0,
        modifiedCount: 0,
        value: returnDocument === "after" ? document : null,
      };
    }

    const before = stripMongoId(existing);
    await target.updateOne({ _id: existing._id }, update, { session });
    const after =
      returnDocument === "after"
        ? stripMongoId(await target.findOne({ _id: existing._id }, { session }))
        : null;

    return {
      matchedCount: 1,
      modifiedCount: 1,
      value: returnDocument === "before" ? before : after,
    };
  }

  async function remove(collectionName, options = {}) {
    const target = await collection(collectionName);
    const { filter = {}, many = false, sort, session } = options;

    if (many) {
      const result = await target.deleteMany(filter, { session });
      return {
        deletedCount: result.deletedCount,
      };
    }

    const existing = await target.findOne(filter, { sort, session });

    if (!existing) {
      return {
        deletedCount: 0,
      };
    }

    const result = await target.deleteOne({ _id: existing._id }, { session });
    return {
      deletedCount: result.deletedCount,
    };
  }

  async function count(collectionName, options = {}) {
    const target = await collection(collectionName);
    return target.countDocuments(options.filter || {});
  }

  async function transaction(operation) {
    const session = client.startSession();

    try {
      let result;
      let usedTransaction = false;

      try {
        await session.withTransaction(async () => {
          usedTransaction = true;
          result = await operation({
            name: "mongo",
            now: formatTimestamp,
            queryOne: (collectionName, options = {}) =>
              queryOne(collectionName, { ...options, session }),
            queryMany: (collectionName, options = {}) =>
              queryMany(collectionName, { ...options, session }),
            insert: (collectionName, value, options = {}) =>
              insert(collectionName, value, { ...options, session }),
            update: (collectionName, options = {}) =>
              update(collectionName, { ...options, session }),
            delete: (collectionName, options = {}) =>
              remove(collectionName, { ...options, session }),
            count: (collectionName, options = {}) =>
              count(collectionName, { ...options, session }),
            transaction,
            healthcheck,
            close,
          });
        });
      } catch (error) {
        const message = String(error?.message || "");

        if (
          message.includes("Transaction numbers are only allowed") ||
          message.includes("replica set") ||
          message.includes("standalone")
        ) {
          usedTransaction = false;
          result = await operation(provider);
        } else {
          throw error;
        }
      }

      return result;
    } finally {
      await session.endSession();
    }
  }

  async function healthcheck() {
    const connected = await connect();
    await connected.command({ ping: 1 });
    return true;
  }

  async function close() {
    await client.close();
  }

  const provider = {
    name: "mongo",
    now: formatTimestamp,
    queryOne,
    queryMany,
    insert,
    update,
    delete: remove,
    count,
    transaction,
    healthcheck,
    close,
  };

  return provider;
}

module.exports = {
  createMongoProvider,
};
