import { readData, json } from './_lib.js';

// Público: lo usa la página de inicio para mostrar servicios y sesiones.
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method' });
  try {
    const data = await readData();
    json(res, 200, data, { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=300' });
  } catch (e) {
    console.error('services read', e);
    json(res, 500, { error: 'read_failed' });
  }
}
