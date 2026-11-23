import { readData, writeData, sanitize, isAuthed, json, readBody, sameOrigin } from '../_lib.js';

export default async function handler(req, res) {
  const nocache = { 'Cache-Control': 'no-store' };
  if (!isAuthed(req)) return json(res, 401, { error: 'unauthorized' }, nocache);

  if (req.method === 'GET') {
    try { return json(res, 200, await readData(), nocache); }
    catch { return json(res, 500, { error: 'read_failed' }, nocache); }
  }
  if (req.method !== 'PUT') return json(res, 405, { error: 'method' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });

  let body;
  try { body = await readBody(req, 500_000); } catch { return json(res, 400, { error: 'bad_request' }); }
  const clean = sanitize(body);
  try {
    await writeData(clean);
    json(res, 200, clean, nocache);
  } catch {
    json(res, 500, { error: 'write_failed' }, nocache);
  }
}
