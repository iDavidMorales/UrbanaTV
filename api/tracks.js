// UrbanaTV — /api/tracks (catálogo del reproductor de música)
//
// CAMBIO 2026-11-16: ya NO se lista el catálogo de Blob en cada lectura.
// Antes, cada visita al reproductor hacía list() sobre mp3/catalog/ y eso
// quemó las 2.000 operaciones avanzadas de Blob del plan Hobby (6,8K en el
// ciclo). Ahora las lecturas usan UNA sola fuente:
//
//   1. El catálogo semilla del repo (mp3/catalog.json), que siempre está.
//   2. Un único índice en Blob, mp3/catalog/index.json, con los temas que
//      se agregan desde el panel. Se lee con UN solo GET (operación simple,
//      no avanzada); si Blob está bloqueado o el índice no existe, se usa
//      solo la semilla y el reproductor sigue sonando.
//
// Al agregar un tema (POST, solo con sesión) se reescribe ese único índice
// con put(): una sola operación avanzada por tema nuevo, no una por lectura.
// La primera vez que se agrega un tema después de este cambio, el POST
// migra una sola vez los archivos viejos mp3/catalog/<id>.json (list() una
// única vez); si Blob está bloqueado en ese momento, la migración queda
// pendiente (migrated:false) y se reintenta en el siguiente POST.
import { put } from '@vercel/blob';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const seedTracks = require('../mp3/catalog.json');
let playerTracksCache = { at: 0, data: null };
const PLAYER_CACHE_MS = 5 * 60 * 1000;
const BLOB_PREFIX = 'mp3/catalog/';
const INDEX_FILE = 'mp3/catalog/index.json';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function normalizeTrack(track) {
  const file = String(track?.file || track?.audio_url || '');
  if (!/^https:\/\/.+\.public\.blob\.vercel-storage\.com\//i.test(file)) return null;
  return {
    id: String(track.id || randomUUID()),
    title: String(track.title || 'Sin título').slice(0, 150),
    artist: String(track.artist || 'Artista desconocido').slice(0, 120),
    description: String(track.description || '').slice(0, 1200),
    file,
    cover: track.cover || track.cover_url || null,
    updated_at: track.updated_at || track.created_at || null,
  };
}

// El índice vive en el mismo almacén que los audios: su host se deduce de
// las URLs de la semilla, sin llamar a list().
function indexUrl() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const seed = Array.isArray(seedTracks) ? seedTracks : [];
  for (const track of seed) {
    const file = String(track?.file || track?.audio_url || '');
    const match = file.match(/^https:\/\/([a-z0-9-]+\.public\.blob\.vercel-storage\.com)\//i);
    if (match) return `https://${match[1]}/${INDEX_FILE}`;
  }
  return null;
}

// Lee el documento índice { migrated, tracks } o null si no existe /
// Blob no responde. Nunca lanza: sin índice, la semilla basta.
async function fetchIndexDoc() {
  const url = indexUrl();
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const doc = await response.json();
    if (!doc || !Array.isArray(doc.tracks)) return null;
    return { migrated: doc.migrated === true, tracks: doc.tracks.map(normalizeTrack).filter(Boolean) };
  } catch {
    return null;
  }
}

// Migración única de los archivos viejos mp3/catalog/<id>.json al índice.
// Solo se llama desde POST; si Blob está bloqueado, lanza y el POST guarda
// solo el tema nuevo con migrated:false para reintentarlo después.
async function migrateLegacyTracks() {
  const { list } = await import('@vercel/blob');
  const { blobs = [] } = await list({ prefix: BLOB_PREFIX, limit: 1000 });
  const legacy = blobs.filter(
    (blob) => blob.pathname !== INDEX_FILE && blob.pathname.endsWith('.json')
  );
  const saved = await Promise.all(legacy.map(async (blob) => {
    try {
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) return null;
      return normalizeTrack(await response.json());
    } catch { return null; }
  }));
  return saved.filter(Boolean);
}

