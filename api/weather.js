// Server-side weather + approximate visitor city for UrbanaTV.
// Uses Vercel's request geolocation headers when available; falls back to Playa del Carmen.
const DEFAULT = { name: "Playa del Carmen", region: "Quintana Roo", country: "México", lat: 20.6296, lon: -87.0739 };
const clean = v => typeof v === "string" ? v.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 100) : "";
const validCoord = (v, min, max) => v !== undefined && v !== null && String(v).trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max;
async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error("Upstream HTTP " + response.status);
  return response.json();
}
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const queryLat = req.query?.lat, queryLon = req.query?.lon;
  const fromQuery = validCoord(queryLat, -90, 90) && validCoord(queryLon, -180, 180);
  const lat = fromQuery ? Number(queryLat) : (validCoord(req.headers["x-vercel-ip-latitude"], -90, 90) ? Number(req.headers["x-vercel-ip-latitude"]) : DEFAULT.lat);
  const lon = fromQuery ? Number(queryLon) : (validCoord(req.headers["x-vercel-ip-longitude"], -180, 180) ? Number(req.headers["x-vercel-ip-longitude"]) : DEFAULT.lon);
  let name = fromQuery ? "" : clean(req.headers["x-vercel-ip-city"]);
  try { if (name) name = decodeURIComponent(name.replace(/\+/g, " ")); } catch {}
  let region = fromQuery ? "" : clean(req.headers["x-vercel-ip-country-region"]);
  let country = fromQuery ? "" : clean(req.headers["x-vercel-ip-country"]);
  if (!name) {
    try {
      const u = new URL("https://nominatim.openstreetmap.org/reverse");
      u.search = new URLSearchParams({ format: "jsonv2", lat: String(lat), lon: String(lon), zoom: "10", addressdetails: "1", "accept-language": "es" }).toString();
      const geo = await fetchJson(u, { "User-Agent": "UrbanaTV/1.0 (local weather widget)" });
      const a = geo.address || {};
      name = clean(a.city || a.town || a.village || a.municipality || a.county);
      region = clean(a.state);
      country = clean(a.country);
    } catch {}
  }
  if (!name) { name = DEFAULT.name; region = DEFAULT.region; country = DEFAULT.country; }
  try {
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.search = new URLSearchParams({
      latitude: String(lat), longitude: String(lon),
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      timezone: "auto"
    }).toString();
    const data = await fetchJson(u);
    return res.status(200).json({
      ok: true, city: name, region, country, latitude: lat, longitude: lon,
      current: data.current || null,
      timezone: data.timezone || "auto",
      source: "Open-Meteo"
    });
  } catch {
    return res.status(502).json({ ok: false, city: name, region, country, error: "Weather service unavailable", current: null });
  }
}
