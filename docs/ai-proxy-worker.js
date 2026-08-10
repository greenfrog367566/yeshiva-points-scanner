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
 *
 * CACHING: the Hebrew of a given pasuk never changes, so neither does the AI's
 * phrase-split of it. This worker caches every successful result by an exact
 * hash of the prompt (Cloudflare's edge Cache API — no setup, no bindings). The
 * FIRST teacher to generate a passage pays one Gemini call; everyone after gets
 * it back instantly and for free, so the free-tier rate limit almost never bites
 * in normal use. Responses carry an X-Proxy-Cache: HIT/MISS header if you want to
 * watch it work. (Edge cache is per-location, so the very first hit in each region
 * still costs one call. If you ever want a single global cache, swap this for a KV
 * namespace — but that needs a binding; the Cache API deliberately needs none.)
 */

// Pinned to a specific stable version rather than a "-latest" alias, which
// can silently change out from under you. Update this if/when Google
// deprecates it — check https://ai.google.dev/gemini-api/docs/models for
// the current stable Flash model before picking a replacement.
//
// ⚠️ FREE-TIER QUOTA depends heavily on WHICH model this is. "gemini-3.5-flash"
// is the premium "most-intelligent" flash model and its free tier is tiny —
// measured at ~20 requests PER DAY, shared across every teacher on this key. A
// lighter model (e.g. "gemini-2.5-flash" or a "-lite" variant) has a far larger
// free allowance and is more than enough to split Hebrew into phrases. If teachers
// keep hitting "quota exceeded", either switch this to a lighter model (one line,
// but it's a translation-quality call — judge it against your review gate) or put
// a PAID key in GEMINI_API_KEY, which removes the cap entirely and keeps this
// model. Your exact per-model limits are shown at https://aistudio.google.com/rate-limit
const GEMINI_MODEL = "gemini-3.5-flash";

// Bump this if the prompt format or model changes in a way that should
// invalidate everything cached under the old scheme.
const CACHE_VERSION = "v1";

export default {
  async fetch(request, env, ctx) {
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

    // ── Cache lookup ────────────────────────────────────────────────────────
    // The whole prompt (Hebrew + the teacher's style settings) is the key, so a
    // different style produces a different entry — but the same request served
    // twice never calls Gemini twice.
    const cache = caches.default;
    let cacheKey = null;
    try {
      const hash = await sha256(prompt);
      cacheKey = new Request(
        "https://ai-proxy-cache.internal/" + CACHE_VERSION + "/" + hash,
        { method: "GET" }
      );
      const hit = await cache.match(cacheKey);
      if (hit) {
        const h = new Headers(hit.headers);
        h.set("X-Proxy-Cache", "HIT");
        return new Response(hit.body, { status: 200, headers: h });
      }
    } catch (e) {
      // Cache is best-effort; on any hiccup just fall through to a live call
      // (cacheKey stays whatever we managed to build, possibly null).
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY);

    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // Raise the output ceiling so a fuller batch (a whole chapter of
          // phrase-split flashcards) can't get truncated mid-CSV.
          generationConfig: { maxOutputTokens: 8192 }
        })
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

    // ── Store in cache and return ───────────────────────────────────────────
    // Cache-Control is required for the Cache API to keep the entry. 30 days is
    // arbitrary-but-long; the text is fixed, so it could be far longer.
    const resp = new Response(JSON.stringify({ text: text }), {
      status: 200,
      headers: Object.assign({}, corsHeaders(), {
        "Cache-Control": "public, max-age=2592000",
        "X-Proxy-Cache": "MISS"
      })
    });
    if (cacheKey) {
      try {
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(cache.put(cacheKey, resp.clone()));
        } else {
          await cache.put(cacheKey, resp.clone());
        }
      } catch (e) { /* caching is best-effort; never fail the request over it */ }
    }
    return resp;
  }
};

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

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
