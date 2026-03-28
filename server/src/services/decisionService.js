const { generateStructuredOutput } = require("./aiService");

const MIN_VISITS_FOR_DECISION = 25;
const MIN_SIGNUPS_FOR_SIGNAL = 3;

function formatList(items) {
  return items.filter(Boolean).join(", ");
}

function buildExperimentPlan({ ideaText, hypothesis, research }) {
  const targetUser =
    hypothesis?.targetUser || "one narrow customer segment with a painful urgent problem";
  const problemStatement =
    hypothesis?.problemStatement || "the current workaround is too slow and fragmented";
  const competitorNames = research.slice(0, 2).map((item) => item.competitor);

  return {
    testableHypothesis: `If ${targetUser} see a promise tied to ${problemStatement.toLowerCase()}, they will join the waitlist before a product exists.`,
    successMetric: `Reach ${MIN_VISITS_FOR_DECISION} qualified visitors, ${MIN_SIGNUPS_FOR_SIGNAL} waitlist signups, and at least 1 interview request before making a hard build decision.`,
    acquisitionChannel: `Start with direct outreach and one niche community where ${targetUser.toLowerCase()} already discuss this problem.`,
    interviewQuestion:
      "What have you tried already, and what was still frustrating enough that you would switch?",
    differentiation: competitorNames.length
      ? `Position against ${formatList(competitorNames)} by owning the full loop from research to demand signal instead of one isolated workflow step.`
      : `Differentiate by owning the full loop from research to demand signal instead of acting like another generic AI copilot.`,
    positioningAngle: ideaText,
  };
}

function normalizeDecisionReport(candidate, fallbackReport) {
  const allowedDecisions = new Set(["go", "pivot", "kill"]);
  const normalizedDecision = allowedDecisions.has(candidate?.decision)
    ? candidate.decision
    : fallbackReport.decision;

  return {
    ...fallbackReport,
    ...candidate,
    decision: normalizedDecision,
    displayDecision: candidate?.displayDecision || fallbackReport.displayDecision || normalizedDecision,
    confidence: candidate?.confidence || fallbackReport.confidence,
    evidenceStatus: candidate?.evidenceStatus || fallbackReport.evidenceStatus,
    nextMilestone: candidate?.nextMilestone || fallbackReport.nextMilestone,
    whyUsersResponded:
      Array.isArray(candidate?.whyUsersResponded) && candidate.whyUsersResponded.length
        ? candidate.whyUsersResponded
        : fallbackReport.whyUsersResponded,
    suggestedImprovements:
      Array.isArray(candidate?.suggestedImprovements) && candidate.suggestedImprovements.length
        ? candidate.suggestedImprovements
        : fallbackReport.suggestedImprovements,
    experimentPlan: {
      ...fallbackReport.experimentPlan,
      ...(candidate?.experimentPlan || {}),
    },
    summary: candidate?.summary || fallbackReport.summary,
  };
}

function computeDecision(analytics) {
  const signups = analytics?.signups || 0;
  const visits = analytics?.visits || 0;
  const interviewRequests = analytics?.interviewRequests || 0;
  const conversionRate = analytics?.conversionRate || 0;

  if (
    visits < MIN_VISITS_FOR_DECISION &&
    signups < MIN_SIGNUPS_FOR_SIGNAL &&
    interviewRequests < 1
  ) {
    return {
      decision: "pivot",
      displayDecision: "collect_data",
      confidence: "low",
      evidenceStatus: "insufficient_data",
      nextMilestone: `Drive ${MIN_VISITS_FOR_DECISION} qualified visitors or ${MIN_SIGNUPS_FOR_SIGNAL} signups before making a Go / Kill call.`,
    };
  }

  if (signups >= 8 || conversionRate >= 15 || (signups >= 5 && interviewRequests >= 2)) {
    return {
      decision: "go",
      displayDecision: "go",
      confidence: visits >= 50 ? "high" : "medium",
      evidenceStatus: "validated_signal",
      nextMilestone:
        "Repeat the result with a second traffic source or a tighter ICP before building a larger MVP.",
    };
  }

  if (visits >= MIN_VISITS_FOR_DECISION && conversionRate < 4 && signups < MIN_SIGNUPS_FOR_SIGNAL) {
    return {
      decision: "kill",
      displayDecision: "kill",
      confidence: "medium",
      evidenceStatus: "weak_signal",
      nextMilestone:
        "Change the audience, pain point, or offer before spending more time building the product.",
    };
  }

  return {
    decision: "pivot",
    displayDecision: "pivot",
    confidence: interviewRequests >= 2 || conversionRate >= 8 ? "medium" : "low",
    evidenceStatus: "early_signal",
    nextMilestone:
      "Increase conversion above 10% or collect 3 interview requests to prove the message is strong enough.",
  };
}

