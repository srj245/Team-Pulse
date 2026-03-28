"use strict";

const AUTO_ID_COLLECTIONS = new Set([
  "users",
  "teams",
  "memberships",
  "checkins",
  "alerts",
  "invitations",
  "billing_events",
  "ideas",
  "research",
  "hypotheses",
  "landing_pages",
  "waitlist",
  "decision_reports",
  "startup_projects",
  "workflow_artifacts",
  "agent_runs",
]);

const PRIMARY_KEY_FIELDS = {
  analytics: ["idea_id"],
  workflow_artifacts: ["project_id", "artifact_type"],
};

const SQLITE_COMPAT_SCHEMA = `
CREATE TABLE IF NOT EXISTS startup_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_idea TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea_generated',
  current_step TEXT NOT NULL DEFAULT 'idea_generation',
  selected_idea_index INTEGER,
  selected_idea_title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, artifact_type)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  prompt_excerpt TEXT,
  output_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_project_id ON workflow_artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON agent_runs(project_id);
`;

const MONGO_INDEX_SPECS = [
  { collection: "users", index: { id: 1 }, options: { unique: true } },
  { collection: "users", index: { email: 1 }, options: { unique: true } },
  { collection: "users", index: { plan: 1 }, options: {} },
  { collection: "teams", index: { id: 1 }, options: { unique: true } },
  { collection: "teams", index: { invite_code: 1 }, options: { unique: true } },
  { collection: "teams", index: { created_by: 1 }, options: {} },
  { collection: "memberships", index: { id: 1 }, options: { unique: true } },
  { collection: "memberships", index: { user_id: 1 }, options: {} },
  { collection: "memberships", index: { team_id: 1 }, options: {} },
  { collection: "memberships", index: { user_id: 1, team_id: 1 }, options: { unique: true } },
  { collection: "checkins", index: { id: 1 }, options: { unique: true } },
  { collection: "checkins", index: { team_id: 1 }, options: {} },
  { collection: "checkins", index: { user_id: 1 }, options: {} },
  { collection: "alerts", index: { id: 1 }, options: { unique: true } },
  { collection: "alerts", index: { team_id: 1, status: 1 }, options: {} },
  { collection: "invitations", index: { id: 1 }, options: { unique: true } },
  { collection: "invitations", index: { team_id: 1 }, options: {} },
  { collection: "billing_events", index: { id: 1 }, options: { unique: true } },
  { collection: "billing_events", index: { user_id: 1 }, options: {} },
  { collection: "ideas", index: { id: 1 }, options: { unique: true } },
  { collection: "ideas", index: { slug: 1 }, options: { unique: true } },
  { collection: "ideas", index: { status: 1 }, options: {} },
  { collection: "research", index: { id: 1 }, options: { unique: true } },
  { collection: "research", index: { idea_id: 1 }, options: {} },
  { collection: "hypotheses", index: { id: 1 }, options: { unique: true } },
  { collection: "hypotheses", index: { idea_id: 1 }, options: { unique: true } },
  { collection: "landing_pages", index: { id: 1 }, options: { unique: true } },
  { collection: "landing_pages", index: { idea_id: 1 }, options: { unique: true } },
  { collection: "landing_pages", index: { slug: 1 }, options: { unique: true } },
  { collection: "waitlist", index: { id: 1 }, options: { unique: true } },
  { collection: "waitlist", index: { idea_id: 1 }, options: {} },
  { collection: "waitlist", index: { idea_id: 1, email: 1 }, options: { unique: true } },
  { collection: "analytics", index: { idea_id: 1 }, options: { unique: true } },
  { collection: "decision_reports", index: { id: 1 }, options: { unique: true } },
  { collection: "decision_reports", index: { idea_id: 1 }, options: { unique: true } },
  { collection: "startup_projects", index: { id: 1 }, options: { unique: true } },
  { collection: "workflow_artifacts", index: { id: 1 }, options: { unique: true } },
  {
    collection: "workflow_artifacts",
    index: { project_id: 1, artifact_type: 1 },
    options: { unique: true },
  },
  { collection: "agent_runs", index: { id: 1 }, options: { unique: true } },
  { collection: "agent_runs", index: { project_id: 1 }, options: {} },
];

function formatTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getProjectionFields(projection) {
  if (!projection) {
    return null;
  }

  if (Array.isArray(projection)) {
    return projection;
  }

  if (typeof projection === "object") {
    return Object.keys(projection).filter((field) => projection[field]);
  }

  return null;
}

function getPrimaryKeyFields(collectionName) {
  return PRIMARY_KEY_FIELDS[collectionName] || ["id"];
}

function stripMongoId(document) {
  if (!document) {
    return null;
  }

  const { _id, ...rest } = document;
  return rest;
}

function stripMongoIds(documents) {
  return documents.map(stripMongoId);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUniqueConstraintError(error) {
  const message = String(error?.message || "");
  return error?.code === 11000 || message.includes("UNIQUE");
}

function getMongoDatabaseName(mongoUri) {
  try {
    const url = new URL(mongoUri);
    const pathname = String(url.pathname || "").replace(/^\/+/, "");
    return pathname || "validation_engine";
  } catch (error) {
    return "validation_engine";
  }
}

module.exports = {
  AUTO_ID_COLLECTIONS,
  MONGO_INDEX_SPECS,
  PRIMARY_KEY_FIELDS,
  SQLITE_COMPAT_SCHEMA,
  formatTimestamp,
  getProjectionFields,
  getPrimaryKeyFields,
  getMongoDatabaseName,
  isPlainObject,
  isUniqueConstraintError,
  stripMongoId,
  stripMongoIds,
};