function mergeTracks(seed, extra) {
  const byId = new Map();
  for (const track of [...seed, ...extra]) byId.set(track.id, track);
  return [...byId.values()].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

async function loadTracks() {
  const seed = Array.isArray(seedTracks) ? seedTracks.map(normalizeTrack).filter(Boolean) : [];
  const doc = await fetchIndexDoc();
  // Sin índice, la semilla sale en el orden del archivo, como antes.
  if (!doc) return seed;
  return mergeTracks(seed, doc.tracks);
}

async function getTracks() {
  const now = Date.now();
  if (playerTracksCache.data && now - playerTracksCache.at < PLAYER_CACHE_MS) return playerTracksCache.data;
  const tracks = await loadTracks();
  playerTracksCache = { at: now, data: tracks };
  return tracks;
}

function sessionUser(req) {
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim())
    .find(x => x.startsWith('urbanatv_session='))?.slice('urbanatv_session='.length);
  if (!cookie || !process.env.AUTH_SECRET) return null;
  try {
    const [payload, signature] = cookie.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', process.env.AUTH_SECRET).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now() || data.id == null) return null;
    return String(data.id);
  } catch { return null; }
}

export default async function handler(req, res) {
  const catalogMode = String(req.query?.catalog || '') === '1';
  if (catalogMode) {
    for (const [key, value] of Object.entries(cors)) res.setHeader(key, value);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD, OPTIONS');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
  } else if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    if (req.method === 'POST') {
      const userId = sessionUser(req);
      if (!userId) return res.status(401).json({ error: 'Inicia sesión' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({ error: 'music_storage_not_configured', message: 'Falta configurar Vercel Blob.' });
      }
      const data = req.body || {};
      const track = normalizeTrack({
        id: randomUUID(),
        title: data.title,
        artist: data.artist,
        description: data.description,
        file: data.file,
        cover: data.cover,
        updated_at: new Date().toISOString(),
        uploaded_by: userId,
      });
      if (!track || !data.title || !data.artist) return res.status(400).json({ error: 'Datos inválidos' });
      let base = [];
      let migrated = false;
      const doc = await fetchIndexDoc();
      if (doc) {
        base = doc.tracks;
        migrated = doc.migrated;
      }
      if (!migrated) {
        try {
          const legacy = await migrateLegacyTracks();
          base = mergeTracks(base, legacy);
          migrated = true;
        } catch {
          // Blob bloqueado: se guarda solo el tema nuevo; la migración
          // queda pendiente para el siguiente POST.
        }
      }
      const merged = mergeTracks(base, [track]);
      await put(INDEX_FILE, JSON.stringify({
        migrated,
        updated_at: new Date().toISOString(),
        tracks: merged.map((t) => ({ ...t, uploaded_by: userId })),
      }), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      playerTracksCache = { at: 0, data: null };
      return res.status(201).json({ ok: true, id: track.id });
    }

    const tracks = await getTracks();
    if (!catalogMode) {
      const body = { tracks: tracks.map(({ title, artist, description, file, cover }) => ({ title, artist, description, file, cover })) };
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300');
      return res.status(200).json(body);
    }

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
    const filtered = tracks.filter(t =>
      (!q || [t.title, t.artist, t.description].some(v => String(v || '').toLowerCase().includes(q))) &&
      (!artist || String(t.artist || '').toLowerCase().includes(artist))
    );
    filtered.sort((a, b) => sortByTitle
      ? a.title.localeCompare(b.title)
      : sortByArtist ? a.artist.localeCompare(b.artist)
      : String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const page = filtered.slice(offset, offset + limit).map(t => ({
      ...t, stream_url: t.file, cover_url: t.cover || null,
    }));
    const artists = facets ? [...new Set(tracks.map(t => t.artist).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, 1000) : undefined;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json({
      ok: true, source: 'UrbanaTV JSON + Vercel Blob', total: filtered.length, limit, offset,
      has_more: offset + page.length < filtered.length,
      sort: sortByTitle ? 'title' : sortByArtist ? 'artist' : 'newest',
      filters: { q, artist }, ...(artists ? { artists } : {}), tracks: page,
    });
  } catch (error) {
    console.error('[api/tracks] request failed:', error?.message || error);
    if (catalogMode) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ ok: false, error: 'music_catalog_unavailable', tracks: [], total: 0, limit: 0, offset: 0, has_more: false });
    }
    return res.status(500).json({ error: 'No se pudieron cargar las canciones' });
  }
}
