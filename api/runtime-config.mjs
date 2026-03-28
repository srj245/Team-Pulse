export default function handler() {
  const apiBaseUrl = String(process.env.VALIDATION_ENGINE_API_BASE || "")
    .trim()
    .replace(/\/+$/, "");

  return new Response(JSON.stringify({ apiBaseUrl }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
