import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate, statusClass } from '../lib/format'
import { useToast } from '../components/ToastProvider'
import { useDialog } from '../components/DialogProvider'

export function normalizeTicketState(value){
  return ((value || '') + '').toString().trim().toLowerCase();
}

export function isActiveTicketState(value){
  const estado = normalizeTicketState(value);
  return estado === 'abierto' || estado === 'en proceso' || estado === 'en espera';
}

export function isResolvedTicketState(value){
  return normalizeTicketState(value) === 'resuelto';
}

export function isEscalatedTicketState(value){
  const estado = normalizeTicketState(value);
  return estado.includes('escalado');
}

function resolveTicketName(ticket, preferredField, fallbackIdField, fallbackField) {
  const value = ticket?.[preferredField] || ticket?.[fallbackField] || '';
  if (value) return value;
  const fallbackValue = ticket?.[fallbackIdField];
  return fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== '' ? String(fallbackValue) : '';
}

export default function Tecnico(){
  const { data: session } = useSession();
  const [tiques, setTiques] = useState([]);
  const [viewTab, setViewTab] = useState('mis'); // mis, resueltos, escalados, todos
  const [sortMode, setSortMode] = useState('fecha_desc'); // fecha_desc, fecha_asc, alpha
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [tecnicos, setTecnicos] = useState([]);
  const [actionData, setActionData] = useState({}); // { [ticketId]: { estado, nota, tecnico } }
  const [selectedTicketInfo, setSelectedTicketInfo] = useState(null);
  const showToast = useToast()
  const { openPrompt, openConfirm } = useDialog()

  useEffect(()=>{ if(session) load(); }, [session]);

  async function load(){
    try{ const r = await api('/tickets'); setTiques(r.tiques || []); }catch(err){ console.error(err); }
  }

  const [escalados, setEscalados] = useState([]);
  const [historialByTicket, setHistorialByTicket] = useState({});
  const [expandedEscalados, setExpandedEscalados] = useState([]);
  async function loadEscalados(){
    try{ const r = await api('/escalados'); setEscalados(r.escalados || []); }catch(err){ console.error(err); }
  }

  async function toggleHistEsc(ticketId){
    const key = String(ticketId);
    if(expandedEscalados.includes(key)){
      setExpandedEscalados(prev => prev.filter(x=>x!==key));
      return;
    }
    if(!historialByTicket[key]){
      try{
        const r = await api('/historial?ticket_id='+encodeURIComponent(key));
        console.log('toggleHistEsc loaded', key, r);
        setHistorialByTicket(h => ({ ...h, [key]: r.historial || [] }));
      }catch(e){ console.error('Error cargando historial', e); return; }
    }
    setExpandedEscalados(prev => Array.from(new Set(prev.concat([key]))));
  }

  async function loadTecnicos(){
    try{ const r = await api('/tecnicos'); setTecnicos(r.tecnicos||[]); }catch(e){ console.error(e); }
  }
  useEffect(()=>{ if(session) loadTecnicos(); }, [session]);
  useEffect(()=>{ if(session) loadEscalados(); }, [session]);


  async function guardar(id){
    const ad = actionData[id] || {};
    const estado = ad.estado;
    const nota = ad.nota || '';
    if(!estado) return showToast('Selecciona un estado', 'error');
    try{
      setActionLoading(true);
      if((estado||'').toString().toLowerCase().includes('escalado')){
        const proveedor = await openPrompt('Proveedor o motivo de escalado:', ad.proveedor || '');
        if(!proveedor) return showToast('Proveedor requerido para escalado', 'error');
        const ok = await openConfirm('Confirmar escalado a: ' + proveedor + '?');
        if(!ok) return;
        const responsable = (session?.user?.nombre) || (session?.user?.email) || '';
        await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota: nota || 'Escalado por técnico', responsable }) });
        showToast('Escalado creado', 'success');
        await load();
      } else {
        await api('/tickets/'+id, { method:'PUT', body: JSON.stringify({ estado, nota, tecnico: ad.tecnico || '', tecnico_id: ad.tecnico_id || '' }) });
        await load();
      }
    }catch(err){ showToast(err.message || 'Error', 'error'); }
    finally{ setActionLoading(false); }
  }

  async function asignar(id, tecnicoSeleccionado){
    const tecnicoId = tecnicoSeleccionado && tecnicoSeleccionado.tecnico_id ? tecnicoSeleccionado.tecnico_id : null;
    const email = tecnicoSeleccionado && tecnicoSeleccionado.email ? tecnicoSeleccionado.email : tecnicoSeleccionado || '';
    const nombreTecnico = tecnicoSeleccionado && tecnicoSeleccionado.nombre ? tecnicoSeleccionado.nombre : (tecnicos.find(tc => String(tc.id) === String(tecnicoId))?.nombre || email || 'Sin técnico');
    if(!email && !tecnicoId) return showToast('No se seleccionó técnico', 'error');
    try{
      setActionLoading(true);
      const ticketActual = (tiques || []).find(t => String(t.id) === String(id)) || {};
      const notaActual = (actionData[id] && actionData[id].nota) || '';
      const detalleNota = notaActual ? `${notaActual} | Asignado a ${nombreTecnico}` : `Asignado a ${nombreTecnico}`;
      await api('/tickets/'+id, {
        method:'PUT',
        body: JSON.stringify({
          estado: ticketActual.estado || 'Abierto',
          nota: detalleNota,
          tecnico: email,
          tecnico_id: tecnicoId || undefined
        })
      });
      await load();
    }
    catch(e){ showToast(e.message || e, 'error'); }
    finally{ setActionLoading(false); }
  }

  async function escalar(id){
    const proveedor = await openPrompt('Proveedor o motivo de escalado:','');
    if(!proveedor) return;
    const ok = await openConfirm('Confirmar escalado a: ' + proveedor + '?');
    if(!ok) return;
    try{
      setActionLoading(true);
      const responsable = (session?.user?.nombre) || (session?.user?.email) || '';
      await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota: 'Escalado por técnico', responsable }) });
      showToast('Escalado creado', 'success');
      await load();
    }
    catch(e){ showToast(e.message || e, 'error'); }
    finally{ setActionLoading(false); }
  }

  function openTicketInfo(ticket){
    if(!ticket) return;
    setSelectedTicketInfo(ticket);
  }

  function closeTicketInfo(){
    setSelectedTicketInfo(null);
  }


  if(!session) return <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>

  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(!['tecnico','admin'].includes(rol)) return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Necesitas permiso de técnico para acceder.</p></div></div>

  return (
    <div className="container">
      <div className="card">
        <h2>Panel Técnico</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12, overflowX:'auto', overflowY:'hidden', WebkitOverflowScrolling:'touch'}}>
          <div style={{display:'flex',gap:6, whiteSpace:'nowrap', flexShrink:0}}>
            <button className={viewTab==='mis' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('mis')}>Mis Tiques</button>
            <button className={viewTab==='resueltos' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('resueltos')}>Resueltos</button>
            <button className={viewTab==='escalados' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('escalados')}>Escalados</button>
            <button className={viewTab==='todos' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('todos')}>Todos</button>
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center', whiteSpace:'nowrap', flexShrink:0}}>
            <input placeholder="Buscar..." value={query} onChange={e=>setQuery(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #e6eef8'}} />
            <select value={sortMode} onChange={e=>setSortMode(e.target.value)} style={{padding:8,borderRadius:8}}>
              <option value="fecha_desc">Fecha: más reciente</option>
              <option value="fecha_asc">Fecha: más antiguo</option>
              <option value="alpha">Alfabético</option>
            </select>
          </div>
        </div>
        <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
          <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
            <thead><tr><th>ID</th><th>Fecha</th><th>Solicitante</th><th>Área</th><th>Máquina</th><th>Fallo</th><th>Urgencia</th><th>Estado</th><th>Información</th><th>Acción</th></tr></thead>
            <tbody>
              {(() => {
                let list = tiques.slice();
                // filtrar por pestaña
                if(viewTab==='mis'){
                  const me = session?.user?.email || session?.user?.id || '';
                  list = list.filter(x => {
                    const isMine = ((x.tecnico_nombre || x.tecnico || '') + '').toString().toLowerCase() === me.toString().toLowerCase()
                      || ((x.tecnico_email || x.tecnico || '') + '').toString().toLowerCase() === me.toString().toLowerCase()
                      || (session?.user?.rol || '').toLowerCase() === 'admin';
                    return isMine && isActiveTicketState(x.estado);
                  });
                } else if(viewTab==='resueltos'){
                  list = list.filter(x => isResolvedTicketState(x.estado));
                } else if(viewTab==='escalados'){
                  list = list.filter(x => isEscalatedTicketState(x.estado) || (escalados || []).some(e => String(e.ticket_id) === String(x.id)));
                }
                // búsqueda
                if(query && query.trim()){
                  const q = query.trim().toLowerCase();
                  list = list.filter(x=> JSON.stringify(x).toLowerCase().includes(q));
                }
                // ordenar
                if(sortMode==='fecha_asc') list.sort((a,b)=> new Date(a.fecha_creacion||a.fecha) - new Date(b.fecha_creacion||b.fecha));
                else if(sortMode==='alpha') list.sort((a,b)=> ((a.solicitante_nombre || a.solicitante || '')).localeCompare((b.solicitante_nombre || b.solicitante || '')));
                else list.sort((a,b)=> new Date(b.fecha_creacion||b.fecha) - new Date(a.fecha_creacion||a.fecha));

                if(list.length===0) return <tr><td colSpan={10}>No hay tiques.</td></tr>;
                return list.map(t => (
                  <tr key={t.id}>
                    <td data-label="ID">{t.id}</td>
                    <td data-label="Fecha">{formatDate(t.fecha_creacion || t.fecha)}</td>
                    <td data-label="Solicitante">{t.solicitante_nombre || t.solicitante || ''}</td>
                    <td data-label="Área">{t.area_nombre || t.area || ''}</td>
                    <td data-label="Máquina">{t.maquina_nombre || t.maquina || ''}</td>
                    <td data-label="Fallo">{t.descripcion}</td>
                    <td data-label="Urgencia">{t.urgencia}</td>
                    <td data-label="Estado"><span className={"badge " + statusClass(t.estado)}>{t.estado}</span></td>
                    <td data-label="Información">
                      <button type="button" onClick={()=>openTicketInfo(t)} className="btn-secondary" title="Ver información del ticket" style={{minWidth: 34, padding: '6px 8px'}}>Info</button>
                    </td>
                    <td data-label="Acción">
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {(() => {
                          const estadoNorm = ((t.estado || '') + '').toLowerCase();
                          const bloqueado = estadoNorm === 'resuelto' || estadoNorm.includes('escalado');
                          const selectedTecnicoId = (actionData[t.id] && (actionData[t.id].tecnico_id ?? actionData[t.id].tecnico)) || (t.tecnico_id || t.tecnico || '');
                          return (
                            <>
                              <select disabled={bloqueado} value={(actionData[t.id] && actionData[t.id].estado) || t.estado || 'Abierto'} onChange={e=>setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), estado: e.target.value } }))}>
                                <option>Abierto</option>
                                <option>En Proceso</option>
                                <option>En Espera</option>
                                <option>Resuelto</option>
                                <option>Escalado a Servidor Externo</option>
                              </select>
                              <textarea disabled={bloqueado} placeholder="Nota/acción" value={(actionData[t.id] && actionData[t.id].nota) || ''} onChange={e=>setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), nota: e.target.value } }))} rows={2} />
                              <div style={{display:'flex',gap:8}}>
                                <select disabled={bloqueado} value={selectedTecnicoId} onChange={e=>{
                                  const chosen = e.target.value;
                                  const tech = tecnicos.find(tc => String(tc.id) === String(chosen));
                                  setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), tecnico: tech?.email || tech?.nombre || chosen, tecnico_id: tech?.id || chosen || '' } }));
                                }}>
                                  <option value="">-- Técnico --</option>
                                  {tecnicos.filter(tc=> (tc.rol||'').toLowerCase()!=='empleado').map(tc=> (
                                    <option key={tc.email||tc.id} value={String(tc.id)}>{(tc.nombre || tc.email) + ' (' + (tc.rol||'') + ')'}</option>
                                  ))}
                                </select>
                                <button onClick={()=>guardar(t.id)} disabled={actionLoading || bloqueado}>{actionLoading? 'Procesando...':'Actualizar'}</button>
                                <button onClick={()=>asignar(t.id, {
                                  email: (actionData[t.id] && (actionData[t.id].tecnico || '')) || (t.tecnico_email || t.tecnico || ''),
                                  nombre: tecnicos.find(tc => String(tc.id) === String((actionData[t.id] && (actionData[t.id].tecnico_id || '')) || (t.tecnico_id || '')))?.nombre || (actionData[t.id] && (actionData[t.id].tecnico || '')) || (t.tecnico_nombre || t.tecnico || ''),
                                  tecnico_id: (actionData[t.id] && (actionData[t.id].tecnico_id || '')) || (t.tecnico_id || '')
                                })} disabled={actionLoading || bloqueado}>{actionLoading? '...':'Asignar'}</button>
                                <button onClick={()=>escalar(t.id)} disabled={actionLoading || bloqueado} style={{marginLeft:8}}>{actionLoading? '...':'Escalar'}</button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        {selectedTicketInfo && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.18)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: 20 }} onClick={closeTicketInfo}>
            <div style={{ width: 'min(1000px, 92vw)', maxHeight: '86vh', overflowY: 'auto', background: '#f8fafc', borderRadius: 12, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)', border: '1px solid #e5e7eb', padding: 20 }} onClick={(e)=> e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Detalle {selectedTicketInfo.id || 'tique'}</div>
                <button onClick={closeTicketInfo} style={{ border: 'none', background: '#e2e8f0', color: '#0f172a', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
              </div>

              <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
                <div><strong>Motivo:</strong> <span>{selectedTicketInfo.descripcion || '—'}</span></div>
                <div><strong>Estado:</strong> <span>{selectedTicketInfo.estado || '—'}</span></div>
                <div><strong>Área:</strong> <span>{resolveTicketName(selectedTicketInfo, 'area_nombre', 'area_id', 'area') || '—'}</span></div>
                <div><strong>Urgencia:</strong> <span>{selectedTicketInfo.urgencia || '—'}</span></div>
                <div><strong>Solicitante:</strong> <span>{resolveTicketName(selectedTicketInfo, 'solicitante_nombre', 'solicitante_id', 'solicitante') || '—'}</span></div>
                <div><strong>Técnico:</strong> <span>{resolveTicketName(selectedTicketInfo, 'tecnico_nombre', 'tecnico_id', 'tecnico') || '—'}</span></div>
                <div><strong>Máquina:</strong> <span>{resolveTicketName(selectedTicketInfo, 'maquina_nombre', 'maquina_id', 'maquina') || '—'}</span></div>
                <div><strong>Fecha creación:</strong> <span>{selectedTicketInfo.fecha_creacion ? formatDate(selectedTicketInfo.fecha_creacion) : '—'}</span></div>
                <div><strong>Fecha asignación:</strong> <span>{selectedTicketInfo.fecha_asignacion ? formatDate(selectedTicketInfo.fecha_asignacion) : '—'}</span></div>
                <div><strong>Fecha en proceso:</strong> <span>{selectedTicketInfo.fecha_en_proceso ? formatDate(selectedTicketInfo.fecha_en_proceso) : '—'}</span></div>
                <div><strong>Fecha en espera:</strong> <span>{selectedTicketInfo.fecha_en_espera ? formatDate(selectedTicketInfo.fecha_en_espera) : '—'}</span></div>
                <div><strong>Fecha resuelto:</strong> <span>{selectedTicketInfo.fecha_resuelto ? formatDate(selectedTicketInfo.fecha_resuelto) : '—'}</span></div>
                <div><strong>Nota:</strong> <span>{selectedTicketInfo.nota || '—'}</span></div>
              </div>

              {((selectedTicketInfo.detalle_items || selectedTicketInfo.items || []).length > 0) && (
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: '#eef6ff' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>ITEM</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>DESCRIPCIÓN</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>CANTIDAD</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>UNIDAD</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700 }}>MARCA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTicketInfo.detalle_items || selectedTicketInfo.items || []).map((item, idx) => (
                        <tr key={`${item.id || idx}-${idx}`} style={{ borderTop: '1px solid #edf2f7' }}>
                          <td style={{ padding: '10px 8px' }}>{item.item || item.id || idx + 1}</td>
                          <td style={{ padding: '10px 8px' }}>{item.descripcion || item.nombre || '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{item.cantidad || item.qty || '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{item.unidad || item.unit || '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{item.marca || item.brand || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{marginTop:12}}>
        <h3>Escalados / Servidores Externos</h3>
        <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
          <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
            <thead><tr><th>ID Tique</th><th>Fecha Escalado</th><th>Proveedor</th><th>Estado</th><th>Responsable</th><th>Nota</th><th>Observaciones</th><th>Historial</th></tr></thead>
            <tbody>
              {escalados.length===0 && <tr><td colSpan={7}>No hay registros de escalado.</td></tr>}
              {escalados.map(e=> (
                <React.Fragment key={e.id}>
                  <tr>
                    <td>{e.ticket_id}</td>
                    <td>{formatDate(e.fecha_escalado)}</td>
                    <td>{e.proveedor_nombre || e.proveedor || ''}</td>
                    <td><span className={"badge " + statusClass(e.estado)}>{e.estado}</span></td>
                    <td>{e.responsable_nombre || e.responsable || ''}</td>
                    <td>{e.nota}</td>
                    <td>{e.observaciones}</td>
                    <td><button onClick={()=>toggleHistEsc(e.ticket_id)}>Historial</button></td>
                  </tr>
                  {expandedEscalados.includes(String(e.ticket_id)) && (
                    <tr>
                      <td colSpan={8} style={{background:'#fbfdff'}}>
                        <div style={{padding:8}}>
                          {(historialByTicket[String(e.ticket_id)]||[]).length===0 && <div className="small">No hay historial.</div>}
                          {(historialByTicket[String(e.ticket_id)]||[]).map(h=> (
                            <div key={h.id} style={{padding:6,borderBottom:'1px solid #eef2ff'}}>
                              <div style={{fontSize:12,color:'#374151'}}>{formatDate(h.fecha)}</div>
                              <div style={{fontWeight:600}}>{h.accion} — {h.estado || ''}</div>
                              <div className="small">{h.usuario} — {h.detalle || ''}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
