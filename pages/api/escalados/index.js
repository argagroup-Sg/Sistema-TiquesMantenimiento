const db = require('../../../lib/db');
const { getUserFromReq, requireRole } = require('../../../lib/auth');

function sanitize(s){return String(s||'').trim();}

function buildEscaladoNota(notaBase){
  const nota = sanitize(notaBase);
  return nota || 'Escalado';
}

function buildHistorialDetalle(notaBase, observacionesBase, proveedorNombre){
  const nota = sanitize(notaBase);
  const observaciones = sanitize(observacionesBase);
  const proveedor = sanitize(proveedorNombre);
  const parts = [];
  if (nota) parts.push(`Nota: ${nota}`);
  if (proveedor) parts.push(`Proveedor: ${proveedor}`);
  if (observaciones) parts.push(`Observaciones: ${observaciones}`);
  return parts.join(' | ');
}

async function handler(req,res){
  if(req.method==='GET'){
    const r = await db.query(`
      SELECT e.*,
        u_solicitante.nombre AS solicitante_nombre,
        a.nombre AS area_nombre,
        m.nombre AS maquina_nombre,
        p.nombre AS proveedor_nombre,
        u_responsable.nombre AS responsable_nombre
      FROM escalados e
      LEFT JOIN users u_solicitante ON u_solicitante.id = e.solicitante_id
      LEFT JOIN areas a ON a.id = e.area_id
      LEFT JOIN maquinas m ON m.id = e.maquina_id
      LEFT JOIN proveedores p ON p.id = e.proveedor_id
      LEFT JOIN users u_responsable ON u_responsable.id = e.responsable_id
      ORDER BY e.fecha_escalado DESC
    `);
    return res.json({ escalados: r.rows });
  }

  const user = await getUserFromReq(req);
  if (!requireRole(user, ['admin','tecnico'])) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if(req.method==='POST'){
    const { ticket_id, proveedor, proveedor_id, observaciones, nota, responsable, responsable_id, estado } = req.body || {};
    if(!ticket_id) return res.status(400).json({ error: 'ticket_id requerido' });
    const t = sanitize(ticket_id);
    const normalizedProveedor = sanitize(proveedor || 'Sin proveedor');
    const proveedorId = proveedor_id !== undefined && proveedor_id !== '' && proveedor_id !== null ? Number(proveedor_id) : null;
    const responsableId = responsable_id !== undefined && responsable_id !== '' && responsable_id !== null ? Number(responsable_id) : ((user && (user.id || user.sub)) ? Number(user.id || user.sub) : null);
    let s = '';
    let a = '';
    let m = '';
    let u = '';
    let d = '';
    let ticketSolicitanteId = null;
    let ticketSnapshot = null;
    try{
      const trow = await db.query('SELECT urgencia, descripcion, solicitante_id, area_id, maquina_id FROM tickets WHERE id=$1', [t]);
      ticketSnapshot = trow && trow.rows && trow.rows[0] ? trow.rows[0] : null;
      if(ticketSnapshot){
        u = sanitize(ticketSnapshot.urgencia || '');
        d = sanitize(ticketSnapshot.descripcion || '');
        ticketSolicitanteId = ticketSnapshot.solicitante_id ? Number(ticketSnapshot.solicitante_id) : null;
        if (ticketSnapshot.area_id) {
          const areaRow = await db.query('SELECT nombre FROM areas WHERE id=$1', [Number(ticketSnapshot.area_id)]);
          a = sanitize(areaRow.rows[0]?.nombre || '');
        }
        if (ticketSnapshot.maquina_id) {
          const maquinaRow = await db.query('SELECT nombre FROM maquinas WHERE id=$1', [Number(ticketSnapshot.maquina_id)]);
          m = sanitize(maquinaRow.rows[0]?.nombre || '');
        }
        if (ticketSolicitanteId) {
          const userRow = await db.query('SELECT nombre FROM users WHERE id=$1', [ticketSolicitanteId]);
          s = sanitize(userRow.rows[0]?.nombre || '');
        }
      }
    }catch(e){ console.error('Error fetching ticket for escalado snapshot', e); }
    const est = sanitize(estado || 'Asignado a Proveedor');

    try{
      await db.query('BEGIN');
      const notaPersistida = buildEscaladoNota(nota);
      const detalleHistorial = buildHistorialDetalle(nota, observaciones, normalizedProveedor);
      const ins = await db.query(
        `INSERT INTO escalados(
          ticket_id, estado, urgencia, descripcion, nota, observaciones,
          proveedor_id, solicitante_id, area_id, maquina_id, responsable_id
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          t,
          est,
          u,
          d,
          notaPersistida,
          sanitize(observaciones),
          proveedorId,
          ticketSolicitanteId,
          (ticketSnapshot && ticketSnapshot.area_id) ? Number(ticketSnapshot.area_id) : null,
          (ticketSnapshot && ticketSnapshot.maquina_id) ? Number(ticketSnapshot.maquina_id) : null,
          responsableId
        ]
      );
      await db.query('UPDATE tickets SET estado=$1, fecha_escalado=now(), ultima_actualizacion=now() WHERE id=$2', ['Escalado a Servidor Externo', t]);
      await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [t, 'Escalado', 'Escalado a Servidor Externo', responsable || (user.email || user.name) || 'Admin', detalleHistorial]);
      await db.query('COMMIT');
      return res.json({ success: true, escalado: ins.rows[0] });
    }catch(e){
      console.error('Error creating escalado transaction', e);
      await db.query('ROLLBACK');
      return res.status(500).json({ error: 'Error creando escalado' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
