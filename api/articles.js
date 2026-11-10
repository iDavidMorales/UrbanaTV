// UrbanaTV — /api/articles
// Las noticias viven en data/articles.json (archivo local del repo).
// Sin base de datos: las lecturas no tocan Neon y no requieren DATABASE_URL.
// Las reseñas publicadas se conservan en ese mismo archivo; las nuevas
// valoraciones se guardan en el navegador de cada visitante (localStorage).
// Para publicar una noticia nueva: añade su entrada en data/articles.json
// en GitHub (la portada se sube a Vercel Blob desde el panel de Vercel);
// Vercel redespliega solo. POST devuelve 410 con esa indicación.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const reply = (res, n, data) => res.status(n).json(data);
const hiddenSlugs = new Set(['evento-1-de-noviembre-de-2026-mv22sqzz']);
const GONE = {
  error: 'articulos_solo_lectura',
  message: 'Las noticias ya no se publican desde aquí. Añade la nota en data/articles.json en GitHub (con la portada subida a Vercel Blob) y el sitio se actualiza al redesplegar.',
};
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function loadArticles() {
  const raw = await readFile(path.join(process.cwd(), 'data', 'articles.json'), 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.articles) ? data.articles : [];
}

function listView(a) {
  return {
    slug: a.slug,
    title: a.title,
    description: a.description,
    image_url: a.image_url || null,
    article_type: a.article_type || 'articulo',
    display_date: a.display_date || null,
    created_at: a.created_at,
    author: a.author || 'Comunidad',
    rating: a.rating ?? '0.0',
    review_count: a.review_count ?? (Array.isArray(a.reviews) ? a.reviews.length : 0),
  };
}

async function renderArticle(req, res, slug) {
  if (!/^[a-z0-9-]{1,140}$/.test(slug)) return reply(res, 404, { error: 'Noticia no encontrada' });
  const articles = await loadArticles();
  const a = articles.find((x) => x.slug === slug);
  if (!a) return reply(res, 404, { error: 'Noticia no encontrada' });
  const canonical = 'https://urbanatv.vercel.app/noticias/' + encodeURIComponent(a.slug);
  let image = '';
  if (a.image_url) {
    try {
      const u = new URL(a.image_url);
      if (u.protocol === 'https:') image = u.href;
    } catch {}
  }
  const meta = [
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="UrbanaTV">',
    '<meta property="og:locale" content="es_MX">',
    '<meta property="og:title" content="' + escapeHtml(a.title) + '">',
    '<meta property="og:description" content="' + escapeHtml(a.description) + '">',
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">',
    '<meta name="twitter:card" content="' + (image ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + escapeHtml(a.title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(a.description) + '">',
    '<meta name="twitter:url" content="' + escapeHtml(canonical) + '">',
    '<meta property="article:published_time" content="' + escapeHtml(new Date(a.created_at).toISOString()) + '">',
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">',
    ...(image ? ['<meta property="og:image" content="' + escapeHtml(image) + '">', '<meta property="og:image:alt" content="' + escapeHtml(a.title) + '">', '<meta name="twitter:image" content="' + escapeHtml(image) + '">'] : []),
  ].join('');
  const page = await fetch('https://urbanatv.vercel.app/index.html', { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(9000) });
  if (!page.ok) throw Error('No se pudo cargar la portada');
  let html = await page.text();
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escapeHtml(a.title) + ' | UrbanaTV</title>');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '<meta name="description" content="' + escapeHtml(a.description) + '">');
  html = html.replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|article:published_time)["'][^>]*>/gi, '');
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace('</head>', meta + '</head>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const slug = String(req.query.slug || '');
    if (req.method === 'GET' && String(req.query.render || '') === '1') {
      if (hiddenSlugs.has(slug)) return reply(res, 404, { error: 'Publicación retirada' });
      return await renderArticle(req, res, slug);
    }
    if (req.method === 'GET') {
      const articles = await loadArticles();
      if (slug) {
        if (hiddenSlugs.has(slug)) return reply(res, 404, { error: 'Publicación retirada' });
        const a = articles.find((x) => x.slug === slug);
        if (!a) return reply(res, 404, { error: 'No se encontró la nota' });
        return reply(res, 200, { article: { ...listView(a), id: a.id ?? null, content: a.content || '' }, reviews: Array.isArray(a.reviews) ? a.reviews : [] });
      }
      const visible = articles.filter((a) => a.slug !== 'evento-1-de-noviembre-de-2026-mv22sqzz');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return reply(res, 200, { articles: visible.map(listView) });
    }
    if (req.method === 'POST') return reply(res, 410, GONE);
    return reply(res, 405, { error: 'Método no permitido' });
  } catch (e) {
    console.error('articles API', e);
    return reply(res, 500, { error: 'No se pudo procesar la solicitud' });
  }
}
