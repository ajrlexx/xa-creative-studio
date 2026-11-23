import { checkPassword, sessionCookie, clearCookie, isAuthed, json, readBody, sameOrigin } from '../_lib.js';

export default async function handler(req, res) {
  const nocache = { 'Cache-Control': 'no-store' };
  if (req.method === 'GET') return json(res, 200, { authed: isAuthed(req), configured: !!process.env.ADMIN_PASSWORD }, nocache);
  if (req.method === 'DELETE') return json(res, 200, { ok: true }, { ...nocache, 'Set-Cookie': clearCookie });
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
  if (!process.env.ADMIN_PASSWORD) return json(res, 503, { error: 'not_configured' }, nocache);

  let body;
  try { body = await readBody(req, 10_000); } catch { return json(res, 400, { error: 'bad_request' }); }
  if (!checkPassword(body.password)) {
    await new Promise(r => setTimeout(r, 900)); // frena intentos repetidos
    return json(res, 401, { error: 'wrong_password' }, nocache);
  }
  json(res, 200, { ok: true }, { ...nocache, 'Set-Cookie': sessionCookie() });
}
