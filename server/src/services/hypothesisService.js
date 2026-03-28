const { apiKey } = require("../config");
const { generateStructuredOutput } = require("./aiService");

function buildFallbackHypothesis(ideaText, research) {
  const topResearch = research.slice(0, 2).map((item) => item.competitor).join(" and ");
  return {
    targetUser: "Early-stage founders and startup operators validating a new product before building it.",
    problemStatement:
      "Teams spend too long collecting scattered market proof, building landing pages manually, and guessing whether early demand is real.",
    valueProposition:
      "Launch a validation test in one workflow: source-backed research, a live landing page, waitlist capture, and a clear Go/Pivot/Kill recommendation.",
    evidenceSummary: topResearch
      ? `Current tools such as ${topResearch} solve fragments of the workflow, but not the full validation loop from idea to real demand signal.`
      : `Existing tools cover research or page building separately, leaving founders to stitch validation together by hand for ${ideaText}.`,
  };
}

async function generateHypothesis(ideaText, research) {
  return generateStructuredOutput({
    systemPrompt:
      "You are a startup validation strategist. Convert the founder idea and research findings into one crisp testable hypothesis. Keep each field tight and concrete.",
    userPrompt: JSON.stringify(
      {
        idea: ideaText,
        research,
      },
      null,
      2
    ),
    schemaDescription:
      "{ targetUser: string, problemStatement: string, valueProposition: string, evidenceSummary: string }",
    fallback: () => buildFallbackHypothesis(ideaText, research),
  });
}

function getAiModeLabel() {
  return apiKey ? "Live AI Mode" : "Template Mode";
}

module.exports = {
  generateHypothesis,
  getAiModeLabel,
};
