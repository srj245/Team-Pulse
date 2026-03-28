const { generateStructuredOutput } = require("../services/aiService");

function fallbackIdeaOutput(userIdea) {
  return {
    inputIdea: userIdea,
    ideas: [
      {
        title: "AI Customer Insight Copilot",
        summary: "Turn customer interviews and support tickets into product insights for fast-moving startups.",
        problemStatement: "Early-stage teams struggle to synthesize scattered customer feedback into product decisions.",
        targetAudience: "B2B SaaS founders, product managers, and customer success leads.",
        scores: { feasibility: 8, uniqueness: 7, demand: 8 },
      },
      {
        title: "Founder Workflow Autopilot",
        summary: "Automate recurring founder ops like investor updates, hiring follow-ups, and weekly planning.",
        problemStatement: "Founders lose time on repetitive coordination tasks that pull them away from growth work.",
        targetAudience: "Solo founders, startup CEOs, and startup operators.",
        scores: { feasibility: 9, uniqueness: 6, demand: 7 },
      },
      {
        title: "Micro-SaaS Launch Lab",
        summary: "Generate lean startup blueprints, landing pages, and MVP specs from a rough idea.",
        problemStatement: "Non-technical builders struggle to move from a concept to a concrete launch plan.",
        targetAudience: "Indie hackers, makers, and startup studios.",
        scores: { feasibility: 8, uniqueness: 8, demand: 9 },
      },
    ],
  };
}

async function runIdeaGeneratorAgent(userIdea) {
  return generateStructuredOutput({
    systemPrompt:
      "You are the Idea Generator Agent in a multi-agent startup builder. Generate exactly 3 startup ideas from a user's interest. Be concrete, commercially useful, and concise.",
    userPrompt: `User idea or interest: ${userIdea}`,
    schemaDescription:
      "{ inputIdea: string, ideas: [{ title: string, summary: string, problemStatement: string, targetAudience: string, scores: { feasibility: number, uniqueness: number, demand: number } }] }",
    fallback: () => fallbackIdeaOutput(userIdea),
  });
}

module.exports = {
  runIdeaGeneratorAgent,
};
