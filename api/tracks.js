import { neon } from '@neondatabase/serverless';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(req, res) {
  const catalogMode = String(req.query?.catalog || '') === '1';

  if (catalogMode) {
    for (const [key, value] of Object.entries(cors)) res.setHeader(key, value);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD, OPTIONS');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
  } else if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!process.env.DATABASE_URL) {
    if (catalogMode) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        ok: false,
        error: 'music_database_not_configured',
        message: 'Falta configurar DATABASE_URL en Vercel.',
        tracks: [], total: 0, limit: 0, offset: 0, has_more: false,
      });
    }
    return res.status(503).json({ error: 'Base de datos no configurada' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    if (req.method === 'POST') {
      const cookie = (req.headers.cookie || '').split(';').map(x => x.trim())
        .find(x => x.startsWith('urbanatv_session='))?.slice('urbanatv_session='.length);
      if (!cookie) return res.status(401).json({ error: 'Inicia sesión' });

      const { createHmac, timingSafeEqual } = await import('node:crypto');
      let id;
      try {
        const [p, s] = cookie.split('.');
        const a = createHmac('sha256', process.env.AUTH_SECRET).update(p).digest();
        const b = Buffer.from(s, 'base64url');
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw Error();
        const d = JSON.parse(Buffer.from(p, 'base64url').toString());
        if (d.exp < Date.now()) throw Error();
        id = String(d.id);
      } catch {
        return res.status(401).json({ error: 'Sesión inválida' });
      }

      const d = req.body || {};
      if (!d.title || !d.artist ||
          !String(d.file || '').includes('.public.blob.vercel-storage.com/') ||
          String(d.title).length > 150 || String(d.artist).length > 120) {
        return res.status(400).json({ error: 'Datos inválidos' });
      }
      await sql`INSERT INTO urbana_tv.tracks(title,artist,description,audio_url,cover_url,uploaded_by)
        VALUES(${String(d.title)},${String(d.artist)},${String(d.description || '').slice(0, 1200)},
        ${String(d.file)},${d.cover || null},${id})`;
      return res.status(201).json({ ok: true });
    }

    if (!catalogMode) {
      const rows = await sql`SELECT title,artist,description,audio_url AS file,cover_url AS cover
        FROM urbana_tv.tracks ORDER BY created_at DESC LIMIT 200`;
      return res.status(200).json({ tracks: rows });
    }

    const q = String(req.query?.q || '').trim().slice(0, 100).toLocaleLowerCase();
    const artist = String(req.query?.artist || '').trim().slice(0, 100).toLocaleLowerCase();
    const parsedLimit = Number.parseInt(String(req.query?.limit || '100'), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 100;
    const parsedOffset = Number.parseInt(String(req.query?.offset || '0'), 10);
    const offset = Number.isFinite(parsedOffset) ? Math.min(Math.max(parsedOffset, 0), 1000000) : 0;
    const sort = String(req.query?.sort || 'newest').toLowerCase();
    const sortByTitle = sort === 'title';
    const sortByArtist = sort === 'artist';
    const facets = String(req.query?.facets || '') === '1';
    const searchPattern = '%' + q + '%';
    const artistPattern = '%' + artist + '%';

    const countRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM urbana_tv.tracks
      WHERE audio_url LIKE 'https://%'
        AND (COALESCE(${q}, '') = ''
          OR LOWER(title) LIKE ${searchPattern}
          OR LOWER(artist) LIKE ${searchPattern}
          OR LOWER(COALESCE(description, '')) LIKE ${searchPattern})
        AND (COALESCE(${artist}, '') = '' OR LOWER(artist) LIKE ${artistPattern})
    `;
    const total = Number(countRows[0]?.total || 0);

    const rows = await sql`
      SELECT id, title, artist, description,
             audio_url AS file, cover_url AS cover, created_at
      FROM urbana_tv.tracks
      WHERE audio_url LIKE 'https://%'
        AND (COALESCE(${q}, '') = ''
          OR LOWER(title) LIKE ${searchPattern}
          OR LOWER(artist) LIKE ${searchPattern}
          OR LOWER(COALESCE(description, '')) LIKE ${searchPattern})
        AND (COALESCE(${artist}, '') = '' OR LOWER(artist) LIKE ${artistPattern})
      ORDER BY
        CASE WHEN ${sortByTitle} THEN LOWER(title) END ASC,
        CASE WHEN ${sortByArtist} THEN LOWER(artist) END ASC,
        CASE WHEN NOT ${sortByTitle} AND NOT ${sortByArtist} THEN created_at END DESC,
        id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const tracks = rows.map(row => ({
      id: row.id,
      title: row.title || 'Sin título',
      artist: row.artist || 'Artista desconocido',
      description: row.description || '',
      file: row.file,
      stream_url: row.file,
      cover: row.cover || null,
      cover_url: row.cover || null,
      updated_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    }));

    let artists;
    if (facets) {
      const artistRows = await sql`
        SELECT DISTINCT artist FROM urbana_tv.tracks
        WHERE COALESCE(artist, '') <> '' AND audio_url LIKE 'https://%'
        ORDER BY LOWER(artist) ASC LIMIT 1000
      `;
      artists = artistRows.map(row => row.artist);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json({
      ok: true, source: 'UrbanaTV', total, limit, offset,
      has_more: offset + rows.length < total,
      sort: sortByTitle ? 'title' : sortByArtist ? 'artist' : 'newest',
      filters: { q, artist },
      ...(artists ? { artists } : {}),
      tracks,
    });
  } catch (error) {
    console.error(catalogMode ? '[api/tracks catalog] query failed:' : '[api/tracks] request failed:',
      error?.message || error);
    if (catalogMode) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({
        ok: false, error: 'music_catalog_unavailable',
        message: 'No se pudo consultar el catálogo musical.',
        tracks: [], total: 0, limit: 0, offset: 0, has_more: false,
      });
    }
    return res.status(500).json({ error: 'No se pudieron cargar las canciones' });
  }
}
