/*
 * AI proxy for the Pesukim/Mishnayos auto-import feature.
 *
 * Why this exists: the app is a single static HTML file with no backend, but
 * calling Gemini directly from that HTML would mean embedding your API key
 * in plain-text JS that anyone can read from "View Source." This tiny
 * Cloudflare Worker sits in between — it holds the real key as a server-side
 * secret and forwards prompts to Gemini, so teachers using the app never see
 * or need an API key at all.
 *
 * ONE-TIME SETUP (free):
 *   1. Sign up at https://dash.cloudflare.com (free plan is enough).
 *   2. Workers & Pages → Create → Create Worker. Give it any name.
 *   3. Paste this entire file into the editor, replacing the default code.
 *   4. Get a free Gemini API key at https://aistudio.google.com/apikey.
 *   5. In the Worker's Settings → Variables → add an "Encrypted" secret
 *      named GEMINI_API_KEY with that key as the value.
 *   6. Deploy. Copy the resulting https://<name>.<subdomain>.workers.dev URL.
 *   7. In app.html, search for "AI_PROXY_URL" and paste that URL in as its
 *      value. That's it — the auto-fetch button in the Pesukim/Mishnayos
 *      import panel will now work for every teacher using this app, with no
 *      further setup on their end.
 *
 * All usage draws from your own Gemini free-tier quota. If the free tier's
 * rate limit is hit, requests just fail gracefully — the app already falls
 * back to the manual copy/paste flow when this proxy can't be reached.
 */

// Pinned to a specific stable version rather than a "-latest" alias, which
// can silently change out from under you. Update this if/when Google
// deprecates it — check https://ai.google.dev/gemini-api/docs/models for
// the current stable Flash model before picking a replacement.
const GEMINI_MODEL = "gemini-3.5-flash";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const prompt = body && body.prompt;
    if (!prompt || typeof prompt !== "string") {
      return json({ error: "Missing 'prompt' string in request body" }, 400);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: "Worker is missing the GEMINI_API_KEY secret" }, 500);
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY);

    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
    } catch (e) {
      return json({ error: "Couldn't reach Gemini: " + e.message }, 502);
    }

    const data = await geminiRes.json().catch(() => null);
    if (!geminiRes.ok) {
      const msg = (data && data.error && data.error.message) || "Gemini request failed";
      return json({ error: msg }, geminiRes.status);
    }

    const parts = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts;
    const text = Array.isArray(parts) ? parts.map(p => p.text || "").join("") : "";
    if (!text) {
      return json({ error: "Gemini returned an empty response" }, 502);
    }

    return json({ text: text });
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: corsHeaders() });
}
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}
