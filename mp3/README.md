# Biblioteca MP3 — UrbanaTV

Coloca los archivos MP3 en esta carpeta y registra cada canción en `catalog.json`.

Ejemplo (sustituye `[]` por el arreglo):
```json
[
  {
    "title": "La Calle Tiene Voz",
    "artist": "Nombre del artista",
    "description": "Primer sencillo de la sesión urbana.",
    "cover": "/mp3/la-calle.jpg",
    "file": "/mp3/la-calle.mp3"
  },
  {
    "title": "Freestyle en vivo",
    "artist": "MC Invitado",
    "description": "Sesión grabada en vivo.",
    "cover": "",
    "file": "/mp3/freestyle.mp3"
  }
]
```

`cover` es opcional: puedes dejarlo como cadena vacía. Se aceptan JPEG, PNG y WebP en la carpeta. Es importante que los nombres coincidan exactamente y que los archivos sean tuyos o tengas permiso de distribución.

La web lista los archivos registrados; no escanea automáticamente la carpeta. El catálogo comienza vacío hasta que se suban canciones.

Puedes abrir el reproductor desde el botón **♫ MP3 / Música** en la página principal o directamente desde `/musica.html`.
