# UrbanaTV: JSON como fuente de datos

## Estado actual
- `data/articles.json` y `mp3/catalog.json` son archivos JSON versionados en GitHub.
- Cuentas por correo, muro social y analítica de reproducción del servidor están retirados; esos endpoints no usan Neon.
- `api/tracks.js` todavía usa Vercel Blob para descubrir/guardar metadatos adicionales de canciones.
- `api/upload.js` todavía emite tokens para subir MP3 y portadas a Blob.
- Las URLs de audio y algunas portadas del catálogo actual apuntan a Blob. No borrar el Blob Store ni la variable `BLOB_READ_WRITE_TOKEN` hasta transferir esos archivos y verificar reproducción.
- `DATABASE_URL` sigue en Vercel, pero las rutas revisadas de artículos, email, social y analítica ya no la usan.

## Copias de datos
Se creó la rama `data-json` y se excluyó de builds de Vercel. Contiene copias públicas de:
- `private-data/public/articles.json`
- `private-data/public/catalog.json`

El repositorio es público; no guardar PII, credenciales ni archivos sensibles en esta rama.

## Próxima fase
1. Trasladar las canciones y portadas actuales a una ubicación estática del repositorio o a un host de archivos aprobado, sin cambiar sus IDs.
2. Cambiar `api/tracks.js` para leer y escribir el catálogo JSON mediante API privada de GitHub.
3. Retirar el endpoint de carga Blob y actualizar el formulario para registrar archivos ya alojados en el repositorio.
4. Probar las 14 canciones, portadas, enlaces, orden del reproductor y feed RSS antes de retirar el Blob Store.
