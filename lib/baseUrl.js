// lib/baseUrl.js
//
// Works out the PUBLIC address of the site (e.g. https://qr-menu-production-7a07.up.railway.app).
//
// Why this exists: on Railway (and any host behind a proxy) `new URL(request.url).origin`
// returns the server's INTERNAL address (http://localhost:8080), not the public domain.
// Anything built from it -- like table QR codes -- ends up pointing at localhost.
//
// Order of preference:
//   1. BASE_URL env var (set this in Railway -> Variables; most reliable)
//   2. X-Forwarded-Host / X-Forwarded-Proto headers sent by Railway's proxy
//   3. The Host header
//   4. RAILWAY_PUBLIC_DOMAIN (Railway sets this automatically)
//   5. request.url origin (only correct for local `npm run dev`)

function clean(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getBaseUrl(request) {
  const fromEnv = clean(process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL);
  if (fromEnv) return /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;

  const headers = request?.headers;
  const first = (v) => (v ? String(v).split(",")[0].trim() : "");

  const host = first(headers?.get("x-forwarded-host")) || first(headers?.get("host"));
  if (host && !/^(localhost|127\.0\.0\.1)(:|$)/i.test(host)) {
    const proto = first(headers?.get("x-forwarded-proto")) || "https";
    return `${proto}://${host}`;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${clean(process.env.RAILWAY_PUBLIC_DOMAIN)}`;

  return new URL(request.url).origin;
}

module.exports = { getBaseUrl };
