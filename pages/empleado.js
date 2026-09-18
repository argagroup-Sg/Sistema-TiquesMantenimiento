import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'

// Funciones auxiliares para que la tabla no dé error si no las tienes importadas
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  } catch (e) { return dateStr; }
};

const statusClass = (estado) => {
  if (!estado) return 'abierto';
  return estado.toString().toLowerCase().replace(/\s+/g, '-');
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
};

export default function Empleado(){
  const { data: session } = useSession();
  const [form, setForm] = useState({ solicitante:'', solicitante_id:'', area_id:'', maquina_id:'', urgencia:'Baja', descripcion:'' });
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [tiques, setTiques] = useState([]);
  const [escalados, setEscalados] = useState([]);
  const [selectedInfoTicket, setSelectedInfoTicket] = useState(null);
  const [selectedHistoryTicket, setSelectedHistoryTicket] = useState(null);
  const [error, setError] = useState('');

  // 1. Auto-rellenar el solicitante con el nombre de la sesión activa en cuanto cargue
  useEffect(() => {
    if (session?.user) {
      const userName = session.user.name || session.user.nombre || session.user.email || '';
      setForm(prevForm => ({
        ...prevForm,
        solicitante: userName,
        solicitante_id: session.user.id || session.user.sub || prevForm.solicitante_id || ''
      }));
    }
  }, [session]);

  async function enviar(e){
    e && e.preventDefault();
    if(!form.solicitante || !form.area_id || !form.maquina_id || !form.descripcion){ setError('Completa todos los campos.'); return }
    try{
      setLoading(true);
      const payload = {
        ...form,
        solicitante_id: form.solicitante_id || session?.user?.id || session?.user?.sub || '',
        area_id: Number(form.area_id),
        maquina_id: Number(form.maquina_id)
      };
      const r = await api('/tickets', { method:'POST', body: JSON.stringify(payload) });
      alert('Tique creado: ' + r.id);
      
      setForm({ 
        solicitante: session?.user?.name || session?.user?.nombre || session?.user?.email || '',
        solicitante_id: session?.user?.id || session?.user?.sub || '',
        area_id:'',
        maquina_id:'',
        urgencia:'Baja',
        descripcion:''
      });
      setError('');
      loadCatalogs();
    }catch(err){
      alert(err.message || 'Error');
    }finally{ setLoading(false); }
  }

  useEffect(()=>{ loadCatalogs(); }, []);
  async function loadCatalogs(){
    try{ 
      const a = await api('/areas'); setAreas(a.areas || []); 
      const m = await api('/maquinas'); setMaquinas(m.maquinas || []);     
      const t = await api('/tickets'); setTiques(t.tiques || []);
      const e = await api('/escalados'); setEscalados(e.escalados || []);
    }catch(err){ 
      console.error(err); 
    }
  }

  function getEscaladoInfo(ticketId){
    if(!ticketId) return null;
    return (escalados || []).find(e => String(e.ticket_id) === String(ticketId)) || null;
  }

  function getTicketStateDate(ticket){
    if (!ticket) return null;
    const estado = String(ticket.estado || '').toLowerCase();
    const escalado = getEscaladoInfo(ticket.id);
    if (estado.includes('resuelto')) return ticket.fecha_resuelto || escalado?.fecha_resuelto || ticket.fecha_creacion || null;
    if (estado.includes('espera')) return ticket.fecha_en_espera || escalado?.fecha_en_espera || escalado?.fecha_escalado || ticket.fecha_creacion || null;
    if (estado.includes('proceso')) return ticket.fecha_en_proceso || escalado?.fecha_en_proceso || escalado?.fecha_escalado || ticket.fecha_creacion || null;
    if (estado.includes('escalado a servidor externo')) return escalado?.fecha_escalado || ticket.fecha_escalado || ticket.fecha_creacion || null;
    return ticket.fecha_creacion || null;
  }

  function getEscaladoStateDate(escalado){
    if (!escalado) return null;
    const estado = String(escalado.estado || '').toLowerCase();
    if (estado.includes('resuelto')) return escalado.fecha_resuelto || escalado.fecha_escalado || null;
    if (estado.includes('espera')) return escalado.fecha_en_espera || escalado.fecha_escalado || null;
    if (estado.includes('proceso')) return escalado.fecha_en_proceso || escalado.fecha_escalado || null;
    return escalado.fecha_escalado || null;
  }

  function sortHistorialAsc(historial){
    return [...(historial || [])].sort((a, b) => {
      const da = a && a.fecha ? new Date(a.fecha).getTime() : 0;
      const db = b && b.fecha ? new Date(b.fecha).getTime() : 0;
      return da - db;
    });
  }

  async function abrirHistorial(ticketId){
    if(!ticketId) return;
    try{
      const h = await api('/historial?ticket_id=' + encodeURIComponent(String(ticketId)));
      const ticket = (tiques||[]).find(t => String(t.id) === String(ticketId)) || null;
      setSelectedHistoryTicket({ ...(ticket || {}), historial: sortHistorialAsc(h.historial || []) });
    }catch(err){
      console.error('Error cargando historial del tique', err);
    }
  }

  if(!session) return (
    <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>
  )

  // Validación de rol segura e insensible a mayúsculas/minúsculas
  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(!['empleado','admin','tecnico'].includes(rol)) return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Tu cuenta no tiene permiso para crear tiques.</p></div></div>

  return (
    <div className="container">
      <div className="card">
        <h2>Reportar Falla EA</h2>
        <form onSubmit={enviar}>
          <label>Tu nombre</label>
          <input 
            value={form.solicitante} 
            readOnly 
            style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} 
          />          
          <label>Área</label>
          <select value={form.area_id} onChange={e=>setForm({...form, area_id:e.target.value})}><option value="">Seleccione</option>{areas.map(a=> <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
          
          <label>Máquina</label>
          <select value={form.maquina_id} onChange={e=>setForm({...form, maquina_id:e.target.value})}><option value="">Seleccione</option>{maquinas.map(m=> <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
          
          <label>Urgencia</label>
          <select value={form.urgencia} onChange={e=>setForm({...form,urgencia:e.target.value})}><option>Baja</option><option>Media</option><option>Alta</option><option>Parada de Planta</option></select>
          
          <label>Descripción</label>
          <textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} rows={5}></textarea>
          
          {error && <div style={{color:'red',marginBottom:8}}>{error}</div>}
          <button type="submit" disabled={loading}>{loading? 'Enviando...':'Enviar Tique'}</button>
        </form>
      </div>
      
      <div className="card" style={{marginTop:12}}>
        <h3>Lista de Tiques</h3>
        <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
          <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
            <thead style={{background:'#2563eb',color:'#fff'}}>
              <tr><th>ID</th><th>Fecha</th><th>Solicitante</th><th>Area</th><th>Máquina</th><th>Fallo</th><th>Urgencia</th><th>Estado</th><th>Info</th></tr>
            </thead>
            <tbody>
              {tiques.length===0 && <tr><td colSpan={9}>No hay tiques.</td></tr>}
              {tiques.map(t=>(
                  <tr key={t.id} style={{borderBottom:'1px solid #eee'}}>
                    <td><strong>{t.id}</strong></td>
                    <td>{formatDate(t.fecha_creacion || t.fecha)}</td>
                    <td>{t.solicitante_nombre || t.solicitante || ''}</td>
                    <td>{t.area_nombre || t.area || ''}</td>
                    <td>{t.maquina_nombre || t.maquina || ''}</td>
                    <td>
                      <input readOnly value={t.descripcion || ''} style={{ minWidth:120, width:'auto', padding:6, borderRadius:4, border:'1px solid #e6eef8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', background:'#fff', color:'#111827' }} />
                    </td>
                    <td>{t.urgencia}</td>
                    <td><span className={"badge " + statusClass(t.estado)}>{t.estado || 'Abierto'}</span></td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      <button type="button" className="btn-secondary" onClick={()=> setSelectedInfoTicket(t)}>Info</button>
                      <button type="button" className="btn-secondary" onClick={()=> abrirHistorial(t.id)} style={{marginLeft:8}}>Historial</button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInfoTicket && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.18)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000, padding:20 }} onClick={()=> setSelectedInfoTicket(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:20, width:'min(760px, 92vw)', maxHeight:'82vh', overflowY:'auto', boxShadow:'0 30px 60px rgba(15, 23, 42, 0.22)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'#0f172a' }}>Detalle del tique {selectedInfoTicket.id || '—'}</div>
              <button onClick={()=> setSelectedInfoTicket(null)} style={{ border:'none', background:'#e2e8f0', color:'#0f172a', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:600 }}>Cerrar</button>
            </div>

            <div style={{ display:'grid', gap:10, color:'#0f172a' }}>
              <div><strong>Estado:</strong> <span>{selectedInfoTicket.estado || '—'}</span></div>
              <div><strong>Fecha del estado:</strong> <span>{getTicketStateDate(selectedInfoTicket) ? formatDateTime(getTicketStateDate(selectedInfoTicket)) : '—'}</span></div>
              <div><strong>Fecha de creación del tique:</strong> <span>{selectedInfoTicket.fecha_creacion ? formatDateTime(selectedInfoTicket.fecha_creacion) : '—'}</span></div>
              <div><strong>Área:</strong> <span>{selectedInfoTicket.area_nombre || selectedInfoTicket.area || '—'}</span></div>
              <div><strong>Máquina:</strong> <span>{selectedInfoTicket.maquina_nombre || selectedInfoTicket.maquina || '—'}</span></div>
              <div><strong>Urgencia:</strong> <span>{selectedInfoTicket.urgencia || '—'}</span></div>
              <div><strong>Solicitante:</strong> <span>{selectedInfoTicket.solicitante_nombre || selectedInfoTicket.solicitante || '—'}</span></div>
              <div><strong>Descripción:</strong> <span>{selectedInfoTicket.descripcion || '—'}</span></div>
            </div>

            {String(selectedInfoTicket.estado || '').toLowerCase().includes('escalado a servidor externo') && (() => {
              const escalado = getEscaladoInfo(selectedInfoTicket.id);
              if(!escalado) return null;
              return (
                <div style={{ marginTop:18, borderTop:'1px solid #e5e7eb', paddingTop:16 }}>
                  <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>Información del escalado</div>
                  <div style={{ display:'grid', gap:10 }}>
                    <div><strong>Proveedor:</strong> <span>{escalado.proveedor_nombre || escalado.proveedor || '—'}</span></div>
                    <div><strong>Responsable:</strong> <span>{escalado.responsable_nombre || escalado.responsable || '—'}</span></div>
                    <div><strong>Estado del escalado:</strong> <span>{escalado.estado || '—'}</span></div>
                    <div><strong>Fecha del estado:</strong> <span>{getEscaladoStateDate(escalado) ? formatDateTime(getEscaladoStateDate(escalado)) : '—'}</span></div>
                    <div><strong>Nota:</strong> <span>{escalado.nota || '—'}</span></div>
                    <div><strong>Observaciones:</strong> <span>{escalado.observaciones || '—'}</span></div>
                    <div><strong>Fecha de escalado a servidor externo:</strong> <span>{escalado.fecha_escalado ? formatDateTime(escalado.fecha_escalado) : '—'}</span></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {selectedHistoryTicket && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.18)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000, padding:20 }} onClick={()=> setSelectedHistoryTicket(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:20, width:'min(760px, 92vw)', maxHeight:'82vh', overflowY:'auto', boxShadow:'0 30px 60px rgba(15, 23, 42, 0.22)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'#0f172a' }}>Historial del tique {selectedHistoryTicket.id || '—'}</div>
              <button onClick={()=> setSelectedHistoryTicket(null)} style={{ border:'none', background:'#e2e8f0', color:'#0f172a', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:600 }}>Cerrar</button>
            </div>
            <div style={{ display:'grid', gap:10 }}>
              {(selectedHistoryTicket.historial || []).length === 0 && <div>No hay historial para este tique.</div>}
              {(selectedHistoryTicket.historial || []).map((h, index) => (
                <div key={h.id || `${h.fecha || 'item'}-${index}`} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:10 }}>
                  <div><strong>Fecha:</strong> <span>{h.fecha ? formatDateTime(h.fecha) : '—'}</span></div>
                  <div><strong>Acción:</strong> <span>{h.accion || '—'}</span></div>
                  <div><strong>Estado:</strong> <span>{h.estado || '—'}</span></div>
                  <div><strong>Usuario:</strong> <span>{h.usuario || '—'}</span></div>
                  <div><strong>Detalle:</strong> <span>{h.detalle || '—'}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
