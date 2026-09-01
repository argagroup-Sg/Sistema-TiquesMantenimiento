const db = require('../../lib/db');

async function handler(req,res){
  if(req.method==='GET'){
    const { ticket_id } = req.query || {};
    if(ticket_id){
      const r = await db.query('SELECT * FROM historial WHERE ticket_id=$1 ORDER BY fecha DESC', [ticket_id]);
      return res.json({ historial: r.rows });
    }
    const r = await db.query('SELECT * FROM historial ORDER BY fecha DESC LIMIT 500');
    return res.json({ historial: r.rows });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
