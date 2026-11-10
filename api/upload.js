// UrbanaTV — /api/upload (retirado)
// La subida desde el navegador ya no existe: requería una sesión de
// servidor que ya no se emite. Los MP3 y las portadas se suben a Vercel
// Blob desde el panel de Vercel (Storage) y su entrada se añade en
// mp3/catalog.json (música) o data/articles.json (noticias) en GitHub.
// Sin base de datos.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'subidas_por_panel',
    message: 'Las subidas ahora se hacen desde el panel de Vercel (Storage) y la entrada se añade en mp3/catalog.json o data/articles.json en GitHub.',
  });
}
