import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate, statusClass } from '../lib/format'
import { useToast } from '../components/ToastProvider'
import { useDialog } from '../components/DialogProvider'

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
      // Si el nuevo estado es escalado a servidor externo, crear un escalado en vez de actualizar directamente el ticket
      if((estado||'').toString().toLowerCase().includes('escalado')){
        // pedir proveedor/motivo
        const proveedor = await openPrompt('Proveedor o motivo de escalado:', ad.proveedor || '');
        if(!proveedor) return showToast('Proveedor requerido para escalado', 'error');
        const ok = await openConfirm('Confirmar escalado a: ' + proveedor + '?');
        if(!ok) return;
        const responsable = (session?.user?.nombre) || (session?.user?.email) || '';
        await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota: nota || 'Escalado por técnico', responsable }) });
        showToast('Escalado creado', 'success');
        await load();
      } else {
        await api('/tickets/'+id, { method:'PUT', body: JSON.stringify({ estado, nota, tecnico: ad.tecnico }) });
        // refrescar lista
        await load();
      }
    }catch(err){ showToast(err.message || 'Error', 'error'); }
    finally{ setActionLoading(false); }
  }

  async function asignar(id, email){
    if(!email) return showToast('No se seleccionó técnico', 'error');
    try{ setActionLoading(true); await api('/tickets/'+id, { method:'PUT', body: JSON.stringify({ tecnico: email }) }); await load(); }
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


  if(!session) return <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>

  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(!['tecnico','admin'].includes(rol)) return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Necesitas permiso de técnico para acceder.</p></div></div>

  return (
    <div className="container">
      <div className="card">
        <h2>Panel Técnico</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
          <div style={{display:'flex',gap:6}}>
            <button className={viewTab==='mis' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('mis')}>Mis Tiques</button>
            <button className={viewTab==='resueltos' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('resueltos')}>Resueltos</button>
            <button className={viewTab==='escalados' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('escalados')}>Escalados</button>
            <button className={viewTab==='todos' ? 'tab-active' : 'tab'} onClick={()=>setViewTab('todos')}>Todos</button>
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            <input placeholder="Buscar..." value={query} onChange={e=>setQuery(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #e6eef8'}} />
            <select value={sortMode} onChange={e=>setSortMode(e.target.value)} style={{padding:8,borderRadius:8}}>
              <option value="fecha_desc">Fecha: más reciente</option>
              <option value="fecha_asc">Fecha: más antiguo</option>
              <option value="alpha">Alfabético</option>
            </select>
          </div>
        </div>
        <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
          <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
            <thead><tr><th>ID</th><th>Fecha</th><th>Solicitante</th><th>Área</th><th>Máquina</th><th>Fallo</th><th>Urgencia</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {(() => {
                let list = tiques.slice();
                // filtrar por pestaña
                if(viewTab==='mis'){
                  const me = session?.user?.email || session?.user?.id || '';
                  list = list.filter(x=> (x.tecnico||'').toString().toLowerCase() === me.toString().toLowerCase() || (session?.user?.rol||'').toLowerCase()==='admin');
                } else if(viewTab==='resueltos'){
                  list = list.filter(x=> ((x.estado||'') + '').toLowerCase() === 'resuelto');
                } else if(viewTab==='escalados'){
                  list = list.filter(x=> ((x.estado||'') + '').toLowerCase().includes('escalado') || (escalados||[]).some(e=>e.ticket_id==x.id));
                }
                // búsqueda
                if(query && query.trim()){
                  const q = query.trim().toLowerCase();
                  list = list.filter(x=> JSON.stringify(x).toLowerCase().includes(q));
                }
                // ordenar
                if(sortMode==='fecha_asc') list.sort((a,b)=> new Date(a.fecha_creacion||a.fecha) - new Date(b.fecha_creacion||b.fecha));
                else if(sortMode==='alpha') list.sort((a,b)=> (a.solicitante||'').localeCompare(b.solicitante||''));
                else list.sort((a,b)=> new Date(b.fecha_creacion||b.fecha) - new Date(a.fecha_creacion||a.fecha));

                if(list.length===0) return <tr><td colSpan={9}>No hay tiques.</td></tr>;
                return list.map(t => (
                  <tr key={t.id}>
                    <td data-label="ID">{t.id}</td>
                    <td data-label="Fecha">{formatDate(t.fecha_creacion || t.fecha)}</td>
                    <td data-label="Solicitante">{t.solicitante}</td>
                    <td data-label="Área">{t.area}</td>
                    <td data-label="Máquina">{t.maquina}</td>
                    <td data-label="Fallo">{t.descripcion}</td>
                    <td data-label="Urgencia">{t.urgencia}</td>
                    <td data-label="Estado"><span className={"badge " + statusClass(t.estado)}>{t.estado}</span></td>
                    <td data-label="Acción">
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {(() => {
                          const bloqueado = ((t.estado||'') + '').toLowerCase() === 'resuelto';
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
                                <select disabled={bloqueado} value={(actionData[t.id] && actionData[t.id].tecnico) || (t.tecnico || '')} onChange={e=>setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), tecnico: e.target.value } }))}>
                                  <option value="">-- Técnico --</option>
                                  {tecnicos.filter(tc=> (tc.rol||'').toLowerCase()!=='empleado').map(tc=> (
                                    <option key={tc.email||tc.id} value={tc.email||tc.id}>{(tc.nombre || tc.email) + ' (' + (tc.rol||'') + ')'}</option>
                                  ))}
                                </select>
                                <button onClick={()=>guardar(t.id)} disabled={actionLoading || bloqueado}>{actionLoading? 'Procesando...':'Actualizar'}</button>
                                <button onClick={()=>asignar(t.id, (actionData[t.id] && actionData[t.id].tecnico) || t.tecnico)} disabled={actionLoading || bloqueado}>{actionLoading? '...':'Asignar'}</button>
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
      </div>
      <div className="card" style={{marginTop:12}}>
        <h3>Escalados / Servidores Externos</h3>
        <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
          <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
            <thead><tr><th>ID Tique</th><th>Fecha Escalado</th><th>Proveedor</th><th>Estado</th><th>Responsable</th><th>Nota</th><th>Observaciones</th></tr></thead>
            <tbody>
              {escalados.length===0 && <tr><td colSpan={7}>No hay registros de escalado.</td></tr>}
              {escalados.map(e=> (
                <React.Fragment key={e.id}>
                  <tr>
                    <td>{e.ticket_id}</td>
                    <td>{formatDate(e.fecha_escalado)}</td>
                    <td>{e.proveedor}</td>
                    <td><span className={"badge " + statusClass(e.estado)}>{e.estado}</span></td>
                    <td>{e.responsable}</td>
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
