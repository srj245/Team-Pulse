const crypto = require("crypto");
const db = require("../db");

function parseJson(value) {
  return value ? JSON.parse(value) : null;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createAccessToken() {
  return crypto.randomBytes(24).toString("hex");
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "idea";
}

function createUniqueSlug(text) {
  const base = slugify(text);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

function serializeIdea(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    text: row.text,
    slug: row.slug,
    status: row.status,
    aiMode: row.ai_mode,
    researchMode: row.research_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createIdea(text, { aiMode, researchMode }) {
  const accessToken = createAccessToken();
  const slug = createUniqueSlug(text);
  const now = db.now();
  const result = await db.insert(
    "ideas",
    {
      text,
      slug,
      access_token_hash: hashToken(accessToken),
      status: "research_ready",
      ai_mode: aiMode,
      research_mode: researchMode,
      created_at: now,
      updated_at: now,
    },
    { autoId: true }
  );

  await db.insert("analytics", {
    idea_id: result.insertedId,
    visits: 0,
    signups: 0,
    interview_requests: 0,
    updated_at: now,
  });

  return {
    idea: await getIdeaById(result.insertedId),
    accessToken,
  };
}

async function getIdeaRecordById(ideaId) {
  return db.queryOne("ideas", {
    filter: { id: ideaId },
    projection: [
      "id",
      "text",
      "slug",
      "access_token_hash",
      "status",
      "ai_mode",
      "research_mode",
      "created_at",
      "updated_at",
    ],
  });
}

async function getIdeaById(ideaId) {
  return serializeIdea(await getIdeaRecordById(ideaId));
}

async function assertIdeaAccess(ideaId, accessToken) {
  const row = await getIdeaRecordById(ideaId);

  if (!row) {
    const error = new Error("Idea not found");
    error.status = 404;
    throw error;
  }

  if (!accessToken) {
    const error = new Error("Idea access token is required");
    error.status = 401;
    throw error;
  }

  if (hashToken(accessToken) !== row.access_token_hash) {
    const error = new Error("Idea access denied");
    error.status = 403;
    throw error;
  }

  return serializeIdea(row);
}

async function updateIdea(ideaId, changes) {
  const idea = await getIdeaById(ideaId);

  if (!idea) {
    const error = new Error("Idea not found");
    error.status = 404;
    throw error;
  }

  await db.update("ideas", {
    filter: { id: ideaId },
    set: {
      status: changes.status ?? idea.status,
      ai_mode: changes.aiMode ?? idea.aiMode,
      research_mode: changes.researchMode ?? idea.researchMode,
      updated_at: db.now(),
    },
  });

  return getIdeaById(ideaId);
}

async function replaceResearch(ideaId, rows) {
  await db.delete("research", {
    filter: { idea_id: ideaId },
    many: true,
  });

  if (!rows.length) {
    return;
  }

  const now = db.now();
  await db.insert(
    "research",
    rows.map((row) => ({
      idea_id: ideaId,
      competitor: row.competitor,
      pricing: row.pricing,
      positioning: row.positioning,
      source_url: row.sourceUrl,
      source_title: row.sourceTitle,
      source_snippet: row.sourceSnippet,
      created_at: now,
    })),
    { autoId: true }
  );
}

async function saveHypothesis(ideaId, hypothesis) {
  const existing = await db.queryOne("hypotheses", {
    filter: { idea_id: ideaId },
  });
  const payload = {
    target_user: hypothesis.targetUser,
    problem_statement: hypothesis.problemStatement,
    value_proposition: hypothesis.valueProposition,
    evidence_summary: hypothesis.evidenceSummary,
    updated_at: db.now(),
  };

  if (existing) {
    await db.update("hypotheses", {
      filter: { idea_id: ideaId },
      set: payload,
    });
    return;
  }

  await db.insert(
    "hypotheses",
    {
      idea_id: ideaId,
      ...payload,
      created_at: db.now(),
    },
    { autoId: true }
  );
}

async function saveLandingPage(ideaId, landingPage) {
  const existing = await db.queryOne("landing_pages", {
    filter: { idea_id: ideaId },
  });
  const payload = {
    slug: landingPage.slug,
    url: landingPage.url,
    html_content: landingPage.htmlContent,
    headline: landingPage.headline,
    subheadline: landingPage.subheadline,
    cta: landingPage.cta,
    updated_at: db.now(),
  };

  if (existing) {
    await db.update("landing_pages", {
      filter: { idea_id: ideaId },
      set: payload,
    });
    return;
  }

  await db.insert(
    "landing_pages",
    {
      idea_id: ideaId,
      ...payload,
      created_at: db.now(),
    },
    { autoId: true }
  );
}

async function saveDecisionReport(ideaId, report) {
  const existing = await db.queryOne("decision_reports", {
    filter: { idea_id: ideaId },
  });
  const payload = {
    decision: report.decision,
    confidence: report.confidence,
    explanation_json: JSON.stringify(report),
    updated_at: db.now(),
  };

  if (existing) {
    await db.update("decision_reports", {
      filter: { idea_id: ideaId },
      set: payload,
    });
    return;
  }

  await db.insert(
    "decision_reports",
    {
      idea_id: ideaId,
      ...payload,
      created_at: db.now(),
    },
    { autoId: true }
  );
}

async function getResearch(ideaId) {
  return (
    await db.queryMany("research", {
      filter: { idea_id: ideaId },
      projection: [
        "competitor",
        "pricing",
        "positioning",
        "source_url",
        "source_title",
        "source_snippet",
      ],
      sort: { id: 1 },
    })
  ).map((row) => ({
    competitor: row.competitor,
    pricing: row.pricing,
    positioning: row.positioning,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    sourceSnippet: row.source_snippet,
  }));
}

async function getHypothesis(ideaId) {
  const row = await db.queryOne("hypotheses", {
    filter: { idea_id: ideaId },
    projection: ["target_user", "problem_statement", "value_proposition", "evidence_summary"],
  });

  if (!row) {
    return null;
  }

  return {
    targetUser: row.target_user,
    problemStatement: row.problem_statement,
    valueProposition: row.value_proposition,
    evidenceSummary: row.evidence_summary,
  };
}

async function getLandingPage(ideaId) {
  const row = await db.queryOne("landing_pages", {
    filter: { idea_id: ideaId },
    projection: ["slug", "url", "html_content", "headline", "subheadline", "cta"],
  });

  if (!row) {
    return null;
  }

  return {
    slug: row.slug,
    url: row.url,
    htmlContent: row.html_content,
    headline: row.headline,
    subheadline: row.subheadline,
    cta: row.cta,
  };
}

async function getAnalytics(ideaId) {
  const row = await db.queryOne("analytics", {
    filter: { idea_id: ideaId },
    projection: ["visits", "signups", "interview_requests", "updated_at"],
  });

  if (!row) {
    return null;
  }

  const conversionRate = row.visits > 0 ? Number(((row.signups / row.visits) * 100).toFixed(1)) : 0;

  return {
    visits: row.visits,
    signups: row.signups,
    interviewRequests: row.interview_requests,
    conversionRate,
    updatedAt: row.updated_at,
  };
}

async function getDecisionReport(ideaId) {
  const row = await db.queryOne("decision_reports", {
    filter: { idea_id: ideaId },
    projection: ["explanation_json"],
  });

  return row ? parseJson(row.explanation_json) : null;
}

async function getIdeaState(ideaId) {
  const idea = await getIdeaById(ideaId);

  if (!idea) {
    const error = new Error("Idea not found");
    error.status = 404;
    throw error;
  }

  const [research, hypothesis, landingPage, analytics, decision] = await Promise.all([
    getResearch(ideaId),
    getHypothesis(ideaId),
    getLandingPage(ideaId),
    getAnalytics(ideaId),
    getDecisionReport(ideaId),
  ]);

  return {
    idea,
    research,
    hypothesis,
    landingPage,
    analytics,
    decision,
  };
}

async function getIdeaBySlug(slug) {
  return db.queryOne("ideas", {
    filter: { slug },
    projection: ["id", "text", "slug", "status", "ai_mode", "research_mode", "created_at", "updated_at"],
  });
}

async function getLandingPageBySlug(slug) {
  return db.queryOne("landing_pages", {
    filter: { slug },
    projection: ["idea_id", "slug", "url", "html_content", "headline", "subheadline", "cta"],
  });
}

async function incrementVisitForLandingSlug(slug) {
  const page = await getLandingPageBySlug(slug);

  if (!page) {
    return null;
  }

  await db.update("analytics", {
    filter: { idea_id: page.idea_id },
    inc: { visits: 1 },
    set: { updated_at: db.now() },
  });

  return {
    ideaId: page.idea_id,
    htmlContent: page.html_content,
  };
}

async function createWaitlistSignup(ideaId, email, interviewRequested) {
  const idea = await getIdeaById(ideaId);

  if (!idea) {
    const error = new Error("Idea not found");
    error.status = 404;
    throw error;
  }

  try {
    await db.insert(
      "waitlist",
      {
        idea_id: ideaId,
        email,
        interview_requested: interviewRequested ? 1 : 0,
        timestamp: db.now(),
      },
      { autoId: true }
    );
  } catch (error) {
    if (db.isUniqueConstraintError(error)) {
      const duplicate = new Error("This email is already on the waitlist for this idea");
      duplicate.status = 409;
      throw duplicate;
    }

    throw error;
  }

  await db.update("analytics", {
    filter: { idea_id: ideaId },
    inc: {
      signups: 1,
      interview_requests: interviewRequested ? 1 : 0,
    },
    set: { updated_at: db.now() },
  });

  return {
    ideaId,
    email,
    interviewRequested: Boolean(interviewRequested),
  };
}

module.exports = {
  createIdea,
  updateIdea,
  assertIdeaAccess,
  replaceResearch,
  saveHypothesis,
  saveLandingPage,
  saveDecisionReport,
  getIdeaState,
  getIdeaById,
  getIdeaBySlug,
  getLandingPageBySlug,
  incrementVisitForLandingSlug,
  createWaitlistSignup,
  getAnalytics,
};
