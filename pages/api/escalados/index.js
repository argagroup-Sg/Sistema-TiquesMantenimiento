const db = require('../../../../lib/db');

function sanitize(s){return String(s||'').trim();}

module.exports = async function handler(req,res){
  if(req.method==='GET'){
    const r = await db.query('SELECT * FROM escalados ORDER BY fecha_escalado DESC');
    return res.json({ escalados: r.rows });
  }

  if(req.method==='POST'){
    const { ticket_id, proveedor, observaciones, nota, responsable } = req.body || {};
    if(!ticket_id) return res.status(400).json({ error: 'ticket_id requerido' });
    const t = sanitize(ticket_id);
    const p = sanitize(proveedor || 'Sin proveedor');
    await db.query('INSERT INTO escalados(ticket_id, proveedor, estado, responsable, nota, observaciones) VALUES($1,$2,$3,$4,$5,$6)', [t,p,'Asignado a Proveedor', sanitize(responsable), sanitize(nota), sanitize(observaciones)]);
    await db.query('UPDATE tickets SET estado=$1, fecha_escalado=now(), ultima_actualizacion=now() WHERE id=$2', ['Escalado a Servidor Externo', t]);
    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [t, 'Escalado', 'Escalado a Servidor Externo', responsable || 'Admin', nota || '']);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
