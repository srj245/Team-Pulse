const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  validateValidationIdeaSubmission,
  validateIdeaIdParam,
  validateWaitlistSignup,
  validateContactSubmission,
} = require("../middleware/validation");
const {
  workflowStartLimiter,
  publicWriteLimiter,
  contactLimiter,
} = require("../middleware/security");
const {
  startValidationWorkflow,
  getIdeaStateForDashboard,
  addWaitlistAndRefreshDecision,
  getLandingPageHtml,
  requireIdeaAccessToken,
} = require("../workflow/validationWorkflow");
const { submitContactMessage } = require("../services/contactService");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", product: "ai-startup-validation-engine" });
});

router.post(
  "/api/ideas",
  workflowStartLimiter,
  validateValidationIdeaSubmission,
  asyncHandler(async (req, res) => {
    const payload = await startValidationWorkflow(req.validated.ideaText, req);
    res.status(201).json(payload);
  })
);

router.get(
  "/api/ideas/:ideaId",
  validateIdeaIdParam,
  asyncHandler(async (req, res) => {
    const payload = await getIdeaStateForDashboard(req.validated.ideaId, requireIdeaAccessToken(req));
    res.json(payload);
  })
);

router.get(
  "/api/analytics/:ideaId",
  validateIdeaIdParam,
  asyncHandler(async (req, res) => {
    const payload = await getIdeaStateForDashboard(req.validated.ideaId, requireIdeaAccessToken(req));
    res.json({
      analytics: payload.analytics,
      decision: payload.decision,
      progress: payload.progress,
      mode: payload.mode,
    });
  })
);

router.post(
  "/api/waitlist",
  publicWriteLimiter,
  validateWaitlistSignup,
  asyncHandler(async (req, res) => {
    const payload = await addWaitlistAndRefreshDecision(req.validated);
    res.status(201).json(payload);
  })
);

router.post(
  "/api/contact",
  contactLimiter,
  validateContactSubmission,
  asyncHandler(async (req, res) => {
    const payload = await submitContactMessage(req.validated);
    res.status(202).json(payload);
  })
);

router.get(
  "/launch/:slug",
  asyncHandler(async (req, res) => {
    const html = await getLandingPageHtml(req.params.slug);
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:;"
    );
    res.type("html").send(html);
  })
);

module.exports = router;
