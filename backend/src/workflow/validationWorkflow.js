const { apiKey, publicBackendUrl } = require("../config");
const { createValidationError } = require("../middleware/validation");
const { runResearch } = require("../services/researchService");
const { generateHypothesis } = require("../services/hypothesisService");
const { generateLandingPageCopy, buildLandingPage } = require("../services/landingPageService");
const { generateDecisionReport } = require("../services/decisionService");
const {
  createIdea,
  updateIdea,
  assertIdeaAccess,
  replaceResearch,
  saveHypothesis,
  saveLandingPage,
  saveDecisionReport,
  getIdeaState,
  incrementVisitForLandingSlug,
  createWaitlistSignup,
} = require("../services/validationStore");

function getBaseUrl(req) {
  if (publicBackendUrl) {
    return publicBackendUrl.replace(/\/$/, "");
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function buildModePayload(idea) {
  return {
    aiMode: idea.aiMode === "live" ? "Live AI Mode" : "Template Mode",
    researchMode: idea.researchMode,
  };
}

function buildProgress(state) {
  const signups = state.analytics?.signups || 0;
  return [
    { key: "idea", label: "Idea captured", status: "completed" },
    { key: "research", label: "Research sourced", status: state.research.length ? "completed" : "pending" },
    { key: "hypothesis", label: "Hypothesis created", status: state.hypothesis ? "completed" : "pending" },
    { key: "landing", label: "Landing page live", status: state.landingPage ? "completed" : "pending" },
    { key: "signals", label: "Interest captured", status: signups > 0 ? "completed" : "current" },
    { key: "decision", label: "Decision ready", status: state.decision ? "completed" : "pending" },
  ];
}

async function startValidationWorkflow(userIdea, req) {
  const researchOutput = await runResearch(userIdea);
  const ideaRecord = await createIdea(userIdea, {
    aiMode: apiKey ? "live" : "template",
    researchMode: researchOutput.provider,
  });

  const ideaId = ideaRecord.idea.id;
  await replaceResearch(ideaId, researchOutput.sources);

  const hypothesis = await generateHypothesis(userIdea, researchOutput.sources);
  await saveHypothesis(ideaId, hypothesis);

  const pageCopy = await generateLandingPageCopy(userIdea, hypothesis, researchOutput.sources);
  const landingPage = buildLandingPage({
    backendBaseUrl: getBaseUrl(req),
    ideaId,
    slug: ideaRecord.idea.slug,
    ideaText: userIdea,
    hypothesis,
    landingCopy: pageCopy,
    aiMode: apiKey ? "Live AI Mode" : "Template Mode",
    researchMode: researchOutput.provider,
  });
  await saveLandingPage(ideaId, landingPage);

  await updateIdea(ideaId, { status: "live" });
  const state = await getIdeaState(ideaId);
  const decision = await generateDecisionReport({
    ideaText: userIdea,
    analytics: state.analytics,
    hypothesis,
    research: state.research,
  });
  await saveDecisionReport(ideaId, decision);

  const finalState = await getIdeaState(ideaId);
  return {
    accessToken: ideaRecord.accessToken,
    ...finalState,
    mode: buildModePayload(finalState.idea),
    progress: buildProgress(finalState),
  };
}

async function getIdeaStateForDashboard(ideaId, accessToken) {
  await assertIdeaAccess(ideaId, accessToken);
  const state = await getIdeaState(ideaId);

  return {
    ...state,
    mode: buildModePayload(state.idea),
    progress: buildProgress(state),
  };
}

async function addWaitlistAndRefreshDecision({ ideaId, email, interviewRequested }) {
  const signup = await createWaitlistSignup(ideaId, email, interviewRequested);
  const state = await getIdeaState(ideaId);
  const decision = await generateDecisionReport({
    ideaText: state.idea.text,
    analytics: state.analytics,
    hypothesis: state.hypothesis,
    research: state.research,
  });
  await saveDecisionReport(ideaId, decision);

  return {
    signup,
    analytics: (await getIdeaState(ideaId)).analytics,
    decision: (await getIdeaState(ideaId)).decision,
  };
}

async function getLandingPageHtml(slug) {
  const page = await incrementVisitForLandingSlug(slug);

  if (!page) {
    const error = new Error("Landing page not found");
    error.status = 404;
    throw error;
  }

  return page.htmlContent;
}

function requireIdeaAccessToken(req) {
  return String(req.headers["x-idea-token"] || req.body?.accessToken || "").trim();
}

function assertDecisionReady(state) {
  if (!state.decision) {
    throw createValidationError("Decision is not ready yet", 409);
  }
}

module.exports = {
  startValidationWorkflow,
  getIdeaStateForDashboard,
  addWaitlistAndRefreshDecision,
  getLandingPageHtml,
  requireIdeaAccessToken,
  assertDecisionReady,
};