function buildFallbackDecision({ ideaText, analytics, hypothesis, research }) {
  const base = computeDecision(analytics);
  const experimentPlan = buildExperimentPlan({ ideaText, hypothesis, research });
  const why = [];
  const improvements = [];

  if (base.evidenceStatus === "insufficient_data") {
    why.push(
      `Only ${analytics?.visits || 0} visitors and ${analytics?.signups || 0} signups have been captured so far, which is too little evidence for a confident verdict.`
    );
    improvements.push("Push the page through one narrow acquisition channel before changing the core idea.");
    improvements.push("Run founder outreach or community posts to get the first 25 qualified visitors.");
  } else if (base.evidenceStatus === "validated_signal") {
    why.push(
      `The page converted ${analytics.conversionRate}% of visitors into waitlist signups, which is strong enough to justify a deeper build.`
    );
    improvements.push("Lock the strongest headline and re-test with a second acquisition source.");
  } else if (base.evidenceStatus === "weak_signal") {
    why.push(
      `The page received ${analytics?.visits || 0} visitors but converted only ${analytics.conversionRate}% into signups, which is weak for this stage.`
    );
    improvements.push("Change the audience or pain point before adding more product scope.");
  } else {
    why.push(`The page converted ${analytics.conversionRate}% of visitors into waitlist signups.`);
    improvements.push("Rewrite the headline around a narrower urgent pain.");
  }

  if ((analytics?.interviewRequests || 0) > 0) {
    why.push("Interview requests suggest some users want to engage beyond passive interest.");
  } else {
    improvements.push("Ask for a very specific interview outcome to increase response quality.");
  }

  if (research?.length) {
    why.push(`Competitors such as ${research.slice(0, 2).map((item) => item.competitor).join(" and ")} show the market exists, but differentiation must be sharper.`);
  }

  improvements.push(`Refine the target user around ${hypothesis.targetUser}.`);
  improvements.push("Test a second landing page variant with one sharper promise and one measurable result.");

  return {
    ...base,
    experimentPlan,
    whyUsersResponded: why,
    suggestedImprovements: improvements,
    summary:
      base.evidenceStatus === "insufficient_data"
        ? `Too early to judge "${ideaText}". The current run needs more traffic before a real Go / Kill call.`
        : base.decision === "go"
        ? `Strong early signal for "${ideaText}". This idea has earned a deeper build or a second validation round.`
        : base.decision === "kill"
        ? `Traffic reached the page, but intent stayed weak. "${ideaText}" needs a more meaningful change before more build time is justified.`
        : `There is some signal for "${ideaText}", but the audience, message, or offer still needs refinement.`,
  };
}

async function generateDecisionReport({ ideaText, analytics, hypothesis, research }) {
  const baseline = computeDecision(analytics);
  const fallbackReport = buildFallbackDecision({ ideaText, analytics, hypothesis, research });

  const candidate = await generateStructuredOutput({
    systemPrompt:
      "You are a startup validation judge. Use only the provided research and metrics to decide whether the idea should be GO, PIVOT, or KILL. Be direct and concise.",
    userPrompt: JSON.stringify(
      {
        idea: ideaText,
        analytics,
        hypothesis,
        research: research.slice(0, 3),
        baseline,
        experimentPlan: buildExperimentPlan({ ideaText, hypothesis, research }),
      },
      null,
      2
    ),
    schemaDescription:
      "{ decision: string, displayDecision: string, confidence: string, evidenceStatus: string, whyUsersResponded: string[], suggestedImprovements: string[], experimentPlan: { testableHypothesis: string, successMetric: string, acquisitionChannel: string, interviewQuestion: string, differentiation: string, positioningAngle: string }, nextMilestone: string, summary: string }",
    fallback: () => fallbackReport,
  });

  return normalizeDecisionReport(candidate, fallbackReport);
}

module.exports = {
  generateDecisionReport,
};
