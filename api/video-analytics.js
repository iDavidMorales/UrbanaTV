// UrbanaTV — /api/video-analytics (retirado)
// La analítica de video por servidor ya no existe: no se guardan vistas
// ni segundos de reproducción en ninguna base de datos (sin Neon).
// GET devuelve una lista vacía para no romper clientes viejos; POST
// devuelve 410. La reproducción y el orden del catálogo ya no dependen
// de estas estadísticas.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ videos: [] });
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(410).json({
    error: 'analitica_retirada',
    message: 'UrbanaTV ya no guarda estadísticas de reproducción en servidor.',
  });
}
