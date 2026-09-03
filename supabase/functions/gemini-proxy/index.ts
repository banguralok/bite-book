// Proxies Gemini API calls so the real API key never reaches the browser.
// The whole invited group shares this one key instead of everyone needing
// their own — see js/ai.js's callGemini() for the client side of this.
//
// Deploy via the Supabase Dashboard (Edge Functions > deploy, paste this
// file) or `supabase functions deploy gemini-proxy`, then set the
// GEMINI_API_KEY secret (Edge Functions > gemini-proxy > Secrets, or
// `supabase secrets set GEMINI_API_KEY=...`). Deployed with JWT
// verification on (the default) — Supabase rejects any call without a
// valid signed-in user's token before this code ever runs, so this isn't
// an open proxy anyone on the internet could hit.
//
// Always responds 200 with an {ok, ...} envelope, even when the *Gemini*
// call itself fails — that keeps every Gemini-side failure (bad key, rate
// limit, model error) in the envelope's `ok:false` branch instead of
// supabase-js's own error branch, which is reserved for genuinely not
// reaching this function at all.

const GEMINI_MODEL = 'gemini-3.6-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ ok: false, status: 500, error: 'Server is missing GEMINI_API_KEY.' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse({ ok: false, status: 400, error: 'Invalid JSON body.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (_e) {
    return jsonResponse({ ok: false, status: 502, error: 'Network error reaching Gemini.' });
  }

  const text = await geminiRes.text();

  if (!geminiRes.ok) {
    return jsonResponse({ ok: false, status: geminiRes.status, error: text });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (_e) {
    return jsonResponse({ ok: false, status: 502, error: 'Invalid response from Gemini.' });
  }

  return jsonResponse({ ok: true, body: parsed });
});
