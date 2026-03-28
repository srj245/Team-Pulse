const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  validateIdeaSubmission,
  validateIdeaSelection,
  validateProjectIdParam,
} = require("../middleware/validation");
const {
  startWorkflow,
  continueWorkflowFromSelection,
  getWorkflowState,
} = require("../workflow/startupWorkflow");

const router = express.Router();

function getProjectAccessToken(req) {
  return String(req.headers["x-project-token"] || req.body?.accessToken || "").trim();
}

router.get("/health", (req, res) => {
  res.json({ status: "ok", product: "multi-agent-startup-builder" });
});

router.post(
  "/api/workflow/start",
  validateIdeaSubmission,
  asyncHandler(async (req, res) => {
    const { userIdea } = req.validated;
    const result = await startWorkflow(userIdea);
    return res.status(201).json(result);
  })
);

router.post(
  "/api/workflow/select-idea",
  validateIdeaSelection,
  asyncHandler(async (req, res) => {
    const { projectId, ideaIndex } = req.validated;
    const result = await continueWorkflowFromSelection(
      projectId,
      ideaIndex,
      getProjectAccessToken(req)
    );
    return res.json(result);
  })
);

router.get(
  "/api/workflow/:projectId",
  validateProjectIdParam,
  asyncHandler(async (req, res) => {
    const { projectId } = req.validated;
    return res.json(await getWorkflowState(projectId, getProjectAccessToken(req)));
  })
);

module.exports = router;
