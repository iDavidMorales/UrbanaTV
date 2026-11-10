// UrbanaTV — /api/upload (token para subir a Vercel Blob desde el formulario)
// Sin cuentas ni sesiones: el formulario de publicación local sube la
// portada o el MP3 directo a Blob con un token que emite este endpoint.
// Solo se permiten estas rutas, tipos y tamaños:
//   news/covers/* -> imágenes JPG/PNG/WebP, máx. 5 MB
//   mp3/audio/*   -> audio MP3, máx. 50 MB
//   mp3/covers/*  -> imágenes JPG/PNG/WebP, máx. 5 MB
// Sin base de datos. Ojo: al no pedir sesión, cualquier visitante puede
// subir archivos dentro de esos límites; si se abusa, habrá que volver
// a pedir algún control.
import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Falta conectar Vercel Blob y BLOB_READ_WRITE_TOKEN en el proyecto' });
  }
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^(mp3\/(audio|covers)|news\/covers)\//.test(pathname)) throw Error('Ruta inválida');
        return {
          allowedContentTypes: pathname.startsWith('mp3/audio/')
            ? ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'application/octet-stream']
            : ['image/png', 'image/jpeg', 'image/webp'],
          maximumSizeInBytes: pathname.startsWith('mp3/audio/') ? 52428800 : 5242880,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'No se pudo subir el archivo' });
  }
}
