const db = require('../../lib/db');
const { getUserFromReq, requireRole } = require('../../lib/auth');

async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUserFromReq(req);
  if(!requireRole(user, ['admin','tecnico'])) return res.status(403).json({ error: 'No autorizado' });
  const r = await db.query("SELECT id,email,nombre,rol FROM users WHERE rol='tecnico' OR rol='admin' ORDER BY nombre");
  return res.json({ tecnicos: r.rows });
}

export default handler;
