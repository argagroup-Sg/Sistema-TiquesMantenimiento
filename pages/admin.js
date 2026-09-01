import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate, statusClass } from '../lib/format'

function BarChart({ data, width=300, height=120, color='#2563eb' }){
  const total = data.reduce((s,i)=>s+i.value,0) || 1;
  const gap = 6; const barW = (width - (data.length-1)*gap) / Math.max(1,data.length);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d,i)=>{
        const h = Math.round((d.value/total) * (height-24));
        const x = i*(barW+gap);
        return (<g key={d.label}>
          <rect x={x} y={height-16-h} width={barW} height={h} rx={4} fill={d.color||color} />
          <text x={x+barW/2} y={height-4} fontSize={10} fill="#111" textAnchor="middle">{d.label}</text>
        </g>)
      })}
    </svg>
  )
}

function ReportByStatus({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.estado || 'Abierto'] = (counts[t.estado || 'Abierto']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

function ReportByUrgencia({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.urgencia || 'Baja'] = (counts[t.urgencia || 'Baja']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} color="#10b981" /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

function ReportByArea({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.area || 'Sin área'] = (counts[t.area || 'Sin área']||0)+1);
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>({ label:e[0], value:e[1] }));
  return (<div><BarChart data={entries} color="#7c3aed" /><ol>{entries.map(e=> <li key={e.label}>{e.label}: {e.value}</li>)}</ol></div>)
}

function ReportEscalados({ escalados }){
  const counts = {};
  (escalados||[]).forEach(e=> counts[e.proveedor || 'Sin proveedor'] = (counts[e.proveedor || 'Sin proveedor']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} color="#ef4444" /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

export default function Admin(){
  const { data: session } = useSession();
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [escalados, setEscalados] = useState([]);
  const [savingIds, setSavingIds] = useState([]);

  const [newArea, setNewArea] = useState('');
  const [newMaquina, setNewMaquina] = useState('');
  const [userForm, setUserForm] = useState({ email:'', nombre:'', rol:'empleado', password:'' });
  const [areaLoading, setAreaLoading] = useState(false);
  const [maquinaLoading, setMaquinaLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(()=>{ if(session) loadAll(); }, [session]);
  const [toasts, setToasts] = useState([]);
  const [historialByTicket, setHistorialByTicket] = useState({});
  const [expandedTickets, setExpandedTickets] = useState([]);

  function showToast(message, type='info', ttl=4000){
    const id = Date.now() + Math.random().toString(36).slice(2,8);
    setToasts(t => t.concat([{ id, message, type }]));
    setTimeout(()=> setToasts(t => t.filter(x=>x.id!==id)), ttl);
  }

  async function loadAll(){
    try{
      const a = await api('/areas'); setAreas(a.areas || []);
      const m = await api('/maquinas'); setMaquinas(m.maquinas || []);
      const p = await api('/proveedores'); setProveedores(p.proveedores || []);
      const u = await api('/users'); setUsuarios(u.users || []);
      const t = await api('/tickets'); setTickets(t.tickets || t.tiques || []);
      const tec = await api('/tecnicos'); setTecnicos(tec.users || tec.tecnicos || []);
      const es = await api('/escalados'); setEscalados(es.escalados || []);
    }catch(err){ console.error(err); showToast(err.message || String(err), 'error'); }
  }

  async function guardarTicketAdmin(id){
    if(!confirm('Guardar cambios en el ticket?')) return;
    const confirmarId = String(id);
    setSavingIds(prev => Array.from(new Set(prev.concat([confirmarId]))));
    try{
      const descripcion = document.getElementById('desc-'+id)?.value || '';
      const nota = document.getElementById('not-'+id)?.value || '';
      const area = document.getElementById('area-'+id)?.value || '';
      const maquina = document.getElementById('maquina-'+id)?.value || '';
      const estado = document.getElementById('est-'+id)?.value || '';
      const tecnico = document.getElementById('tecnico-'+id)?.value || '';
      await api('/tickets/'+id, { method:'PUT', body: JSON.stringify({ descripcion, nota, area, maquina, estado, tecnico }) });
      await loadAll();
      showToast('Ticket guardado', 'success');
    }catch(e){ console.error(e); showToast && showToast(e.message || String(e), 'error'); }
    finally{ setSavingIds(prev => prev.filter(x=>x!==confirmarId)); }
  }

  async function guardarEscalado(id){
    try{
      const proveedor = document.getElementById('esc-prov-'+id)?.value || '';
      const estado = document.getElementById('esc-est-'+id)?.value || '';
      const responsable = document.getElementById('esc-resp-'+id)?.value || '';
      const nota = document.getElementById('esc-not-'+id)?.value || '';
      const observaciones = document.getElementById('esc-obs-'+id)?.value || '';
      await api('/escalados/'+id, { method:'PUT', body: JSON.stringify({ proveedor, estado, responsable, nota, observaciones }) });
      await loadAll();
      showToast('Escalado actualizado', 'success');
    }catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function eliminarEscalado(id){
    if(!confirm('Confirmar eliminación del registro de escalado?')) return;
    try{ await api('/escalados/'+id, { method:'DELETE' }); await loadAll(); showToast('Eliminado', 'success'); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function escalarTicket(id){
    const proveedor = window.prompt ? window.prompt('Proveedor externo (nombre):') : '';
    if(!proveedor) return;
    const nota = window.prompt ? window.prompt('Nota para el escalado (opcional):') || '' : '';
    if(!confirm('Confirmar escalado a proveedor: ' + proveedor + '?')) return;
    const confirmarId = String(id);
    setSavingIds(prev => Array.from(new Set(prev.concat([confirmarId]))));
    try{
      await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota }) });
      await loadAll();
      showToast('Ticket escalado', 'success');
    }catch(e){ console.error(e); showToast && showToast(e.message || String(e), 'error'); }
    finally{ setSavingIds(prev => prev.filter(x=>x!==confirmarId)); }
  }

  async function addArea(){
    if(!newArea.trim()) return showToast('Nombre requerido', 'error');
    try{
      setAreaLoading(true);
      await api('/areas', { method:'POST', body: JSON.stringify({ nombre:newArea }) });
      setNewArea('');
      await loadAll();
    }catch(e){ showToast && showToast(e.message || String(e), 'error'); }
    finally{ setAreaLoading(false); }
  }

  async function addMaquina(){
    if(!newMaquina.trim()) return showToast('Nombre requerido', 'error');
    try{
      setMaquinaLoading(true);
      await api('/maquinas', { method:'POST', body: JSON.stringify({ nombre:newMaquina }) });
      setNewMaquina('');
      await loadAll();
    }catch(e){ showToast && showToast(e.message || String(e), 'error'); }
    finally{ setMaquinaLoading(false); }
  }

  async function addProveedor(){
    const nombre = prompt('Nombre del proveedor:');
    if(!nombre) return;
    const contacto = prompt('Contacto (email/telefono) (opcional):') || '';
    try{ await api('/proveedores', { method:'POST', body: JSON.stringify({ nombre, contacto }) }); await loadAll(); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function removeItem(path){
    if(!confirm('Confirmar eliminación')) return;
    try{ await api(path, { method:'DELETE' }); await loadAll(); showToast('Eliminado', 'success'); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function editItem(path, current){
    const nuevo = prompt('Nuevo valor', current);
    if(nuevo==null) return;
    try{ await api(path, { method:'PUT', body: JSON.stringify({ nombre:nuevo }) }); await loadAll(); showToast('Actualizado', 'success'); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function addUsuario(){
    if(!userForm.email || !userForm.nombre) return showToast('Email y nombre son obligatorios', 'error');
    if(userForm.password && userForm.password.length < 6) return showToast('Password mínimo 6 caracteres', 'error');
    try{
      setUserLoading(true);
      await api('/users', { method:'POST', body: JSON.stringify(userForm) });
      setUserForm({ email:'', nombre:'', rol:'empleado', password:'' });
      await loadAll();
    }catch(e){ showToast(e.message || String(e), 'error'); }
    finally{ setUserLoading(false); }
  }

  async function toggleHist(id){
    const key = String(id);
    if(expandedTickets.includes(key)){
      setExpandedTickets(prev => prev.filter(x=>x!==key));
      return;
    }
    // fetch historial if not present
    if(!historialByTicket[key]){
      try{
        const r = await api('/historial?ticket_id='+encodeURIComponent(key));
        setHistorialByTicket(h => ({ ...h, [key]: r.historial || [] }));
      }catch(e){ showToast('Error cargando historial', 'error'); return; }
    }
    setExpandedTickets(prev => Array.from(new Set(prev.concat([key]))));
  }

  if(!session) return <div className="container"><div className="card"><h3>Debes iniciar sesión</h3><p>Inicia sesión para acceder al panel de administración.</p></div></div>

  // protección por rol: solo admins
  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(rol !== 'admin') return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Necesitas rol <strong>admin</strong> para acceder.</p></div></div>

  return (
    <div className="container">
      <h2>Panel de Administración</h2>
      <div className="card">
        <h3>Tiques</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Solicitante</th>
              <th>Área</th>
              <th>Máquina</th>
              <th>Urgencia</th>
              <th>Estado</th>
              <th>Técnico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => {
              const key = String(t.id);
              const isExpanded = expandedTickets.includes(key);
              const bloqueado = ((t.estado||'') + '').toLowerCase() === 'resuelto';
              return (
                <React.Fragment key={t.id}>
                  <tr>
                    <td><strong>{t.id}</strong></td>
                    <td>{formatDate(t.fecha_creacion || t.fecha || t.fechaCreacion)}</td>
                    <td>{t.solicitante}</td>
                    <td><select id={'area-'+t.id} defaultValue={t.area || ''} disabled={bloqueado}>
                      <option value="">--</option>
                      {areas.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                    </select></td>
                    <td><select id={'maquina-'+t.id} defaultValue={t.maquina || ''} disabled={bloqueado}>
                      <option value="">--</option>
                      {maquinas.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select></td>
                    <td>{t.urgencia}</td>
                    <td><span className={'badge '+statusClass(t.estado)}>{t.estado || 'Abierto'}</span>
                      <br />
                      <select id={'est-'+t.id} defaultValue={t.estado || 'Abierto'} disabled={bloqueado}>
                        <option>Abierto</option>
                        <option>En Proceso</option>
                        <option>En Espera</option>
                        <option>Resuelto</option>
                        <option>Escalado a Servidor Externo</option>
                      </select>
                    </td>
                    <td>
                      <select id={'tecnico-'+t.id} defaultValue={t.tecnico || ''} disabled={bloqueado}>
                        <option value="">--</option>
                        {tecnicos.filter(tc=> (tc.rol||'').toLowerCase()!=='empleado').map(tc => <option key={tc.email || tc.id} value={tc.email || tc.id}>{(tc.nombre || tc.email) + ' (' + (tc.rol||'') + ')'}</option>)}
                      </select>
                    </td>
                    <td>
                      <input id={'desc-'+t.id} defaultValue={t.descripcion || ''} disabled={bloqueado} />
                      <textarea id={'not-'+t.id} defaultValue={t.nota || ''} rows={2} disabled={bloqueado} />
                      <div style={{marginTop:6}}>
                        {(() => {
                          const isSaving = savingIds.includes(String(t.id));
                          return (
                            <>
                              <button className="btn-success" onClick={()=>guardarTicketAdmin(t.id)} disabled={isSaving || bloqueado}>{isSaving? 'Guardando...':'Guardar'}</button>
                              <button className="btn-warning" onClick={()=>escalarTicket(t.id)} disabled={isSaving || bloqueado} style={{marginLeft:8}}>{isSaving? 'Procesando...':'Escalar'}</button>
                              <button style={{marginLeft:8}} onClick={()=>toggleHist(t.id)} className="btn-secondary">{isExpanded? 'Ocultar historial':'Ver historial'}</button>
                            </>
                          )
                        })()}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9}>
                        <div className="historial-list">
                          {(historialByTicket[key]||[]).length===0 && <div className="small">No hay historial.</div>}
                          {(historialByTicket[key]||[]).map(h=> (
                            <div key={h.id} className="historial-item">
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
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="card" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <h3>Áreas</h3>
          <input value={newArea} onChange={e=>setNewArea(e.target.value)} placeholder="Ej. Planta 1" />
          <button onClick={addArea} disabled={areaLoading}>{areaLoading? 'Guardando...':'Guardar Área'}</button>
          <ul>{areas.map(a=> <li key={a.id}>{a.nombre}</li>)}</ul>
        </div>

        <div>
          <h3>Maquinarias</h3>
          <input value={newMaquina} onChange={e=>setNewMaquina(e.target.value)} placeholder="Ej. Compresor #3" />
          <button onClick={addMaquina} disabled={maquinaLoading}>{maquinaLoading? 'Guardando...':'Guardar Máquina'}</button>
          <ul>{maquinas.map(m=> <li key={m.id}>{m.nombre}</li>)}</ul>
        </div>

        <div>
          <h3>Proveedores</h3>
          <button onClick={addProveedor}>Añadir Proveedor</button>
          <ul>{proveedores.map(p=> (
            <li key={p.id}>{p.nombre} ({p.contacto||''}) {' '}
              <button onClick={()=>editItem('/proveedores/'+p.id, p.nombre)}>Editar</button>
              <button onClick={()=>removeItem('/proveedores/'+p.id)}>Eliminar</button>
            </li>
          ))}</ul>
        </div>

        <div>
          <h3>Usuarios</h3>
          <input placeholder="correo@empresa.com" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} />
          <input placeholder="Nombre" value={userForm.nombre} onChange={e=>setUserForm({...userForm,nombre:e.target.value})} />
          <select value={userForm.rol} onChange={e=>setUserForm({...userForm,rol:e.target.value})}><option value="empleado">Empleado</option><option value="tecnico">Técnico</option><option value="admin">Admin</option></select>
          <input placeholder="Password (opcional)" type="password" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} />
          <button onClick={addUsuario} disabled={userLoading}>{userLoading? 'Guardando...':'Guardar Usuario'}</button>
          <ul>{usuarios.map(u=> (
            <li key={u.id}>{u.email} - {u.nombre} ({u.rol}) {' '}
              <button onClick={()=>editItem('/users/'+u.id, u.nombre)}>Editar</button>
              <button onClick={()=>removeItem('/users/'+u.id)}>Eliminar</button>
            </li>
          ))}</ul>
        </div>
      </div>
      <div className="card" style={{marginTop:12}}>
        <h3>Escalados / Servidores Externos</h3>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr><th>ID</th><th>Fecha</th><th>Proveedor</th><th>Estado</th><th>Responsable</th><th>Nota</th><th>Observaciones</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {escalados.length===0 && <tr><td colSpan={8}>No hay registros.</td></tr>}
              {escalados.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.ticket_id}</strong></td>
                  <td>{formatDate(e.fecha_escalado)}</td>
                  <td><input id={'esc-prov-'+e.id} defaultValue={e.proveedor || ''} /></td>
                  <td><select id={'esc-est-'+e.id} defaultValue={e.estado || ''}><option>Asignado a Proveedor</option><option>En Proceso</option><option>En Espera</option><option>Resuelto</option></select></td>
                  <td><input id={'esc-resp-'+e.id} defaultValue={e.responsable || ''} /></td>
                  <td><input id={'esc-not-'+e.id} defaultValue={e.nota || ''} /></td>
                  <td><input id={'esc-obs-'+e.id} defaultValue={e.observaciones || ''} /></td>
                  <td>
                    <button onClick={()=>guardarEscalado(e.id)} className="btn-success">Guardar</button>
                    <button onClick={()=>eliminarEscalado(e.id)} className="btn-danger" style={{marginLeft:8}}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3>Reportes</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="card">
            <h4>Tiques por Estado</h4>
            <ReportByStatus tickets={tickets} />
          </div>
          <div className="card">
            <h4>Tiques por Urgencia</h4>
            <ReportByUrgencia tickets={tickets} />
          </div>
          <div className="card">
            <h4>Tiques por Área (Top 10)</h4>
            <ReportByArea tickets={tickets} />
          </div>
          <div className="card">
            <h4>Escalados por Proveedor</h4>
            <ReportEscalados escalados={escalados} />
          </div>
        </div>
      </div>
    </div>
  )
}
