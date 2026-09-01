import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate, statusClass } from '../lib/format'
import { useToast } from '../components/ToastProvider'

export default function Tecnico(){
  const { data: session } = useSession();
  const [tiques, setTiques] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [tecnicos, setTecnicos] = useState([]);
  const [actionData, setActionData] = useState({}); // { [ticketId]: { estado, nota, tecnico } }
  const showToast = useToast()

  useEffect(()=>{ if(session) load(); }, [session]);

  async function load(){
    try{ const r = await api('/tickets'); setTiques(r.tiques || []); }catch(err){ console.error(err); }
  }

  async function loadTecnicos(){
    try{ const r = await api('/tecnicos'); setTecnicos(r.tecnicos||[]); }catch(e){ console.error(e); }
  }
  useEffect(()=>{ if(session) loadTecnicos(); }, [session]);

  const showToast = require('../components/ToastProvider').useToast ? require('../components/ToastProvider').useToast() : () => {}

  async function guardar(id){
    const ad = actionData[id] || {};
    const estado = ad.estado;
    const nota = ad.nota || '';
    if(!estado) return showToast('Selecciona un estado', 'error');
    try{
      setActionLoading(true);
      await api('/tickets/'+id, { method:'PUT', body: JSON.stringify({ estado, nota, tecnico: ad.tecnico }) });
      // refrescar lista
      await load();
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
    const proveedor = window.prompt ? window.prompt('Proveedor o motivo de escalado:') : '';
    if(!proveedor) return;
    try{ setActionLoading(true); await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota: 'Escalado por técnico' }) }); showToast('Escalado creado', 'success'); await load(); }
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
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>ID</th><th>Fecha</th><th>Solicitante</th><th>Área</th><th>Máquina</th><th>Fallo</th><th>Urgencia</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {tiques.length===0 && <tr><td colSpan={9}>No hay tiques.</td></tr>}
              {tiques.map(t=> (
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
                      <select value={(actionData[t.id] && actionData[t.id].estado) || t.estado || 'Abierto'} onChange={e=>setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), estado: e.target.value } }))}>
                        <option>Abierto</option>
                        <option>En Proceso</option>
                        <option>En Espera</option>
                        <option>Resuelto</option>
                        <option>Escalado a Servidor Externo</option>
                      </select>
                      <textarea placeholder="Nota/acción" value={(actionData[t.id] && actionData[t.id].nota) || ''} onChange={e=>setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), nota: e.target.value } }))} rows={2} />
                      <div style={{display:'flex',gap:8}}>
                        <select value={(actionData[t.id] && actionData[t.id].tecnico) || (t.tecnico || '')} onChange={e=>setActionData(a=>({ ...a, [t.id]: { ...(a[t.id]||{}), tecnico: e.target.value } }))}>
                          <option value="">-- Técnico --</option>
                          {tecnicos.filter(tc=> (tc.rol||'').toLowerCase()!=='empleado').map(tc=> (
                            <option key={tc.email||tc.id} value={tc.email||tc.id}>{(tc.nombre || tc.email) + ' (' + (tc.rol||'') + ')'}</option>
                          ))}
                        </select>
                        <button onClick={()=>guardar(t.id)} disabled={actionLoading}>{actionLoading? 'Procesando...':'Actualizar'}</button>
                        <button onClick={()=>asignar(t.id, (actionData[t.id] && actionData[t.id].tecnico) || t.tecnico)} disabled={actionLoading}>{actionLoading? '...':'Asignar'}</button>
                        <button onClick={()=>escalar(t.id)} disabled={actionLoading} style={{marginLeft:8}}>{actionLoading? '...':'Escalar'}</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
