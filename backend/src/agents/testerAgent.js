const { generateStructuredOutput } = require("../services/aiService");

function fallbackTesting(mvpCode) {
  return {
    bugs: [
      "Users may lose context if they refresh before selecting an idea unless project state is reloaded.",
      "Long-running AI calls need clear loading feedback in the frontend.",
    ],
    improvements: [
      "Add export to PDF or markdown for the final startup package.",
      "Add regeneration for a single agent instead of rerunning the whole flow.",
      "Add team collaboration and comments in a future version.",
    ],
    simulatedUserFeedback: [
      "I liked seeing three ideas first instead of being forced into one path.",
      "The final package felt useful because it combined research, design, and code in one place.",
      "I want an option to edit the selected idea before generating the full package.",
    ],
    qaSummary:
      "The MVP flow is coherent and useful, but it will benefit from resumability, regeneration controls, and better loading states.",
    testedSurface: mvpCode.coreFeatures,
  };
}

async function runTesterAgent(mvpCode) {
  return generateStructuredOutput({
    systemPrompt:
      "You are the Tester Agent. Review the generated MVP package, identify bugs, suggest improvements, and simulate user feedback.",
    userPrompt: `MVP code package:\n${JSON.stringify(mvpCode, null, 2)}`,
    schemaDescription:
      "{ bugs: string[], improvements: string[], simulatedUserFeedback: string[], qaSummary: string, testedSurface: string[] }",
    fallback: () => fallbackTesting(mvpCode),
  });
}

module.exports = {
  runTesterAgent,
};
