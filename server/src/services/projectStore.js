const db = require("../db");
const crypto = require("crypto");

function parseJson(value) {
  return value ? JSON.parse(value) : null;
}

function serializeProject(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userIdea: row.user_idea,
    status: row.status,
    currentStep: row.current_step,
    selectedIdeaIndex: row.selected_idea_index,
    selectedIdeaTitle: row.selected_idea_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashProjectToken(projectToken) {
  return crypto.createHash("sha256").update(projectToken).digest("hex");
}

function createProjectAccessToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function saveArtifact(projectId, artifactType, payload) {
  const payloadJson = JSON.stringify(payload);
  const existing = await db.queryOne("workflow_artifacts", {
    filter: { project_id: projectId, artifact_type: artifactType },
    projection: ["id"],
  });

  if (existing) {
    await db.update("workflow_artifacts", {
      filter: { id: existing.id },
      set: {
        payload_json: payloadJson,
        updated_at: db.now(),
      },
    });
  } else {
    await db.insert(
      "workflow_artifacts",
      {
        project_id: projectId,
        artifact_type: artifactType,
        payload_json: payloadJson,
        created_at: db.now(),
        updated_at: db.now(),
      },
      { autoId: true }
    );
  }

  return payload;
}

async function getArtifact(projectId, artifactType) {
  const row = await db.queryOne("workflow_artifacts", {
    filter: { project_id: projectId, artifact_type: artifactType },
    projection: ["payload_json"],
  });

  return row ? parseJson(row.payload_json) : null;
}

async function logAgentRun(projectId, agentName, stepName, promptExcerpt, output) {
  await db.insert(
    "agent_runs",
    {
      project_id: projectId,
      agent_name: agentName,
      step_name: stepName,
      status: "completed",
      prompt_excerpt: promptExcerpt,
      output_json: JSON.stringify(output),
      created_at: db.now(),
    },
    { autoId: true }
  );
}

async function createProject(userIdea) {
  const accessToken = createProjectAccessToken();
  const accessTokenHash = hashProjectToken(accessToken);
  const result = await db.insert(
    "startup_projects",
    {
      user_idea: userIdea,
      access_token_hash: accessTokenHash,
      status: "idea_generated",
      current_step: "idea_generation",
      selected_idea_index: null,
      selected_idea_title: null,
      created_at: db.now(),
      updated_at: db.now(),
    },
    { autoId: true }
  );

  return {
    project: await getProjectById(result.insertedId),
    accessToken,
  };
}

async function updateProject(projectId, changes) {
  const existing = await getProjectById(projectId);

  if (!existing) {
    const error = new Error("Project not found");
    error.status = 404;
    throw error;
  }

  await db.update("startup_projects", {
    filter: { id: projectId },
    set: {
      status: changes.status ?? existing.status,
      current_step: changes.currentStep ?? existing.currentStep,
      selected_idea_index: Object.prototype.hasOwnProperty.call(changes, "selectedIdeaIndex")
        ? changes.selectedIdeaIndex
        : existing.selectedIdeaIndex,
      selected_idea_title: Object.prototype.hasOwnProperty.call(changes, "selectedIdeaTitle")
        ? changes.selectedIdeaTitle
        : existing.selectedIdeaTitle,
      updated_at: db.now(),
    },
  });

  return getProjectById(projectId);
}

async function getProjectRecordById(projectId) {
  return db.queryOne("startup_projects", {
    filter: { id: projectId },
    projection: [
      "id",
      "user_idea",
      "status",
      "current_step",
      "access_token_hash",
      "selected_idea_index",
      "selected_idea_title",
      "created_at",
      "updated_at",
    ],
  });
}

async function getProjectById(projectId) {
  return serializeProject(await getProjectRecordById(projectId));
}

async function assertProjectAccess(projectId, accessToken) {
  const project = await getProjectRecordById(projectId);

  if (!project) {
    const error = new Error("Project not found");
    error.status = 404;
    throw error;
  }

  if (!accessToken) {
    const error = new Error("Project access token is required");
    error.status = 401;
    throw error;
  }

  if (hashProjectToken(accessToken) !== project.access_token_hash) {
    const error = new Error("Project access denied");
    error.status = 403;
    throw error;
  }

  return serializeProject(project);
}

async function getProjectState(projectId) {
  const project = await getProjectById(projectId);

  if (!project) {
    const error = new Error("Project not found");
    error.status = 404;
    throw error;
  }

  const [idea, marketResearch, design, mvpCode, testing] = await Promise.all([
    getArtifact(projectId, "idea"),
    getArtifact(projectId, "marketResearch"),
    getArtifact(projectId, "design"),
    getArtifact(projectId, "mvpCode"),
    getArtifact(projectId, "testing"),
  ]);

  return {
    project,
    outputs: {
      idea,
      marketResearch,
      design,
      mvpCode,
      testing,
    },
  };
}

module.exports = {
  createProject,
  updateProject,
  getProjectById,
  getProjectState,
  saveArtifact,
  getArtifact,
  logAgentRun,
  assertProjectAccess,
};
