const {
  createProject,
  updateProject,
  saveArtifact,
  getArtifact,
  getProjectState,
  logAgentRun,
  assertProjectAccess,
} = require("../services/projectStore");
const { createValidationError } = require("../middleware/validation");
const { runIdeaGeneratorAgent } = require("../agents/ideaGeneratorAgent");
const { runMarketResearchAgent } = require("../agents/marketResearchAgent");
const { runDesignerAgent } = require("../agents/designerAgent");
const { runCoderAgent } = require("../agents/coderAgent");
const { runTesterAgent } = require("../agents/testerAgent");

function buildProgress(project) {
  const steps = [
    { key: "idea_generation", label: "Idea Generator" },
    { key: "idea_selection", label: "Idea Selection" },
    { key: "market_research", label: "Market Research" },
    { key: "design", label: "Design" },
    { key: "coding", label: "Coder" },
    { key: "testing", label: "Tester" },
    { key: "complete", label: "Final Package" },
  ];

  const order = steps.map((step) => step.key);
  const currentIndex = Math.max(order.indexOf(project.currentStep), 0);

  return steps.map((step, index) => ({
    ...step,
    status:
      project.currentStep === "complete"
        ? "completed"
        : index < currentIndex
        ? "completed"
        : index === currentIndex
        ? "current"
        : "pending",
  }));
}

async function buildFinalPackage(projectId) {
  const state = await getProjectState(projectId);
  return {
    project: state.project,
    progress: buildProgress(state.project),
    finalPackage: {
      idea: state.outputs.idea,
      marketResearch: state.outputs.marketResearch,
      design: state.outputs.design,
      mvpCode: state.outputs.mvpCode,
      testing: state.outputs.testing,
    },
  };
}

async function startWorkflow(userIdea) {
  const { project, accessToken } = await createProject(userIdea);
  const ideaOutput = await runIdeaGeneratorAgent(userIdea);
  await saveArtifact(project.id, "idea", ideaOutput);
  await logAgentRun(project.id, "ideaGenerator", "idea_generation", userIdea, ideaOutput);
  const updatedProject = await updateProject(project.id, {
    status: "awaiting_selection",
    currentStep: "idea_selection",
  });

  return {
    project: updatedProject,
    progress: buildProgress(updatedProject),
    idea: ideaOutput,
    accessToken,
  };
}

async function continueWorkflowFromSelection(projectId, ideaIndex, accessToken) {
  await assertProjectAccess(projectId, accessToken);
  const ideaOutput = await getArtifact(projectId, "idea");

  if (!ideaOutput || !Array.isArray(ideaOutput.ideas) || ideaOutput.ideas.length === 0) {
    throw createValidationError("No generated ideas found for this project", 409);
  }

  if (ideaIndex < 0 || ideaIndex >= ideaOutput.ideas.length) {
    throw createValidationError("Selected idea index is out of range");
  }

  const selectedIdea = ideaOutput.ideas[ideaIndex];
  await updateProject(projectId, {
    selectedIdeaIndex: ideaIndex,
    selectedIdeaTitle: selectedIdea.title,
    status: "running",
    currentStep: "market_research",
  });

  const marketResearch = await runMarketResearchAgent(selectedIdea);
  await saveArtifact(projectId, "marketResearch", marketResearch);
  await logAgentRun(projectId, "marketResearch", "market_research", selectedIdea.title, marketResearch);
  await updateProject(projectId, { currentStep: "design" });

  const design = await runDesignerAgent(selectedIdea, marketResearch);
  await saveArtifact(projectId, "design", design);
  await logAgentRun(projectId, "designer", "design", selectedIdea.title, design);
  await updateProject(projectId, { currentStep: "coding" });

  const mvpCode = await runCoderAgent(selectedIdea, design);
  await saveArtifact(projectId, "mvpCode", mvpCode);
  await logAgentRun(projectId, "coder", "coding", design.startupName, mvpCode);
  await updateProject(projectId, { currentStep: "testing" });

  const testing = await runTesterAgent(mvpCode);
  await saveArtifact(projectId, "testing", testing);
  await logAgentRun(projectId, "tester", "testing", design.startupName, testing);
  await updateProject(projectId, { currentStep: "complete", status: "completed" });

  return buildFinalPackage(projectId);
}

async function getWorkflowState(projectId, accessToken) {
  await assertProjectAccess(projectId, accessToken);
  const state = await getProjectState(projectId);

  return {
    project: state.project,
    progress: buildProgress(state.project),
    idea: state.outputs.idea,
    marketResearch: state.outputs.marketResearch,
    design: state.outputs.design,
    mvpCode: state.outputs.mvpCode,
    testing: state.outputs.testing,
  };
}

module.exports = {
  startWorkflow,
  continueWorkflowFromSelection,
  getWorkflowState,
};
