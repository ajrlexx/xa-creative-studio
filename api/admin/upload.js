import { uploadImage, isAuthed, json, readBody, sameOrigin } from '../_lib.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Recibe { dataUrl } (la imagen ya viene reducida desde el navegador).
export default async function handler(req, res) {
  if (!isAuthed(req)) return json(res, 401, { error: 'unauthorized' });
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });

  let body;
  try { body = await readBody(req, 4_200_000); } catch { return json(res, 413, { error: 'too_large' }); }
  const m = /^data:([a-z/]+);base64,(.+)$/.exec(body.dataUrl || '');
  if (!m || !TYPES.includes(m[1])) return json(res, 400, { error: 'bad_image' });
  try {
    const url = await uploadImage(Buffer.from(m[2], 'base64'), m[1]);
    json(res, 200, { url });
  } catch {
    json(res, 500, { error: 'upload_failed' });
  }
}
