import { neon } from '@neondatabase/serverless';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(cors)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!process.env.DATABASE_URL) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({
      ok: false, error: 'music_database_not_configured',
      message: 'Falta configurar DATABASE_URL en Vercel.',
      tracks: [], total: 0, limit: 0, offset: 0, has_more: false,
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
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

    const where = sql`
      (COALESCE(${q}, '') = ''
        OR LOWER(title) LIKE ${'%' + q + '%'}
        OR LOWER(artist) LIKE ${'%' + q + '%'}
        OR LOWER(COALESCE(description, '')) LIKE ${'%' + q + '%'}) 
      AND (COALESCE(${artist}, '') = '' OR LOWER(artist) LIKE ${'%' + artist + '%'})
    `;

    const countRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM urbana_tv.tracks
      WHERE ${where}
    `;
    const total = Number(countRows[0]?.total || 0);

    const rows = await sql`
      SELECT id, title, artist, description,
             audio_url AS file, cover_url AS cover, created_at
      FROM urbana_tv.tracks
      WHERE ${where}
      ORDER BY
        CASE WHEN ${sortByTitle} THEN LOWER(title) END ASC,
        CASE WHEN ${sortByArtist} THEN LOWER(artist) END ASC,
        CASE WHEN NOT ${sortByTitle} AND NOT ${sortByArtist} THEN created_at END DESC,
        id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const tracks = rows.map((row) => ({
      id: row.id,
      title: row.title || 'Sin título',
      artist: row.artist || 'Artista desconocido',
      description: row.description || '',
      file: row.file || null,
      stream_url: row.file || null,
      cover: row.cover || null,
      cover_url: row.cover || null,
      updated_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    })).filter((track) => typeof track.file === 'string' && /^https:\/\//.test(track.file));

    let artists;
    if (facets) {
      const artistRows = await sql`
        SELECT DISTINCT artist
        FROM urbana_tv.tracks
        WHERE COALESCE(artist, '') <> ''
        ORDER BY LOWER(artist) ASC
        LIMIT 1000
      `;
      artists = artistRows.map((row) => row.artist);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json({
      ok: true,
      source: 'UrbanaTV',
      total,
      limit,
      offset,
      has_more: offset + rows.length < total,
      sort: sortByTitle ? 'title' : sortByArtist ? 'artist' : 'newest',
      filters: { q, artist },
      ...(artists ? { artists } : {}),
      tracks,
    });
  } catch (error) {
    console.error('[api/music/catalog] Database query failed:', error?.message || error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({
      ok: false, error: 'music_catalog_unavailable',
      message: 'No se pudo consultar el catálogo musical.',
      tracks: [], total: 0, limit: 0, offset: 0, has_more: false,
    });
  }
}
