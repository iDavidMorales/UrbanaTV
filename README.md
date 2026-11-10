# UrbanaTV — La calle tiene voz

Plataforma estática, responsive, de curaduría de videos de música urbana, freestyle, podcasts, entrevistas y episodios.

## Inicio rápido
Sitio listo para desplegar como proyecto estático desde la raíz del repositorio. Archivo principal: `index.html`. No requiere compilación ni dependencias.

## Primer video
YouTube: https://www.youtube.com/watch?v=7OzbGwgCAHE&t=1435s
Embed de YouTube sin cookies mejoradas; comienza en el segundo 1435 (23:55).

## Funciones
- Portada destacada y reproductor YouTube.
- Filtros por categoría, búsqueda y enlaces para compartir.
- Formulario de incorporación a una lista **local por navegador** con localStorage. **No es administración pública ni persiste entre dispositivos**.
- Interfaz responsive, navegación por teclado y cierre del reproductor al salir.

## Datos: todo en JSON local (sin base de datos)
UrbanaTV ya no usa Neon ni ninguna base de datos:
- **Música:** `mp3/catalog.json` (semilla del catálogo, en el repo) + archivos por canción en Vercel Blob (`mp3/catalog/<id>.json`) para las subidas. Lo sirve `/api/tracks` (también `?catalog=1`, con búsqueda, filtros y orden; y `/api/music/catalog`).
- **Noticias:** `data/articles.json` (artículos y eventos, con su contenido y reseñas publicadas). Lo sirve `/api/articles` y `/noticias/<slug>`.
- **Los MP3 y las portadas** siguen en Vercel Blob (solo archivos, no base de datos).

**Para agregar una canción:** sube el MP3 a Vercel Blob desde el panel de Vercel (Storage), copia su URL y añade una entrada en `mp3/catalog.json` en GitHub. Haz commit y Vercel redespliega solo.

**Para publicar una noticia:** sube la portada a Vercel Blob desde el panel de Vercel, copia su URL y añade una entrada en `data/articles.json` en GitHub. Haz commit y Vercel redespliega solo.

**Cuentas y comunidad:** ya no hay cuentas con contraseña ni acceso por correo. Cada visitante elige su nombre en la página y se guarda solo en su navegador; sus estados del muro, sus comentarios en videos y sus valoraciones de noticias también viven solo en su dispositivo. Las notificaciones del servidor se retiraron. La analítica de video por servidor también se retiró (el reproductor ya no reporta vistas ni segundos de reproducción).

## Publicación en Vercel
Importa `iDavidMorales/UrbanaTV` como proyecto nuevo desde Vercel; selecciona framework `Other` (sitio estático), sin build command y con directorio raíz `./`. Publica. Variables de entorno: `AUTH_SECRET` (valida sesiones ya emitidas) y `BLOB_READ_WRITE_TOKEN` (lo pone Vercel al conectar el store de Blob). No se necesita ninguna base de datos.

© UrbanaTV.
