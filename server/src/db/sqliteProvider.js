"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const {
  SQLITE_COMPAT_SCHEMA,
  formatTimestamp,
  getPrimaryKeyFields,
  getProjectionFields,
  isPlainObject,
} = require("./shared");

function buildWhereClause(filter = {}, params = []) {
  const clauses = [];

  for (const [field, value] of Object.entries(filter || {})) {
    if (field === "$or" || field === "$and") {
      const subClauses = (Array.isArray(value) ? value : [])
        .map((entry) => {
          const nested = buildWhereClause(entry, params);
          return nested.clause ? `(${nested.clause})` : "";
        })
        .filter(Boolean);

      if (subClauses.length) {
        clauses.push(subClauses.join(field === "$or" ? " OR " : " AND "));
      }

      continue;
    }

    if (isPlainObject(value)) {
      const operators = [];

      for (const [operator, operatorValue] of Object.entries(value)) {
        if (operator === "$in") {
          const items = Array.isArray(operatorValue) ? operatorValue : [];

          if (!items.length) {
            operators.push("1 = 0");
            continue;
          }

          operators.push(`${field} IN (${items.map(() => "?").join(", ")})`);
          params.push(...items);
          continue;
        }

        if (operator === "$gte") {
          operators.push(`${field} >= ?`);
          params.push(operatorValue);
          continue;
        }

        if (operator === "$gt") {
          operators.push(`${field} > ?`);
          params.push(operatorValue);
          continue;
        }

        if (operator === "$lte") {
          operators.push(`${field} <= ?`);
          params.push(operatorValue);
          continue;
        }

        if (operator === "$lt") {
          operators.push(`${field} < ?`);
          params.push(operatorValue);
          continue;
        }

        if (operator === "$ne") {
          operators.push(`${field} != ?`);
          params.push(operatorValue);
          continue;
        }

        if (operator === "$exists") {
          operators.push(`${field} IS ${operatorValue ? "NOT NULL" : "NULL"}`);
        }
      }

      if (operators.length) {
        clauses.push(operators.join(" AND "));
      }

      continue;
    }

    if (value == null) {
      clauses.push(`${field} IS NULL`);
      continue;
    }

    clauses.push(`${field} = ?`);
    params.push(value);
  }

  return {
    clause: clauses.filter(Boolean).join(" AND "),
    params,
  };
}

function buildOrderClause(sort) {
  const entries = Object.entries(sort || {});

  if (!entries.length) {
    return "";
  }

  return ` ORDER BY ${entries
    .map(([field, direction]) => `${field} ${direction === -1 ? "DESC" : "ASC"}`)
    .join(", ")}`;
}

function buildProjectionClause(projection) {
  const fields = getProjectionFields(projection);

  if (!fields || !fields.length) {
    return "*";
  }

  return fields.join(", ");
}

function buildIdentityFilter(collectionName, row) {
  const identityFilter = {};

  for (const field of getPrimaryKeyFields(collectionName)) {
    identityFilter[field] = row[field];
  }

  return identityFilter;
}

