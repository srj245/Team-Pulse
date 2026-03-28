const { apiKey, aiModel } = require("../config");

function buildJsonInstruction(schemaDescription) {
  return `Return valid JSON only. Follow this shape exactly: ${schemaDescription}`;
}

function extractJsonText(value) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error("AI response was empty");
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fencedMatch ? fencedMatch[1].trim() : text;
}

async function requestGeminiJson({ systemPrompt, userPrompt, schemaDescription }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiModel)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${buildJsonInstruction(schemaDescription)}`,
              },
            ],
          },
          {
            parts: [
              {
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const textOutput = Array.isArray(data.candidates)
    ? data.candidates
        .flatMap((candidate) => candidate.content?.parts || [])
        .map((part) => part.text || "")
        .join("\n")
    : "";

  return JSON.parse(extractJsonText(textOutput));
}

async function generateStructuredOutput({
  systemPrompt,
  userPrompt,
  schemaDescription,
  fallback,
}) {
  if (!apiKey) {
    return fallback();
  }

  try {
    return await requestGeminiJson({
      systemPrompt,
      userPrompt,
      schemaDescription,
    });
  } catch (error) {
    console.error("AI request failed, falling back to deterministic generator", error);
    return fallback();
  }
}

module.exports = {
  generateStructuredOutput,
};
