const { tavilyApiKey, serpApiKey } = require("../config");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html, name) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = String(html || "").match(pattern);
  return match ? stripHtml(match[1]) : "";
}

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : "";
}

function extractPricing(text) {
  const priceMatch = text.match(/(\$|usd\s*)\s?\d{1,4}(?:[.,]\d{1,2})?(?:\s*\/\s*(?:mo|month|yr|year|user))?/i);

  if (priceMatch) {
    return priceMatch[0].replace(/\s+/g, " ").trim();
  }

  if (/free trial/i.test(text)) {
    return "Free trial";
  }

  if (/free plan/i.test(text) || /\bfree\b/i.test(text)) {
    return "Free tier";
  }

  if (/contact sales|custom pricing/i.test(text)) {
    return "Custom pricing";
  }

  return "Pricing not found";
}

function buildCompetitorName(url, title) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const firstSegment = hostname.split(".")[0];
    return title.split("|")[0].split("-")[0].trim() || firstSegment;
  } catch (error) {
    return title || "Unknown competitor";
  }
}

async function fetchPageDetails(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }

    const html = await response.text();
    const title = extractTitle(html);
    const description =
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      stripHtml(html).slice(0, 280);

    return {
      title,
      description,
      pricing: extractPricing(`${title} ${description} ${stripHtml(html).slice(0, 4000)}`),
    };
  } catch (error) {
    return {
      title: "",
      description: "",
      pricing: "Pricing unavailable",
    };
  }
}

async function searchWithTavily(query) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).map((item) => ({
    title: item.title || item.url,
    url: item.url,
    snippet: item.content || "",
  }));
}

async function searchWithSerpApi(query) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", serpApiKey);
  url.searchParams.set("num", "5");

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`SerpAPI search failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.organic_results || []).map((item) => ({
    title: item.title || item.link,
    url: item.link,
    snippet: item.snippet || "",
  }));
}

async function searchWithDuckDuckGo(query) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }

  const html = await response.text();
  const results = [];
  const regex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = regex.exec(html)) && results.length < 5) {
    const rawUrl = match[1];
    const decodedUrl = rawUrl.startsWith("//duckduckgo.com/l/?uddg=")
      ? decodeURIComponent(rawUrl.split("uddg=")[1].split("&")[0])
      : rawUrl;

    results.push({
      title: stripHtml(match[2]),
      url: decodedUrl,
      snippet: stripHtml(match[3]),
    });
  }

  return results;
}

function buildTemplateResearch(ideaText) {
  return {
    provider: "template",
    sources: [
      {
        competitor: "Notion AI",
        pricing: "From $10 / month",
        positioning: "General productivity and knowledge management assistant for teams.",
        sourceUrl: "https://www.notion.so/product/ai",
        sourceTitle: "Notion AI",
        sourceSnippet: `Reference competitor for ${ideaText}. General-purpose AI productivity tools already serve adjacent founder workflows.`,
      },
      {
        competitor: "Jasper",
        pricing: "From $39 / month",
        positioning: "AI content and workflow automation platform for marketing teams.",
        sourceUrl: "https://www.jasper.ai/pricing",
        sourceTitle: "Jasper Pricing",
        sourceSnippet: "Example of a broad AI workflow product that packages task automation and content generation.",
      },
      {
        competitor: "Typeform",
        pricing: "From $29 / month",
        positioning: "Lead capture and research forms used to validate audience demand.",
        sourceUrl: "https://www.typeform.com/pricing/",
        sourceTitle: "Typeform Pricing",
        sourceSnippet: "Useful baseline for how validation tools capture demand and user interviews.",
      },
    ],
  };
}

async function runResearch(ideaText) {
  const query = `${ideaText} SaaS competitors pricing`;

  let provider = "template";
  let results = [];

  try {
    if (tavilyApiKey) {
      provider = "tavily";
      results = await searchWithTavily(query);
    } else if (serpApiKey) {
      provider = "serpapi";
      results = await searchWithSerpApi(query);
    } else {
      provider = "duckduckgo";
      results = await searchWithDuckDuckGo(query);
    }
  } catch (error) {
    provider = "template";
    results = [];
  }

  if (!results.length) {
    return buildTemplateResearch(ideaText);
  }

  const uniqueUrls = new Set();
  const normalized = [];

  for (const result of results) {
    if (!result.url || uniqueUrls.has(result.url)) {
      continue;
    }

    uniqueUrls.add(result.url);
    const details = await fetchPageDetails(result.url);

    normalized.push({
      competitor: buildCompetitorName(result.url, details.title || result.title),
      pricing: details.pricing,
      positioning: details.description || result.snippet || "Positioning unavailable",
      sourceUrl: result.url,
      sourceTitle: details.title || result.title || result.url,
      sourceSnippet: result.snippet || details.description || "Snippet unavailable",
    });
  }

  return {
    provider,
    sources: normalized.slice(0, 5),
  };
}

module.exports = {
  runResearch,
};
