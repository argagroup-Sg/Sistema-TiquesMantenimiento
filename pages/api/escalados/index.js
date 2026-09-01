const db = require('../../../lib/db');
const { getUserFromReq, requireRole } = require('../../../lib/auth');

function sanitize(s){return String(s||'').trim();}

async function handler(req,res){
  if(req.method==='GET'){
    const r = await db.query('SELECT * FROM escalados ORDER BY fecha_escalado DESC');
    return res.json({ escalados: r.rows });
  }

  const user = await getUserFromReq(req);
  if (!requireRole(user, ['admin','tecnico'])) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if(req.method==='POST'){
    const { ticket_id, proveedor, observaciones, nota, responsable, solicitante, area, maquina, urgencia, descripcion, estado } = req.body || {};
    if(!ticket_id) return res.status(400).json({ error: 'ticket_id requerido' });
    const t = sanitize(ticket_id);
    const p = sanitize(proveedor || 'Sin proveedor');
    const s = sanitize(solicitante || '');
    const a = sanitize(area || '');
    const m = sanitize(maquina || '');
    const u = sanitize(urgencia || '');
    const d = sanitize(descripcion || '');
    const est = sanitize(estado || 'Asignado a Proveedor');

    await db.query(
      'INSERT INTO escalados(ticket_id, proveedor, estado, solicitante, area, maquina, urgencia, descripcion, responsable, nota, observaciones) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)'
      , [t,p,est,s,a,m,u,d, sanitize(responsable), sanitize(nota), sanitize(observaciones)]
    );

    await db.query('UPDATE tickets SET estado=$1, fecha_escalado=now(), ultima_actualizacion=now() WHERE id=$2', ['Escalado a Servidor Externo', t]);
    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [t, 'Escalado', 'Escalado a Servidor Externo', responsable || (user.email || user.name) || 'Admin', nota || '']);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
