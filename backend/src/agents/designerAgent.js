const { generateStructuredOutput } = require("../services/aiService");

function fallbackDesign(selectedIdea, marketResearch) {
  return {
    startupName: "LaunchPilot AI",
    branding: {
      tone: "Sharp, pragmatic, founder-first",
      colors: ["#11212d", "#3f72af", "#f9f7f7", "#dbe2ef"],
      style: "Modern command-center with warm editorial accents",
    },
    landingPageCopy: {
      headline: "Turn a rough startup idea into a launch-ready package in one workflow.",
      subheadline:
        "LaunchPilot AI simulates your startup team with specialist agents for idea validation, research, branding, MVP generation, and testing.",
      cta: "Build My Startup Package",
    },
    wireframe: [
      "Hero section with idea input and clear CTA",
      "Idea shortlist cards with scoring and selection buttons",
      "Progress tracker for each agent step",
      "Final package tabs: idea, research, design, MVP, testing",
    ],
    productSpec: {
      primaryUser: selectedIdea.targetAudience,
      keyFeatures: [
        "Generate and score three startup ideas",
        "Run automated market research",
        "Produce branding and landing page copy",
        "Return MVP frontend and backend starter code",
        "Simulate QA feedback and improvements",
      ],
      successMetric:
        "A user can move from raw idea to a structured startup package in a single session.",
      constraints: marketResearch.risks,
    },
  };
}

async function runDesignerAgent(selectedIdea, marketResearch) {
  return generateStructuredOutput({
    systemPrompt:
      "You are the Designer Agent. Create a startup brand, landing page copy, wireframe, and product spec from the selected idea and market research.",
    userPrompt: `Selected idea:\n${JSON.stringify(selectedIdea, null, 2)}\n\nMarket research:\n${JSON.stringify(marketResearch, null, 2)}`,
    schemaDescription:
      "{ startupName: string, branding: { tone: string, colors: string[], style: string }, landingPageCopy: { headline: string, subheadline: string, cta: string }, wireframe: string[], productSpec: { primaryUser: string, keyFeatures: string[], successMetric: string, constraints: string[] } }",
    fallback: () => fallbackDesign(selectedIdea, marketResearch),
  });
}

module.exports = {
  runDesignerAgent,
};