function createSqliteProvider({ databasePath, rootDir }) {
  const schemaPath = path.join(rootDir, "schema.sql");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  db.exec(SQLITE_COMPAT_SCHEMA);

  function runSelect(collectionName, options = {}) {
    const params = [];
    const where = buildWhereClause(options.filter, params);
    const projection = buildProjectionClause(options.projection);
    const order = buildOrderClause(options.sort);
    const limit = Number.isInteger(options.limit) ? ` LIMIT ${options.limit}` : "";
    const offset = Number.isInteger(options.skip) ? ` OFFSET ${options.skip}` : "";
    const sql =
      `SELECT ${projection} FROM ${collectionName}` +
      (where.clause ? ` WHERE ${where.clause}` : "") +
      order +
      limit +
      offset;

    return db.prepare(sql);
  }

  function queryOne(collectionName, options = {}) {
    return runSelect(collectionName, { ...options, limit: 1 }).get(...buildWhereClause(options.filter, []).params);
  }

  function queryMany(collectionName, options = {}) {
    return runSelect(collectionName, options).all(...buildWhereClause(options.filter, []).params);
  }

  function insert(collectionName, value, options = {}) {
    const documents = Array.isArray(value) ? value : [value];
    const insertedIds = [];

    for (const document of documents) {
      const fields = Object.keys(document);
      const placeholders = fields.map(() => "?").join(", ");
      const statement = db.prepare(
        `INSERT INTO ${collectionName} (${fields.join(", ")}) VALUES (${placeholders})`
      );
      const result = statement.run(...fields.map((field) => document[field]));
      const explicitId = Object.prototype.hasOwnProperty.call(document, "id") ? document.id : undefined;
      insertedIds.push(explicitId ?? result.lastInsertRowid ?? null);
    }

    return {
      insertedId: insertedIds.length === 1 ? insertedIds[0] : null,
      insertedIds,
    };
  }

  function update(collectionName, options = {}) {
    const {
      filter = {},
      sort,
      set = {},
      unset = {},
      inc = {},
      many = false,
      returnDocument = "none",
    } = options;

    const targets = many
      ? queryMany(collectionName, { filter, sort })
      : (() => {
          const row = queryOne(collectionName, { filter, sort });
          return row ? [row] : [];
        })();

    if (!targets.length) {
      return {
        matchedCount: 0,
        modifiedCount: 0,
        value: null,
      };
    }

    let modifiedCount = 0;
    let finalValue = null;

    for (const target of targets) {
      const assignments = [];
      const params = [];

      for (const [field, value] of Object.entries(set)) {
        assignments.push(`${field} = ?`);
        params.push(value);
      }

      for (const field of Object.keys(unset)) {
        assignments.push(`${field} = NULL`);
      }

      for (const [field, value] of Object.entries(inc)) {
        assignments.push(`${field} = COALESCE(${field}, 0) + ?`);
        params.push(value);
      }

      if (!assignments.length) {
        continue;
      }

      const identityFilter = buildIdentityFilter(collectionName, target);
      const where = buildWhereClause(identityFilter, []);
      const result = db
        .prepare(`UPDATE ${collectionName} SET ${assignments.join(", ")} WHERE ${where.clause}`)
        .run(...params, ...where.params);
      modifiedCount += result.changes || 0;

      if (!many && returnDocument === "after") {
        finalValue = queryOne(collectionName, { filter: identityFilter });
      }
    }

    if (!many && returnDocument === "before") {
      finalValue = targets[0];
    }

    return {
      matchedCount: targets.length,
      modifiedCount,
      value: finalValue,
    };
  }

  function remove(collectionName, options = {}) {
    const { filter = {}, many = false, sort } = options;

    if (many) {
      const where = buildWhereClause(filter, []);
      const result = db
        .prepare(`DELETE FROM ${collectionName}${where.clause ? ` WHERE ${where.clause}` : ""}`)
        .run(...where.params);
      return {
        deletedCount: result.changes || 0,
      };
    }

    const target = queryOne(collectionName, { filter, sort });

    if (!target) {
      return {
        deletedCount: 0,
      };
    }

    const identityFilter = buildIdentityFilter(collectionName, target);
    const where = buildWhereClause(identityFilter, []);
    const result = db
      .prepare(`DELETE FROM ${collectionName} WHERE ${where.clause}`)
      .run(...where.params);

    return {
      deletedCount: result.changes || 0,
    };
  }

  function count(collectionName, options = {}) {
    const where = buildWhereClause(options.filter, []);
    const row = db
      .prepare(`SELECT COUNT(*) AS total FROM ${collectionName}${where.clause ? ` WHERE ${where.clause}` : ""}`)
      .get(...where.params);
    return row?.total || 0;
  }

  async function transaction(operation) {
    db.exec("BEGIN");

    try {
      const result = await operation(provider);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async function healthcheck() {
    db.prepare("SELECT 1 AS ok").get();
    return true;
  }

  async function close() {
    db.close();
  }

  const provider = {
    name: "sqlite",
    now: formatTimestamp,
    queryOne: async (collectionName, options) => queryOne(collectionName, options),
    queryMany: async (collectionName, options) => queryMany(collectionName, options),
    insert: async (collectionName, value, options) => insert(collectionName, value, options),
    update: async (collectionName, options) => update(collectionName, options),
    delete: async (collectionName, options) => remove(collectionName, options),
    count: async (collectionName, options) => count(collectionName, options),
    transaction,
    healthcheck,
    close,
  };

  return provider;
}

module.exports = {
  createSqliteProvider,
};
