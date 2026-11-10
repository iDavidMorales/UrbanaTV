// UrbanaTV — publicación local (sin servidor, sin Neon, sin cuentas)
// Los formularios de noticias y música ya no publican en el servidor:
// generan el objeto JSON con la misma forma que usan data/articles.json
// y mp3/catalog.json, lo guardan como borrador en el navegador
// (localStorage) y ofrecen descargarlo para pegarlo en GitHub.
// Las portadas y los MP3 se suben a Vercel Blob desde el formulario
// (vía /api/upload, que solo emite el token de subida con límites de
// ruta, tipo y tamaño). Nada se escribe en ningún servidor.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ARTICLE_DRAFTS_KEY = 'urbanatv:drafts:articles:v1';
  const TRACK_DRAFTS_KEY = 'urbanatv:drafts:tracks:v1';
  const LOCAL_USER_KEY = 'urbanatv:local-user-v1';
  const MAX_IMAGE_BYTES = 5242880; // 5 MB, igual que antes
  const MAX_AUDIO_BYTES = 52428800; // 50 MB, igual que antes
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'application/octet-stream', ''];
  const GITHUB_ARTICLES = 'https://github.com/iDavidMorales/UrbanaTV/edit/main/data/articles.json';
  const GITHUB_CATALOG = 'https://github.com/iDavidMorales/UrbanaTV/edit/main/mp3/catalog.json';

  // Igual que el slug del servidor anterior: sin tildes, con guiones,
  // máximo 75 caracteres, más un sufijo único en base 36.
  function slugify(s) {
    const base = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75);
    return base || 'nota';
  }
  function stamp() { return Date.now().toString(36); }
  function cleanFileName(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
  }
  function localUserName() {
    try {
      const u = JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || 'null');
      return u && u.name ? String(u.name) : null;
    } catch (e) { return null; }
  }
  function isoDate(value) {
    if (value) {
      const d = new Date(value + 'T00:00:00.000Z');
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }

  // Misma forma que las entradas de data/articles.json.
  function buildArticle(f) {
    const now = new Date().toISOString();
    return {
      id: 'local-' + stamp(),
      slug: slugify(f.title) + '-' + stamp(),
      title: String(f.title),
      description: String(f.description),
      content: String(f.content),
      image_url: f.image_url || '',
      article_type: f.article_type === 'evento' ? 'evento' : 'articulo',
      display_date: isoDate(f.display_date),
      created_at: now,
      author: localUserName() || 'Comunidad',
      rating: '0.0',
      review_count: 0,
      reviews: []
    };
  }

  // Misma forma que las entradas de mp3/catalog.json.
  function buildTrack(f) {
    return {
      id: 'local-' + stamp(),
      title: String(f.title).slice(0, 150),
      artist: String(f.artist).slice(0, 120),
      description: String(f.description || '').slice(0, 1200),
      file: f.file,
      cover: f.cover || null,
      updated_at: new Date().toISOString()
    };
  }

  function validImage(file) {
    return !!file && IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
  }
  function validAudio(file) {
    return !!file && file.size <= MAX_AUDIO_BYTES
      && (/\.mp3$/i.test(file.name) || AUDIO_TYPES.includes(file.type));
  }

  async function uploadToBlob(file, pathname) {
    const { upload } = await import('https://esm.sh/@vercel/blob@1.0.0/client');
    const done = await upload(pathname, file, { access: 'public', handleUploadUrl: '/api/upload' });
    return done.url;
  }

  // --- Borradores en localStorage (solo objetos JSON, nunca los archivos) ---
  function draftsKey(kind) { return kind === 'track' ? TRACK_DRAFTS_KEY : ARTICLE_DRAFTS_KEY; }
  function readDrafts(kind) {
    try {
      const v = JSON.parse(localStorage.getItem(draftsKey(kind)) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function saveDraft(kind, object, key) {
    const list = readDrafts(kind);
    const draftKey = key || ('draft-' + stamp());
    const entry = { key: draftKey, savedAt: new Date().toISOString(), title: object.title || 'Sin título', object };
    const i = list.findIndex((d) => d.key === draftKey);
    if (i >= 0) list[i] = entry; else list.unshift(entry);
    try {
      localStorage.setItem(draftsKey(kind), JSON.stringify(list.slice(0, 20)));
    } catch (e) { throw new Error('No se pudo guardar el borrador en este navegador.'); }
    return draftKey;
  }
  function deleteDraft(kind, key) {
    const list = readDrafts(kind).filter((d) => d.key !== key);
    try { localStorage.setItem(draftsKey(kind), JSON.stringify(list)); } catch (e) {}
    return list;
  }

  function downloadJson(object, filename) {
    const blob = new Blob([JSON.stringify(object, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  function fileNameFor(kind, object) {
    const safe = slugify(object.title || 'nota').slice(0, 50);
    return kind === 'track' ? 'cancion-' + safe + '.json' : 'articulo-' + safe + '.json';
  }

  // Bloque de resultado: JSON listo + descarga/copia + pasos cortos.
  function renderResult(container, kind, object) {
    if (!container) return;
    const isTrack = kind === 'track';
    const githubUrl = isTrack ? GITHUB_CATALOG : GITHUB_ARTICLES;
    const targetFile = isTrack ? 'mp3/catalog.json' : 'data/articles.json';
    const fileName = fileNameFor(kind, object);
    const jsonText = JSON.stringify(object, null, 2);
    container.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'JSON listo para publicar';
    container.append(title);
    const area = document.createElement('textarea');
    area.readOnly = true;
    area.value = jsonText;
    area.rows = 12;
    area.style.cssText = 'width:100%;margin:10px 0;background:#0c0c0e;color:#e8e8ea;border:1px solid #46464a;border-radius:9px;padding:12px;font:12px/1.5 ui-monospace,monospace;white-space:pre';
    area.setAttribute('aria-label', 'Objeto JSON generado');
    container.append(area);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px';
    const dl = document.createElement('button');
    dl.type = 'button';
    dl.textContent = '⬇ Descargar JSON';
    dl.style.cssText = 'background:#d5ff36;color:#111;border:0;border-radius:9px;padding:11px 15px;font-weight:800;cursor:pointer';
    dl.addEventListener('click', () => downloadJson(object, fileName));
    const cp = document.createElement('button');
    cp.type = 'button';
    cp.textContent = '⧉ Copiar JSON';
    cp.style.cssText = 'background:#242427;color:#eee;border:1px solid #555;border-radius:9px;padding:11px 15px;font-weight:700;cursor:pointer';
    cp.addEventListener('click', async () => {
      try { await copyText(jsonText); cp.textContent = '✓ Copiado'; setTimeout(() => { cp.textContent = '⧉ Copiar JSON'; }, 2000); }
      catch (e) { cp.textContent = 'No se pudo copiar'; }
    });
    row.append(dl, cp);
    container.append(row);
    const steps = document.createElement('ol');
    steps.style.cssText = 'margin:0;padding-left:20px;color:#ccc;font-size:13px;line-height:1.8';
    const stepTexts = [
      'Descarga el archivo (o copia el JSON).',
      'Abre ' + targetFile + ' en GitHub.',
      'Pega este objeto dentro del arreglo (con una coma entre objetos). El id puede quedar así; solo debe ser único.',
      'Guarda (commit) y Vercel redespliega solo: aparece en unos minutos.'
    ];
    for (const t of stepTexts) {
      const li = document.createElement('li');
      if (t.indexOf(targetFile) === 8) {
        li.append(document.createTextNode('Abre '));
        const a = document.createElement('a');
        a.href = githubUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = targetFile;
        a.style.color = '#d5ff36';
        li.append(a, document.createTextNode(' en GitHub.'));
      } else {
        li.textContent = t;
      }
      steps.append(li);
    }
    container.append(steps);
  }

  // Lista de borradores con Retomar / Descargar / Borrar.
  function renderDrafts(container, kind, onResume) {
    if (!container) return;
    const list = readDrafts(kind);
    container.replaceChildren();
    const head = document.createElement('p');
    head.style.cssText = 'color:#aaa;font-size:12px;margin:14px 0 8px';
    head.textContent = list.length ? 'Borradores guardados en este navegador:' : 'Sin borradores guardados en este navegador.';
    container.append(head);
    for (const draft of list) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid #343437;border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#141416';
      const info = document.createElement('span');
      info.style.cssText = 'flex:1;min-width:180px';
      const name = document.createElement('strong');
      name.textContent = draft.title || 'Sin título';
      const when = document.createElement('small');
      when.style.cssText = 'display:block;color:#999';
      try { when.textContent = new Date(draft.savedAt).toLocaleString('es-MX'); } catch (e) { when.textContent = ''; }
      info.append(name, when);
      row.append(info);
      const mkBtn = (label, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = 'background:#242427;color:#eee;border:1px solid #555;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer';
        b.addEventListener('click', fn);
        return b;
      };
      row.append(
        mkBtn('Retomar', () => onResume(draft)),
        mkBtn('Descargar', () => downloadJson(draft.object, fileNameFor(kind, draft.object))),
        mkBtn('Borrar', () => { deleteDraft(kind, draft.key); renderDrafts(container, kind, onResume); })
      );
      container.append(row);
    }
  }

  // --- Formulario de noticia (lo usan /noticias y el modal de inicio) ---
  function wireArticleForm(o) {
    const form = $(o.formId);
    if (!form) return;
    const status = $(o.statusId);
    const resultBox = $(o.resultId);
    const draftsBox = $(o.draftsId);
    const titleEl = $(o.titleId);
    const descEl = $(o.descId);
    const contentEl = $(o.contentId);
    const typeEl = $(o.typeId);
    const dateEl = $(o.dateId);
    const imageEl = $(o.imageId);
    const preview = o.previewId ? $(o.previewId) : null;
    const previewImg = o.previewImgId ? $(o.previewImgId) : null;
    let resumed = null; // {key, object}
    const say = (msg) => { if (status) status.textContent = msg; };
    function refreshDrafts() { if (draftsBox) renderDrafts(draftsBox, 'article', resumeDraft); }
    function resumeDraft(draft) {
      resumed = draft;
      const ob = draft.object || {};
      if (titleEl) titleEl.value = ob.title || '';
      if (descEl) descEl.value = ob.description || '';
      if (contentEl) contentEl.value = ob.content || '';
      if (typeEl) typeEl.value = ob.article_type || 'articulo';
      if (dateEl && ob.display_date) dateEl.value = String(ob.display_date).slice(0, 10);
      if (typeEl) typeEl.dispatchEvent(new Event('change'));
      if (imageEl) imageEl.value = '';
      if (preview) preview.hidden = true;
      say('Borrador retomado: "' + (ob.title || '') + '". La portada ya está subida; si eliges otra, se reemplaza.');
      if (typeof form.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (titleEl) titleEl.focus();
    }
    if (imageEl && preview && previewImg) {
      imageEl.addEventListener('change', () => {
        const file = imageEl.files && imageEl.files[0];
        if (!file) { preview.hidden = true; return; }
        if (!validImage(file)) {
          imageEl.value = '';
          preview.hidden = true;
          say('Usa JPG, PNG o WebP de máximo 5 MB.');
          return;
        }
        preview.hidden = false;
        previewImg.src = URL.createObjectURL(file);
      });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      if (btn) btn.disabled = true;
      try {
        const title = titleEl.value.trim();
        const description = descEl.value.trim();
        const content = contentEl.value.trim();
        if (title.length < 8 || title.length > 160) throw new Error('El título debe tener entre 8 y 160 caracteres.');
        if (description.length < 15 || description.length > 400) throw new Error('La descripción debe tener entre 15 y 400 caracteres.');
        if (content.length < 50 || content.length > 20000) throw new Error('El contenido debe tener entre 50 y 20.000 caracteres.');
        const type = typeEl ? typeEl.value : 'articulo';
        const dateVal = dateEl ? dateEl.value : '';
        if (type === 'evento' && !dateVal) throw new Error('Elige la fecha del evento.');
        let image_url = resumed ? (resumed.object.image_url || '') : '';
        const file = imageEl && imageEl.files ? imageEl.files[0] : null;
        if (file) {
          if (!validImage(file)) throw new Error('La portada debe ser JPG, PNG o WebP de máximo 5 MB.');
          say('Subiendo portada a Vercel Blob…');
          image_url = await uploadToBlob(file, 'news/covers/' + cleanFileName(file.name));
        }
        const base = buildArticle({ title, description, content, article_type: type, display_date: dateVal, image_url });
        const object = resumed
          ? Object.assign({}, base, { id: resumed.object.id, slug: resumed.object.slug, created_at: resumed.object.created_at })
          : base;
        const key = saveDraft('article', object, resumed ? resumed.key : null);
        resumed = { key, object };
        say('Borrador guardado en este navegador. Todavía no está publicado: descarga el JSON y agrégalo en GitHub.');
        renderResult(resultBox, 'article', object);
        refreshDrafts();
      } catch (err) {
        say(err && err.message ? err.message : 'No se pudo guardar el borrador.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    refreshDrafts();
  }

  // --- Formulario de canción (lo usa /musica) ---
  function wireTrackForm(o) {
    const form = $(o.formId);
    if (!form) return;
    const status = $(o.statusId);
    const resultBox = $(o.resultId);
    const draftsBox = $(o.draftsId);
    const titleEl = $(o.titleId);
    const artistEl = $(o.artistId);
    const descEl = $(o.descId);
    const audioEl = $(o.audioId);
    const coverEl = $(o.coverId);
    const dropLabel = o.dropLabelId ? $(o.dropLabelId) : null;
    let resumed = null;
    const say = (msg) => { if (status) status.textContent = msg; };
    function refreshDrafts() { if (draftsBox) renderDrafts(draftsBox, 'track', resumeDraft); }
    function resumeDraft(draft) {
      resumed = draft;
      const ob = draft.object || {};
      if (titleEl) titleEl.value = ob.title || '';
      if (artistEl) artistEl.value = ob.artist || '';
      if (descEl) descEl.value = ob.description || '';
      if (audioEl) audioEl.value = '';
      if (coverEl) coverEl.value = '';
      if (dropLabel) dropLabel.textContent = '♫ El audio ya está subido; si eliges otro MP3, se reemplaza';
      say('Borrador retomado: "' + (ob.title || '') + '". Los archivos ya están subidos; si eliges otros, se reemplazan.');
      if (typeof form.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (titleEl) titleEl.focus();
    }
    if (audioEl && dropLabel) {
      audioEl.addEventListener('change', () => {
        const f = audioEl.files && audioEl.files[0];
        if (f) dropLabel.textContent = '♫ ' + f.name + ' · ' + (f.size / 1048576).toFixed(1) + ' MB';
      });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      if (btn) btn.disabled = true;
      try {
        const title = titleEl.value.trim();
        const artist = artistEl.value.trim();
        const description = descEl ? descEl.value.trim() : '';
        if (!title) throw new Error('Escribe el título de la canción.');
        if (!artist) throw new Error('Escribe el nombre del artista.');
        const audioFile = audioEl && audioEl.files ? audioEl.files[0] : null;
        const coverFile = coverEl && coverEl.files ? coverEl.files[0] : null;
        if (!audioFile && !resumed) throw new Error('Selecciona un archivo MP3 válido de hasta 50 MB.');
        if (audioFile && !validAudio(audioFile)) throw new Error('Selecciona un archivo MP3 válido de hasta 50 MB.');
        if (coverFile && !validImage(coverFile)) throw new Error('La portada debe ser JPG, PNG o WebP de máximo 5 MB.');
        let fileUrl = resumed ? (resumed.object.file || '') : '';
        let coverUrl = resumed ? (resumed.object.cover || null) : null;
        if (audioFile) {
          say('Subiendo audio a Vercel Blob…');
          fileUrl = await uploadToBlob(audioFile, 'mp3/audio/' + cleanFileName(audioFile.name));
        }
        if (coverFile) {
          say('Subiendo portada…');
          coverUrl = await uploadToBlob(coverFile, 'mp3/covers/' + cleanFileName(coverFile.name));
        }
        if (!fileUrl) throw new Error('Selecciona un archivo MP3 válido de hasta 50 MB.');
        const base = buildTrack({ title, artist, description, file: fileUrl, cover: coverUrl });
        const object = resumed
          ? Object.assign({}, base, { id: resumed.object.id, updated_at: base.updated_at })
          : base;
        const key = saveDraft('track', object, resumed ? resumed.key : null);
        resumed = { key, object };
        say('Borrador guardado en este navegador. Todavía no está publicado: descarga el JSON y agrégalo en GitHub.');
        renderResult(resultBox, 'track', object);
        refreshDrafts();
      } catch (err) {
        say(err && err.message ? err.message : 'No se pudo guardar el borrador.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    refreshDrafts();
  }

  window.UrbanaPublish = {
    slugify, cleanFileName, localUserName,
    buildArticle, buildTrack,
    validImage, validAudio, uploadToBlob,
    readDrafts, saveDraft, deleteDraft,
    downloadJson, renderResult, renderDrafts,
    wireArticleForm, wireTrackForm
  };
})();
