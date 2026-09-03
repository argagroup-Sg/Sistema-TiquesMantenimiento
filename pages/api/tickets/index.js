const db = require('../../../lib/db');
const { getUserFromReq } = require('../../../lib/auth');

function generateTicketId() {
  const d = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return 'TK-' + d + '-' + Math.floor(Math.random() * 900 + 100);
}

async function handler(req, res) {
  if (req.method === 'GET') {
    // Determinar rol del llamante y correo desde sesión/token
    const user = await getUserFromReq(req);
    try {
      if (user && (user.role || user.rol) && ['admin','super'].includes(String((user.role || user.rol)).toLowerCase())) {
        const result = await db.query('SELECT * FROM tickets ORDER BY fecha_creacion DESC');
        return res.json({ tiques: result.rows });
      }

      if (user && (user.role || user.rol) && String((user.role || user.rol)).toLowerCase() === 'tecnico') {
        const email = (user.email || '').toString();
        const uid = (user.id || user.sub || '').toString();
        const name = (user.name || user.nombre || '').toString();
        // coincidir técnico almacenado como email, id o nombre
        const result = await db.query(
          `SELECT * FROM tickets WHERE lower(tecnico)=lower($1) OR tecnico=$2 OR lower(tecnico)=lower($3) ORDER BY fecha_creacion DESC`,
          [email, uid, name]
        );
        return res.json({ tiques: result.rows });
      }

      if (user && (user.role || user.rol) && String((user.role || user.rol)).toLowerCase() === 'empleado') {
        // mostrar tiques creados por este usuario (coincidir por email o nombre)
        const email = (user.email || '').toString();
        const name = (user.name || user.nombre || '').toString();
        const result = await db.query(
          `SELECT * FROM tickets WHERE lower(solicitante)=lower($1) OR lower(solicitante)=lower($2) ORDER BY fecha_creacion DESC`,
          [email, name]
        );
        return res.json({ tiques: result.rows });
      }

      // no autenticado o sin rol coincidente: devolver lista vacía para evitar filtrar datos
      return res.json({ tiques: [] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al listar tiques' });
    }
  }

  if (req.method === 'POST') {
    const data = req.body || {};
    if (!data.solicitante || !data.area || !data.maquina || !data.descripcion) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }
    const ticketId = generateTicketId();
    await db.query(
      `INSERT INTO tickets(id, solicitante, area, maquina, urgencia, descripcion, estado, ultima_actualizacion)
       VALUES($1,$2,$3,$4,$5,$6,'Abierto',now())`,
      [ticketId, data.solicitante, data.area, data.maquina, data.urgencia || 'Baja', data.descripcion]
    );

    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [ticketId, 'Creado', 'Abierto', data.solicitante || 'Sistema', 'Ticket creado']);
    return res.json({ success: true, id: ticketId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
