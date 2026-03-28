const { generateStructuredOutput } = require("../services/aiService");

function fallbackMarketResearch(selectedIdea) {
  return {
    selectedIdea,
    competitorAnalysis: [
      {
        name: "Notion AI",
        positioning: "General productivity assistant with strong brand distribution.",
        weakness: "Too broad for founder-specific workflows.",
      },
      {
        name: "Jasper",
        positioning: "AI content and workflow automation for teams.",
        weakness: "Less focused on startup validation and MVP packaging.",
      },
      {
        name: "Custom agency workflows",
        positioning: "High-touch consulting for startup ideation and launch support.",
        weakness: "Expensive, slow, and hard to scale.",
      },
    ],
    marketSize: {
      tam: "$8B+ global startup tooling and AI productivity market",
      sam: "$1.2B among English-speaking founders, indie hackers, and startup studios",
      som: "$15M reachable with product-led acquisition in niche founder communities",
    },
    trends: [
      "Solo founders increasingly use AI to compress early-stage execution.",
      "Demand is shifting from generic AI chat to verticalized workflow tools.",
      "Founders want tools that produce concrete assets, not just suggestions.",
    ],
    risks: [
      "AI output quality must stay high enough to feel trustworthy.",
      "Competition from general AI tools bundling similar startup workflows.",
      "Users may churn if the product stops at ideation and does not help with execution.",
    ],
    swot: {
      strengths: ["Fast time-to-value", "Clear founder outcome", "Expandable workflow surface"],
      weaknesses: ["Crowded AI category", "Trust depends on output quality"],
      opportunities: ["Launch kits for agencies", "Template marketplace", "Team collaboration upsell"],
      threats: ["Platform commoditization", "Low switching costs", "Search-driven copycat products"],
    },
    simulatedDataSources: [
      {
        source: "search_trends_api",
        purpose: "Estimate search demand for founder workflow and startup builder keywords",
      },
      {
        source: "competitor_scraper",
        purpose: "Track pricing, feature positioning, and landing page claims",
      },
    ],
  };
}

async function runMarketResearchAgent(selectedIdea) {
  return generateStructuredOutput({
    systemPrompt:
      "You are the Market Research Agent in a multi-agent startup builder. Produce realistic competitor analysis, trends, risks, SWOT, and simulated data integration hints.",
    userPrompt: `Selected idea:\n${JSON.stringify(selectedIdea, null, 2)}`,
    schemaDescription:
      "{ selectedIdea: object, competitorAnalysis: [{ name: string, positioning: string, weakness: string }], marketSize: { tam: string, sam: string, som: string }, trends: string[], risks: string[], swot: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }, simulatedDataSources: [{ source: string, purpose: string }] }",
    fallback: () => fallbackMarketResearch(selectedIdea),
  });
}

module.exports = {
  runMarketResearchAgent,
};
