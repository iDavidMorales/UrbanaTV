// Public Routicket QR detail proxy for the UrbanaTV native /codigo/:id route.
const BASE = "https://routicket.com/codigo/";
const clean = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
const decode = value => clean(value).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const attr = (html, key) => {
 const tags = html.match(/<meta\\b[^>]*>/gi) || [];
 for (const tag of tags) {
  const read = name => tag.match(new RegExp("\\\\b"+name+"\\\\s*=\\\\s*(['\\\"])([\\\\s\\\\S]*?)\\\\1", "i"))?.[2] || "";
  if ((read("property") || read("name")).toLowerCase() === key.toLowerCase()) return decode(read("content"));
 }
 return "";
};
const safeUrl = value => {
 try { const url = new URL(String(value || "").replace(/&amp;/g, "&"), "https://routicket.com"); return ["https:","http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
};
const candidates = html => {
 const found = [];
 const re = /<(?:iframe|video|source|a|img)\b[^>]*?\b(?:src|href|data-src)=['"]([^'"]+)['"][^>]*>/gi;
 let match;
 while ((match = re.exec(html)) !== null) {
  const url = safeUrl(match[1]);
  if (url && !found.includes(url)) found.push(url);
 }
 const plain = html.match(/https?:\\?\/\\?\/[^\s"'<>\\]+/gi) || [];
 for (let url of plain) { url = safeUrl(url.replace(/\\\//g, "/").replace(/[),.;]+$/, "")); if (url && !found.includes(url)) found.push(url); }
 return found;
};
const isAsset = url => /\.(?:png|jpe?g|gif|webp|svg|css|js|woff2?)(?:[?#]|$)/i.test(url);
const youtubeId = value => {
 try { const u = new URL(value); if (u.hostname.endsWith("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] || ""; if (u.hostname.includes("youtube.com")) return u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || ""; } catch {} return "";
};
export default async function handler(req, res) {
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=300");
 if (req.method !== "GET") { res.setHeader("Allow","GET"); return res.status(405).json({ok:false,error:"Method not allowed"}); }
 const id = String(req.query?.id || "").trim();
 if (!/^\d{1,12}$/.test(id)) return res.status(400).json({ok:false,error:"El identificador del QR no es válido."});
 try {
  const response = await fetch(BASE + encodeURIComponent(id), {headers:{Accept:"text/html"},signal:AbortSignal.timeout(9000),redirect:"follow"});
  if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ok:false,error:response.status === 404 ? "No encontramos ese código QR en Routicket." : "Routicket no pudo abrir este código en este momento."});
  const html = await response.text();
  if (/404 Not Found|Código no encontrado|No se encontró el código/i.test(html) && html.length < 5000) return res.status(404).json({ok:false,error:"No encontramos ese código QR en Routicket."});
  const title = attr(html,"og:title") || attr(html,"twitter:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") || "Código Routicket #" + id;
  const description = attr(html,"og:description") || attr(html,"description") || decode(html.match(/<meta[^>]+name=['"]description['"][^>]+content=['"]([^'"]*)['"]/i)?.[1] || "");
  const image = safeUrl(attr(html,"og:image") || attr(html,"twitter:image"));
  const urls = candidates(html).filter(url => !url.includes("routicket.com") && !isAsset(url) && !/google-analytics|doubleclick|facebook\.com\/tr\?/.test(url));
  let contentUrl = urls.find(url => youtubeId(url)) || urls.find(url => /vimeo\.com|spotify\.com|soundcloud\.com|tiktok\.com|facebook\.com|instagram\.com/i.test(new URL(url).hostname)) || urls[0] || "";
  const yt = youtubeId(contentUrl);
  let embedUrl = yt ? "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt) : "";
  if (!embedUrl) {
   const frame = html.match(/<iframe\b[^>]*\bsrc=['"]([^'"]+)['"]/i);
   const src = safeUrl(frame?.[1]);
   if (src && /youtube(?:-nocookie)?\.com\/embed\//i.test(src)) embedUrl = src;
  }
  const textOnly = decode(html.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ");
  const published = textOnly.match(/Publicado\s+(?:el\s+)?\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/i)?.[0] || "";
  const author = textOnly.match(/(?:autor|creador del código)\s+([\p{L}\d .'-]{2,80}?)(?:\s+\d{2,}|detalle del código)/iu)?.[1]?.trim() || "";
  return res.status(200).json({ok:true,id,title,description,image,content_url:contentUrl,embed_url:embedUrl,published,author,source_url:"https://routicket.com/codigo/"+id});
 } catch (error) {
  return res.status(502).json({ok:false,error:"No pudimos consultar Routicket. Intenta de nuevo en unos segundos."});
 }
}
