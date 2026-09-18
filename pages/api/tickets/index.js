const db = require('../../../lib/db');
const { getUserFromReq } = require('../../../lib/auth');

function generateTicketId() {
  const d = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return 'TK-' + d + '-' + Math.floor(Math.random() * 900 + 100);
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function buildTicketSelect(baseAlias = 't') {
  return `
    SELECT
      ${baseAlias}.*,
      us.nombre AS solicitante_nombre,
      us.email AS solicitante_email,
      a.nombre AS area_nombre,
      m.nombre AS maquina_nombre,
      ut.nombre AS tecnico_nombre,
      ut.email AS tecnico_email
    FROM tickets ${baseAlias}
    LEFT JOIN users us ON us.id = ${baseAlias}.solicitante_id
    LEFT JOIN areas a ON a.id = ${baseAlias}.area_id
    LEFT JOIN maquinas m ON m.id = ${baseAlias}.maquina_id
    LEFT JOIN users ut ON ut.id = ${baseAlias}.tecnico_id
  `;
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await getUserFromReq(req);
    try {
      const baseQuery = buildTicketSelect();
      const role = (user && (user.role || user.rol) ? String(user.role || user.rol).toLowerCase() : '');

      if (['admin', 'super'].includes(role)) {
        const result = await db.query(`${baseQuery} ORDER BY ${'t'}.fecha_creacion DESC`);
        return res.json({ tiques: result.rows });
      }

      if (role === 'tecnico') {
        const email = normalizeString(user.email || user.mail || '');
        const uid = normalizeString(user.id || user.sub || '');
        const name = normalizeString(user.name || user.nombre || '');
        const result = await db.query(
          `${baseQuery}
           WHERE lower(COALESCE(ut.email, ut.nombre, '')) = lower($1)
             OR ${'t'}.tecnico_id = $2
             OR lower(COALESCE(ut.nombre, '')) = lower($3)
           ORDER BY ${'t'}.fecha_creacion DESC`,
          [email, Number(uid) || null, name]
        );
        return res.json({ tiques: result.rows });
      }

      if (role === 'empleado') {
        const email = normalizeString(user.email || user.mail || '');
        const name = normalizeString(user.name || user.nombre || '');
        const result = await db.query(
          `${baseQuery}
           WHERE ${'t'}.solicitante_id = $1
             OR lower(COALESCE(us.email, '')) = lower($2)
             OR lower(COALESCE(us.nombre, '')) = lower($3)
           ORDER BY ${'t'}.fecha_creacion DESC`,
          [Number(user.id || user.sub || 0) || null, email, name]
        );
        return res.json({ tiques: result.rows });
      }

      return res.json({ tiques: [] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al listar tiques' });
    }
  }

  if (req.method === 'POST') {
    const data = req.body || {};
    const sessionUser = await getUserFromReq(req);
    const areaId = data.area_id !== undefined && data.area_id !== '' ? Number(data.area_id) : null;
    const maquinaId = data.maquina_id !== undefined && data.maquina_id !== '' ? Number(data.maquina_id) : null;
    const tecnicoId = data.tecnico_id !== undefined && data.tecnico_id !== '' ? Number(data.tecnico_id) : null;
    const solicitanteId = data.solicitante_id !== undefined && data.solicitante_id !== '' ? Number(data.solicitante_id) : (sessionUser && (sessionUser.id || sessionUser.sub) ? Number(sessionUser.id || sessionUser.sub) : null);

    if (!sessionUser && !solicitanteId) {
      return res.status(400).json({ error: 'Solicitante requerido' });
    }
    if (!areaId || !maquinaId || !data.descripcion) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }

    const ticketId = generateTicketId();
    const solicitante = normalizeString(data.solicitante || sessionUser?.name || sessionUser?.nombre || sessionUser?.email || 'Sistema');

    await db.query(
      `INSERT INTO tickets(
        id, urgencia, descripcion, estado, ultima_actualizacion,
        solicitante_id, area_id, maquina_id, tecnico_id
      ) VALUES($1,$2,$3,'Abierto',now(),$4,$5,$6,$7)`,
      [
        ticketId,
        data.urgencia || 'Baja',
        data.descripcion,
        solicitanteId,
        areaId,
        maquinaId,
        tecnicoId
      ]
    );

    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [ticketId, 'Creado', 'Abierto', solicitante, 'Ticket creado']);
    return res.json({ success: true, id: ticketId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
