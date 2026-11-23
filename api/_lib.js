import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { list, put, del } from '@vercel/blob';
import { DEFAULT_DATA } from './_defaults.js';

const PREFIX = 'data/services-';
const KEEP_VERSIONS = 15;
const COOKIE = 'xa_admin';
const SESSION_HOURS = 24 * 7;

/* ---------- datos ---------- */

async function versions() {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.pathname.localeCompare(a.pathname)); // más reciente primero
}

export async function readData() {
  const all = await versions();
  if (!all.length) return structuredClone(DEFAULT_DATA);
  const res = await fetch(all[0].url, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo leer los datos');
  return res.json();
}

export async function writeData(data) {
  const stamp = String(Date.now()).padStart(15, '0');
  await put(`${PREFIX}${stamp}.json`, JSON.stringify(data), {
    access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 31536000
  });
  const all = await versions();
  const old = all.slice(KEEP_VERSIONS).map(b => b.url);
  if (old.length) await del(old);
}

export async function uploadImage(buffer, contentType) {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const blob = await put(`img/session-${Date.now()}.${ext}`, buffer, {
    access: 'public', contentType, addRandomSuffix: true, cacheControlMaxAge: 31536000
  });
  return blob.url;
}

/* ---------- validación ---------- */

const str = (v, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = v => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const url = v => {
  const s = str(v, 500);
  if (!s) return '';
  if (s.startsWith('/img/')) return s;
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
};
const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const id = v => (str(v, 40).replace(/[^a-zA-Z0-9_-]/g, '') || Math.random().toString(36).slice(2, 10));
const offer = o => ({
  active: !!(o && o.active),
  price: num(o && o.price),
  label: str(o && o.label, 40) || 'Oferta',
  until: date(o && o.until)
});

export function sanitize(input) {
  const d = input && typeof input === 'object' ? input : {};
  const services = (Array.isArray(d.services) ? d.services : []).slice(0, 60).map(s => ({
    id: id(s.id), visible: s.visible !== false,
    name: str(s.name, 120), desc: str(s.desc, 800),
    prefix: str(s.prefix, 20), price: num(s.price), priceNote: str(s.priceNote, 40),
    offer: offer(s.offer)
  })).filter(s => s.name);
  const sessions = (Array.isArray(d.sessions) ? d.sessions : []).slice(0, 30).map(s => ({
    id: id(s.id), visible: s.visible !== false,
    name: str(s.name, 120), duration: str(s.duration, 120), desc: str(s.desc, 800),
    features: (Array.isArray(s.features) ? s.features : []).map(f => str(f, 160)).filter(Boolean).slice(0, 15),
    price: num(s.price), image: url(s.image), bookingUrl: url(s.bookingUrl),
    offer: offer(s.offer)
  })).filter(s => s.name);
  return { services, sessions, travelNote: str(d.travelNote, 400), updatedAt: new Date().toISOString() };
}

/* ---------- sesión admin ---------- */

function key() {
  const pw = process.env.ADMIN_PASSWORD || '';
  // Cambiar la contraseña invalida automáticamente todas las sesiones abiertas.
  return createHash('sha256').update(pw + '|' + (process.env.BLOB_READ_WRITE_TOKEN || '')).digest();
}

export function checkPassword(given) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || typeof given !== 'string') return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(real).digest();
  return timingSafeEqual(a, b);
}

export function sessionCookie() {
  const exp = Date.now() + SESSION_HOURS * 3600e3;
  const sig = createHmac('sha256', key()).update(String(exp)).digest('base64url');
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isAuthed(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = createHmac('sha256', key()).update(exp).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- utilidades HTTP ---------- */

export function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readBody(req, limit = 4_000_000) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('too_large'); chunks.push(c); }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

// Bloquea peticiones de escritura que no vengan del mismo sitio.
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
