const db = require('../../../../lib/db');
const { v4: uuidv4 } = require('uuid');

function generateTicketId() {
  const d = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return 'TK-' + d + '-' + Math.floor(Math.random() * 900 + 100);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const { role, email } = req.query || {};
    let q = 'SELECT * FROM tickets ORDER BY fecha_creacion DESC';
    const result = await db.query(q);
    return res.json({ tiques: result.rows });
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
};
