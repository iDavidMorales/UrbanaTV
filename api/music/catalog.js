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
      ok: false,
      error: 'music_database_not_configured',
      message: 'Falta configurar DATABASE_URL en Vercel.',
      tracks: [],
      total: 0,
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const q = String(req.query?.q || '').trim().slice(0, 100).toLocaleLowerCase();
    const artist = String(req.query?.artist || '').trim().slice(0, 100).toLocaleLowerCase();
    const parsedLimit = Number.parseInt(String(req.query?.limit || '100'), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 100;

    const rows = await sql`
      SELECT id, title, artist, description,
             audio_url AS file, cover_url AS cover, created_at
      FROM urbana_tv.tracks
      WHERE (COALESCE(${q}, '') = ''
             OR LOWER(title) LIKE ${'%' + q + '%'}
             OR LOWER(artist) LIKE ${'%' + q + '%'}
             OR LOWER(COALESCE(description, '')) LIKE ${'%' + q + '%'})
        AND (COALESCE(${artist}, '') = '' OR LOWER(artist) LIKE ${'%' + artist + '%'})
      ORDER BY created_at DESC
      LIMIT ${limit}
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

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json({
      ok: true,
      source: 'UrbanaTV',
      total: tracks.length,
      tracks,
    });
  } catch (error) {
    console.error('[api/music/catalog] Database query failed:', error?.message || error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({
      ok: false,
      error: 'music_catalog_unavailable',
      message: 'No se pudo consultar el catálogo musical.',
      tracks: [],
      total: 0,
    });
  }
}
