const db = require('../../../lib/db');
const { getUserFromReq, requireRole } = require('../../../lib/auth');

async function handler(req,res){
  const user = await getUserFromReq(req);
  if(!requireRole(user, ['super','admin'])) return res.status(403).json({ error: 'No autorizado' });

  if(req.method === 'GET'){
    try{
      const [areasRes, maquinasRes, proveedoresRes, usersRes, ticketsRes, escaladosRes] = await Promise.all([
        db.query('SELECT id,nombre FROM areas ORDER BY nombre'),
        db.query('SELECT id,nombre FROM maquinas ORDER BY nombre'),
        db.query('SELECT id,nombre,contacto FROM proveedores ORDER BY nombre'),
        db.query('SELECT id,email,nombre,rol FROM users ORDER BY id DESC'),
        db.query('SELECT * FROM tickets ORDER BY fecha_creacion DESC LIMIT 500'),
        db.query('SELECT * FROM escalados ORDER BY fecha_escalado DESC LIMIT 500')
      ]);
      return res.json({
        areas: areasRes.rows,
        maquinas: maquinasRes.rows,
        proveedores: proveedoresRes.rows,
        users: usersRes.rows,
        tickets: ticketsRes.rows,
        escalados: escaladosRes.rows
      });
    }catch(e){ console.error('super overview error', e); return res.status(500).json({ error: 'Error al obtener datos' }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
