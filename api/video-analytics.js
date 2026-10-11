import { neon } from '@neondatabase/serverless';
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const validId = /^[A-Za-z0-9_-]{11}$/;
let schemaReady;
async function ensureSchema() {
  if (!schemaReady) schemaReady = sql`CREATE TABLE IF NOT EXISTS urbana_tv.video_analytics (
    video_id VARCHAR(11) PRIMARY KEY, title TEXT NOT NULL DEFAULT '',
    category VARCHAR(80) NOT NULL DEFAULT 'Otros', views BIGINT NOT NULL DEFAULT 0,
    watch_seconds BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  return schemaReady;
}
const reply = (res, status, data) => res.status(status).json(data);
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!sql) return reply(res, 503, { error: 'Analytics no configurado' });
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const rows = await sql`SELECT video_id, title, category, views, watch_seconds,
        CASE WHEN views > 0 THEN ROUND(watch_seconds::numeric / views)::int ELSE 0 END AS avg_seconds
        FROM urbana_tv.video_analytics ORDER BY watch_seconds DESC, avg_seconds DESC, views DESC LIMIT 200`;
      return reply(res, 200, { videos: rows });
    }
    if (req.method !== 'POST') return reply(res, 405, { error: 'Método no permitido' });
    const data = typeof req.body === 'object' && req.body ? req.body : {};
    const id = String(data.video_id || '');
    const action = String(req.query.action || '');
    const title = String(data.title || '').slice(0, 180);
    const category = String(data.category || 'Otros').slice(0, 80);
    if (!validId.test(id)) return reply(res, 400, { error: 'Video inválido' });
    if (action === 'view') {
      await sql`INSERT INTO urbana_tv.video_analytics(video_id,title,category,views)
        VALUES(${id},${title},${category},1)
        ON CONFLICT(video_id) DO UPDATE SET title=EXCLUDED.title, category=EXCLUDED.category,
        views=urbana_tv.video_analytics.views+1, updated_at=now()`;
      return reply(res, 200, { ok: true });
    }
    if (action === 'watch') {
      const seconds = Math.max(0, Math.min(20, Math.round(Number(data.seconds) || 0)));
      if (seconds < 1) return reply(res, 400, { error: 'Duración inválida' });
      await sql`INSERT INTO urbana_tv.video_analytics(video_id,title,category,watch_seconds)
        VALUES(${id},${title},${category},${seconds})
        ON CONFLICT(video_id) DO UPDATE SET title=EXCLUDED.title, category=EXCLUDED.category,
        watch_seconds=urbana_tv.video_analytics.watch_seconds+${seconds}, updated_at=now()`;
      return reply(res, 200, { ok: true });
    }
    return reply(res, 400, { error: 'Acción inválida' });
  } catch (e) {
    console.error('Video analytics error', e);
    return reply(res, 500, { error: 'No se pudieron guardar las estadísticas' });
  }
}