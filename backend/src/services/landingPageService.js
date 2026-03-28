const { generateStructuredOutput } = require("./aiService");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFallbackCopy(hypothesis) {
  return {
    headline: "Validate your startup idea before you build the product.",
    subheadline: hypothesis.valueProposition,
    cta: "Join the waitlist",
    proofPoints: [
      hypothesis.targetUser,
      hypothesis.problemStatement,
      hypothesis.evidenceSummary,
    ],
  };
}

async function generateLandingPageCopy(ideaText, hypothesis, research) {
  return generateStructuredOutput({
    systemPrompt:
      "You write concise, credible landing page copy for startup validation. Avoid hype. Make the promise testable.",
    userPrompt: JSON.stringify(
      {
        idea: ideaText,
        hypothesis,
        research: research.slice(0, 3),
      },
      null,
      2
    ),
    schemaDescription:
      "{ headline: string, subheadline: string, cta: string, proofPoints: string[] }",
    fallback: () => buildFallbackCopy(hypothesis),
  });
}

function renderLandingPageHtml({
  backendBaseUrl,
  ideaId,
  slug,
  ideaText,
  hypothesis,
  landingCopy,
  aiMode,
  researchMode,
}) {
  const proofItems = (landingCopy.proofPoints || [])
    .slice(0, 3)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(landingCopy.headline)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #111827;
      --muted: #5b6472;
      --line: #d5d9e2;
      --bg: #f7f4ee;
      --panel: #ffffff;
      --brand: #0f766e;
      --accent: #d97706;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(15,118,110,0.12), transparent 22%),
        radial-gradient(circle at bottom right, rgba(217,119,6,0.14), transparent 24%),
        var(--bg);
      color: var(--ink);
    }
    .shell {
      width: min(1080px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    .hero {
      display: grid;
      gap: 24px;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 420px);
      align-items: start;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 18px 50px rgba(17,24,39,0.08);
    }
    .eyebrow {
      display: inline-block;
      background: rgba(15,118,110,0.12);
      color: var(--brand);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(2.5rem, 5vw, 4.6rem);
      line-height: 0.95;
      margin: 18px 0 16px;
    }
    p {
      color: var(--muted);
      line-height: 1.7;
    }
    ul {
      padding-left: 20px;
      line-height: 1.8;
      color: var(--muted);
    }
    form {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }
    input[type="email"] {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 16px;
      font: inherit;
    }
    button {
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #0f766e, #14b8a6);
      color: white;
      padding: 14px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .checkbox {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      color: var(--muted);
      font-size: 14px;
    }
    .status {
      min-height: 24px;
      font-size: 14px;
      color: var(--brand);
    }
    .meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .pill {
      border-radius: 999px;
      padding: 8px 12px;
      background: #fff;
      border: 1px solid var(--line);
      font-size: 13px;
      color: var(--muted);
    }
    .quote {
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
    }
    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="card">
        <span class="eyebrow">Validation Test</span>
        <h1>${escapeHtml(landingCopy.headline)}</h1>
        <p>${escapeHtml(landingCopy.subheadline)}</p>
        <ul>${proofItems}</ul>
        <div class="meta">
          <div class="pill">${escapeHtml(aiMode)}</div>
          <div class="pill">Research: ${escapeHtml(researchMode)}</div>
        </div>
        <div class="quote">
          <strong>Idea</strong>
          <p>${escapeHtml(ideaText)}</p>
        </div>
      </div>
      <aside class="card">
        <span class="eyebrow">Get Early Access</span>
        <h2>${escapeHtml(hypothesis.targetUser)}</h2>
        <p>${escapeHtml(hypothesis.problemStatement)}</p>
        <form id="waitlistForm">
          <input type="email" id="email" placeholder="you@company.com" required>
          <label class="checkbox">
            <input type="checkbox" id="interviewRequested">
            <span>I am open to a 15-minute interview.</span>
          </label>
          <button type="submit">${escapeHtml(landingCopy.cta)}</button>
          <div class="status" id="statusMessage"></div>
        </form>
      </aside>
    </section>
  </main>
  <script>
    const form = document.getElementById("waitlistForm");
    const statusMessage = document.getElementById("statusMessage");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      statusMessage.textContent = "Submitting...";
      const response = await fetch("${backendBaseUrl}/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId: ${Number(ideaId)},
          email: document.getElementById("email").value.trim(),
          interviewRequested: document.getElementById("interviewRequested").checked
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        statusMessage.textContent = payload.error || "Signup failed";
        return;
      }
      form.reset();
      statusMessage.textContent = "Thanks. You are on the waitlist.";
    });
  </script>
</body>
</html>`;
}

function buildLandingPage({
  backendBaseUrl,
  ideaId,
  slug,
  ideaText,
  hypothesis,
  landingCopy,
  aiMode,
  researchMode,
}) {
  return {
    slug,
    url: `${backendBaseUrl}/launch/${slug}`,
    headline: landingCopy.headline,
    subheadline: landingCopy.subheadline,
    cta: landingCopy.cta,
    htmlContent: renderLandingPageHtml({
      backendBaseUrl,
      ideaId,
      slug,
      ideaText,
      hypothesis,
      landingCopy,
      aiMode,
      researchMode,
    }),
  };
}

module.exports = {
  generateLandingPageCopy,
  buildLandingPage,
};
