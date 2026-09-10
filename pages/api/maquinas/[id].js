const db = require('../../../lib/db');
const { getUserFromReq, requireRole } = require('../../../lib/auth');

function sanitize(s) { return String(s || '').trim(); }

async function handler(req, res) {
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Id requerido' });

  if (req.method === 'GET') {
    const r = await db.query('SELECT id, nombre FROM maquinas WHERE id=$1', [id]);
    if (!r.rows || r.rows.length === 0) return res.status(404).json({ error: 'Máquina no encontrada' });
    return res.json({ maquina: r.rows[0] });
  }

  const user = await getUserFromReq(req);
  if (!requireRole(user, ['admin'])) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if (req.method === 'PUT') {
    const { nombre } = req.body || {};
    const n = sanitize(nombre);
    if (!n) return res.status(400).json({ error: 'Nombre es obligatorio' });
    await db.query('UPDATE maquinas SET nombre=$1 WHERE id=$2', [n, id]);
    return res.json({ success: true });
  }

  if (req.method === 'DELETE') {
    await db.query('DELETE FROM maquinas WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
