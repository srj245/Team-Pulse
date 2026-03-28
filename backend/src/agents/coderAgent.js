const { generateStructuredOutput } = require("../services/aiService");

function fallbackMvpCode(design) {
  return {
    stack: {
      frontend: "React + Vite frontend",
      backend: "Node.js + Express API",
      storage: "SQLite",
    },
    coreFeatures: [
      "Idea input and project creation",
      "Idea shortlist and idea selection",
      "Sequential multi-agent orchestration",
      "Final startup package rendering",
    ],
    frontendFiles: {
      "frontend/src/pages/Landing.jsx":
        "// Landing page with product narrative, navigation, and deployment-oriented calls to action",
      "frontend/src/pages/Dashboard.jsx":
        "// Workflow dashboard showing current validation state, metrics, and research cards",
    },
    backendFiles: {
      "backend/src/routes/workflowRoutes.js":
        "// Routes for starting projects, selecting an idea, and loading workflow state",
      "backend/src/workflow/startupWorkflow.js":
        "// Orchestrates sequential agent execution and persists outputs",
    },
    implementationNotes: [
      "Keep routes thin and put orchestration in a dedicated workflow module.",
      "Persist every agent output so the user can refresh and resume the flow.",
      "Return generated code snippets as part of the final package payload.",
    ],
  };
}

async function runCoderAgent(selectedIdea, design) {
  return generateStructuredOutput({
    systemPrompt:
      "You are the Coder Agent. Produce an MVP implementation plan and lightweight code package details for a startup builder.",
    userPrompt: `Selected idea:\n${JSON.stringify(selectedIdea, null, 2)}\n\nDesign:\n${JSON.stringify(design, null, 2)}`,
    schemaDescription:
      "{ stack: { frontend: string, backend: string, storage: string }, coreFeatures: string[], frontendFiles: object, backendFiles: object, implementationNotes: string[] }",
    fallback: () => fallbackMvpCode(design),
  });
}

module.exports = {
  runCoderAgent,
};
