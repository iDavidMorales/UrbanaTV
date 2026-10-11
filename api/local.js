// Public, read-only Routicket data proxy for UrbanaTV.
// Keep the upstream requests server-side so the browser only calls /api/local.
const BASE = "https://routicket.com";
const SOURCES = {
  places: "/plugins/points/dataFeedApp.php?limit=40&page=0",
  promos: "/api/get_cupones/",
  tours: "/vhost/api/travel-catalog.php?limit=40"
};
const arr = (payload, keys) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};
const str = (...values) => values.find(v => typeof v === "string" && v.trim())?.trim() || "";
async function get(path) {
  const response = await fetch(BASE + path, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("Routicket upstream HTTP " + response.status);
  return response.json();
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const results = await Promise.allSettled(Object.entries(SOURCES).map(async ([key, path]) => [key, await get(path)]));
  const raw = {};
  const sourceStatus = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      raw[result.value[0]] = result.value[1];
      sourceStatus[result.value[0]] = "ok";
    } else {
      sourceStatus[Object.keys(sourceStatus).length ? "partial" : "unavailable"] = "error";
    }
  }
  const places = arr(raw.places, ["locations", "places", "data", "items"]).map((p, i) => ({
    id: String(p.id ?? p.place_id ?? i),
    title: str(p.titulo, p.title, p.name, p.nombre, p.business_name, p.negocio, "Lugar de la comunidad"),
    description: str(p.descripcion, p.description, p.bio, p.address, p.direccion, p.category, p.categoria),
    image: str(p.foto, p.image, p.image_url, p.logo, p.cover),
    url: str(p.url, p.link, p.detail_url, p.href) || "https://routicket.com/plugins/smart/",
    category: str(p.categoria, p.category, p.tipo, p.type, "Lugar"),
    city: str(p.ciudad, p.city, p.municipio, p.location)
  })).filter(p => p.title && p.title !== "Lugar de la comunidad").slice(0, 8);
  const promos = arr(raw.promos, ["promos", "cupones", "coupons", "items", "data"]).map((p, i) => ({
    id: String(p.id ?? p.cupon_id ?? i),
    title: str(p.title, p.titulo, p.nombre, p.name, "Promoción local"),
    description: str(p.body, p.descripcion, p.description, p.detalle, p.condiciones),
    url: str(p.link, p.url, p.href, p.detail_url) || "https://routicket.com/",
    expires: str(p.expira, p.expiration, p.fecha_fin, p.valid_until)
  })).filter(p => p.title && p.title !== "Promoción local").slice(0, 6);
  const tours = arr(raw.tours, ["tours", "items", "data"]).map((t, i) => ({
    id: String(t.id ?? i),
    title: str(t.title, t.titulo, t.name, t.nombre),
    description: str(t.description, t.descripcion, t.summary),
    image: str(t.image, t.foto, t.image_url),
    price: t.price ?? t.precio ?? null,
    currency: str(t.currency, t.moneda, "MXN"),
    provider: str(t.provider, t.proveedor),
    url: str(t.detail_url, t.source_url, t.url, t.link)
  })).filter(t => t.title && t.url && t.provider.toLowerCase() !== "dana").slice(0, 6);
  return res.status(200).json({
    ok: true,
    source: "Routicket",
    updated_at: new Date().toISOString(),
    counts: { places: places.length, promos: promos.length, tours: tours.length },
    sourceStatus,
    places, promos, tours
  });
}
