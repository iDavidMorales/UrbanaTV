// Read-only proxy to Routicket Go's geolocated multimedia QR map.
const BASE = "https://routicket.com/plugins/go/map.php";
const arrayFrom = data => {
  if (Array.isArray(data)) return data;
  for (const key of ["results", "items", "data", "qrcodes", "codes", "rows", "features"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};
const text = (...values) => values.find(v => typeof v === "string" && v.trim())?.trim() || "";
const safeUrl = value => {
  const raw = text(value);
  try { const u = new URL(raw); return ["https:", "http:"].includes(u.protocol) ? u.toString() : ""; }
  catch { return ""; }
};
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=300");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const rawBbox = String(req.query?.bbox || "20.3,-87.6,21.1,-86.7").slice(0, 100);
  const values = rawBbox.split(",").map(v => Number(v.trim()));
  const valid = values.length === 4 && values.every(Number.isFinite) &&
    values[0] >= -90 && values[0] <= 90 && values[2] >= -90 && values[2] <= 90 &&
    values[1] >= -180 && values[1] <= 180 && values[3] >= -180 && values[3] <= 180 &&
    values[0] <= values[2] && values[1] <= values[3];
  const bbox = valid ? values.join(",") : "20.3,-87.6,21.1,-86.7";
  try {
    const u = new URL(BASE);
    u.searchParams.set("bbox", bbox);
    const upstream = await fetch(u, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) throw new Error("Routicket respondió HTTP " + upstream.status);
    const raw = await upstream.json();
    const results = arrayFrom(raw).map((entry, index) => {
      const item = entry?.properties ? { ...entry.properties, id: entry.id ?? entry.properties.id } : entry;
      const coords = entry?.geometry?.coordinates;
      const lat = Number(item?.lat ?? item?.latitude ?? (Array.isArray(coords) ? coords[1] : NaN));
      const lng = Number(item?.lng ?? item?.lon ?? item?.longitude ?? (Array.isArray(coords) ? coords[0] : NaN));
      const id = item?.id ?? item?.qr_id ?? item?.qrcode_id ?? index;
      return {
        id: String(id),
        title: text(item?.text, item?.title, item?.nombre, item?.name, item?.clave, "Contenido local"),
        code: text(item?.code),
        content_url: safeUrl(item?.code),
        image: safeUrl(item?.foto ?? item?.image ?? item?.image_url),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        views: Number(item?.vistoxs ?? item?.views ?? 0) || 0,
        url: safeUrl(item?.url) || "https://routicket.com/codigo/" + encodeURIComponent(String(id))
      };
    }).filter(item => item.lat !== null && item.lng !== null);
    return res.status(200).json({ ok: true, source: "Routicket Go Map", bbox, count: results.length, results });
  } catch (error) {
    return res.status(502).json({ ok: false, source: "Routicket Go Map", error: "No fue posible consultar el mapa multimedia de Routicket.", results: [] });
  }
}
