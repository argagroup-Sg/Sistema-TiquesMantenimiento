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
        db.query(`
          SELECT t.*, 
            us.nombre AS solicitante_nombre,
            us.email AS solicitante_email,
            a.nombre AS area_nombre,
            m.nombre AS maquina_nombre,
            ut.nombre AS tecnico_nombre,
            ut.email AS tecnico_email
          FROM tickets t
          LEFT JOIN users us ON us.id = t.solicitante_id
          LEFT JOIN areas a ON a.id = t.area_id
          LEFT JOIN maquinas m ON m.id = t.maquina_id
          LEFT JOIN users ut ON ut.id = t.tecnico_id
          ORDER BY t.fecha_creacion DESC
          LIMIT 500
        `),
        db.query(`
          SELECT e.*,
            us.nombre AS solicitante_nombre,
            a.nombre AS area_nombre,
            m.nombre AS maquina_nombre,
            p.nombre AS proveedor_nombre,
            ur.nombre AS responsable_nombre
          FROM escalados e
          LEFT JOIN users us ON us.id = e.solicitante_id
          LEFT JOIN areas a ON a.id = e.area_id
          LEFT JOIN maquinas m ON m.id = e.maquina_id
          LEFT JOIN proveedores p ON p.id = e.proveedor_id
          LEFT JOIN users ur ON ur.id = e.responsable_id
          ORDER BY e.fecha_escalado DESC
          LIMIT 500
        `)
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
