// Read-only proxy to Routicket Go QR search API for UrbanaTV.
const BASE = "https://routicket.com/plugins/go/search.php";
const pickArray = data => {
  if (Array.isArray(data)) return data;
  for (const key of ["results", "items", "data", "qrcodes", "codes", "rows"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};
const text = (...values) => values.find(v => typeof v === "string" && v.trim())?.trim() || "";
const safeUrl = value => {
  const raw = text(value);
  try {
    const u = new URL(raw);
    return ["https:", "http:"].includes(u.protocol) ? u.toString() : "";
  } catch { return ""; }
};
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=180");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const query = text(req.query?.query, req.query?.q).slice(0, 120);
  const mode = ["code", "tag"].includes(req.query?.mode) ? req.query.mode : "";
  const browse = ["recent", "top", "random"].includes(req.query?.browse) ? req.query.browse : "";
  const sort = ["views", "recent"].includes(req.query?.sort) ? req.query.sort : "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query?.page || "1", 10) || 1));
  const limit = Math.max(1, Math.min(30, Number.parseInt(req.query?.limit || "10", 10) || 10));
  try {
    const u = new URL(BASE);
    if (query) u.searchParams.set("query", query);
    if (mode) u.searchParams.set("mode", mode);
    if (browse) u.searchParams.set("browse", browse);
    if (sort) u.searchParams.set("sort", sort);
    u.searchParams.set("page", String(page));
    u.searchParams.set("limit", String(limit));
    const upstream = await fetch(u, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) throw new Error("Routicket respondió HTTP " + upstream.status);
    const raw = await upstream.json();
    const results = pickArray(raw).map((item, index) => {
      const id = item?.id ?? item?.qr_id ?? item?.qrcode_id ?? index;
      const url = safeUrl(item?.url) || "https://routicket.com/codigo/" + encodeURIComponent(String(id));
      const codeUrl = safeUrl(item?.code);
      return {
        id: String(id),
        title: text(item?.text, item?.title, item?.nombre, item?.name, item?.clave, "Contenido de Routicket"),
        code: text(item?.code),
        content_url: codeUrl,
        image: safeUrl(item?.foto ?? item?.image ?? item?.image_url),
        lat: text(item?.lat) && Number.isFinite(Number(item.lat)) ? Number(item.lat) : null,
        lng: text(item?.lng) && Number.isFinite(Number(item.lng)) ? Number(item.lng) : null,
        views: Number(item?.vistoxs ?? item?.views ?? 0) || 0,
        relevance_score: Number(item?.relevance_score ?? 0) || 0,
        url
      };
    });
    return res.status(200).json({ ok: true, source: "Routicket Go", query, page, limit, count: results.length, results });
  } catch (error) {
    return res.status(502).json({ ok: false, source: "Routicket Go", error: "No fue posible consultar la búsqueda de Routicket.", results: [] });
  }
}
