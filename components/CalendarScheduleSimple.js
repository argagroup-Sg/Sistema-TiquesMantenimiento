import React, { useMemo, useState } from 'react'
import { formatTime, formatDate } from '../lib/format'

function startOfMonth(d){ const dt = new Date(d); dt.setDate(1); dt.setHours(0,0,0,0); return dt; }
function endOfMonth(d){ const dt = new Date(d); dt.setMonth(dt.getMonth()+1); dt.setDate(0); dt.setHours(23,59,59,999); return dt; }
function daysBetween(a,b){ const A = new Date(a); const B = new Date(b); A.setHours(0,0,0,0); B.setHours(0,0,0,0); const diff = Math.round((B - A) / (1000*60*60*24)); return diff; }

function statusColor(status){
  if(!status) return '#6b7280';
  const s = status.toString().toLowerCase();
  if(s.includes('resuelto')) return '#10b981';
  if(s.includes('proceso') || s.includes('en proceso')) return '#f59e0b';
  if(s.includes('espera')) return '#9ca3af';
  if(s.includes('escalad')) return '#ef4444';
  return '#2563eb';
}

function initials(name){ if(!name) return ''; const parts = name.split(' '); return (parts[0][0]||'').toUpperCase() + (parts[1]? (parts[1][0]||'').toUpperCase() : ''); }

export default function CalendarScheduleSimple({ tecnicos=[], tickets=[], view='month', currentDate=null, filterTecnico=null, onlyAvailable=false, escalados=[], onEventClick=null }){
  const date = currentDate ? new Date(currentDate) : new Date();
  // mapear técnicos para búsqueda rápida (avatar, nombre)
  const techMap = useMemo(()=>{
    const m = {};
    (tecnicos||[]).forEach(t=>{
      const key = (t.email||t.id||t.nombre)||String(Math.random());
      m[String(key)] = t;
    });
    return m;
  }, [tecnicos]);
  const [tooltip, setTooltip] = useState({ visible:false, x:0, y:0, data:null });
  function showTooltip(ev, item){
    try{
      const rect = ev.currentTarget.getBoundingClientRect();
      // posicionar el tooltip a la derecha si hay espacio, sino a la izquierda
      const approxW = 360;
      const padding = 12;
      let left = rect.right + 8;
      if(typeof window !== 'undefined'){
        const winW = window.innerWidth || 1024;
        if(left + approxW + padding > winW){ left = Math.max(padding, rect.left - approxW - 8); }
      }
      // posicionar verticalmente, evitando que se salga por abajo
      let top = rect.top;
      if(typeof window !== 'undefined'){
        const winH = window.innerHeight || 800;
        const approxH = 160;
        if(top + approxH + padding > winH){ top = Math.max(padding, winH - approxH - padding); }
      }
      setTooltip({ visible:true, x: left, y: top, data: item });
    }catch(e){ setTooltip({ visible:false, x:0, y:0, data:null }); }
  }
  function hideTooltip(){ setTooltip({ visible:false, x:0, y:0, data:null }); }
  const [modal, setModal] = useState({ visible:false, items:[], title:'' });
  function openModal(title, items){ setModal({ visible:true, title, items }); }
  function closeModal(){ setModal({ visible:false, items:[], title:'' }); }
  // Construir filas de recursos (incluir 'Sin asignar')
  const techRows = useMemo(()=>{
    const rows = (tecnicos||[]).map(t=> ({ id: t.email||t.id||t.nombre, title: t.nombre || t.email || 'Técnico', avatar: t.avatar || t.foto || t.image || t.profile_image || null }));
    // include unassigned row
    rows.push({ id: '__sin_asignar', title: 'Sin asignar', avatar: null });
    return rows;
  }, [tecnicos]);

  if(view === 'month' || view === 'year' || view === 'week'){
    // cuadrícula del mes
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    // calcular los días a mostrar (inicio de semana Lunes)
    const startWeekDay = (monthStart.getDay() + 6) % 7; // 0=Mon
    const gridStart = new Date(monthStart); gridStart.setDate(monthStart.getDate() - startWeekDay);
    const totalDays = (view === 'week') ? 7 : 42; // week shows 7 days, month shows 6 weeks
    const days = Array.from({length: totalDays}).map((_,i)=>{ const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); return d; });

    // preparar eventos filtrados
    const evs = (tickets||[]).map(tt=>{
      const s = tt.fecha_creacion || tt.fecha || tt.fecha_programada || null;
      const start = s ? new Date(s) : null;
      // prioridad: fecha_resuelto en tabla escalados si existe, luego ticket
      const escaladoRecord = (escalados||[]).find(e=> String(e.ticket_id) === String(tt.id));
      const endDateRaw = (escaladoRecord && (escaladoRecord.fecha_resuelto || escaladoRecord.fechaResuelto)) ? (escaladoRecord.fecha_resuelto || escaladoRecord.fechaResuelto) : (tt.fecha_resuelto || tt.fechaResuelto || null);
      const end = endDateRaw ? new Date(endDateRaw) : new Date(); // unresolved expand until today
      const techKey = (tt.tecnico || tt.tecnico_email || tt.tecnicoId || tt.tecnico_id || '') || '__sin_asignar';
      const tech = techMap[String(techKey)] || null;
      const isEscalado = !!escaladoRecord || String(tt.estado||'').toLowerCase().includes('escalad');
      return { raw: tt, start, end, status: tt.estado, techKey, tech, isEscalado, escaladoRecord };
    }).filter(ev=> ev.start);

    // para cada recurso, construir la lista de eventos que se solapan
    const rowsWithEvents = techRows.map(r=>{
      const items = evs.filter(ev=>{
        const techId = (ev.raw.tecnico||'') || (ev.raw.tecnico_email||'') || '__sin_asignar';
        const rowId = r.id || '__sin_asignar';
        const matchesTech = rowId === '__sin_asignar' ? (!ev.raw.tecnico) : (String(techId) === String(rowId));
        if(!matchesTech) return false;
        // date overlap
        return !(ev.end < days[0] || ev.start > days[days.length-1]);
      }).map(ev=>({ ...ev, raw: ev.raw }));
      return { row: r, items };
    });

    // diseño: cada fila renderiza bloques posicionados por índice de día y que abarcan varios días
    const cellWidth = (view === 'week') ? 120 : 36;
    return (
      <div style={{overflowX:'auto', position:'relative'}}>
        {/* leyenda eliminada (integrada en otro lugar) */}
        <div style={{height:8}} />
        <div style={{overflow:'auto'}}>
          {/* leyenda integrada alineada con la cuadrícula (encima del encabezado) */}
          <div style={{display:'flex', alignItems:'center', padding:'8px 12px', gap:12}}>
            <div style={{width:300}} />
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{width:12,height:12,background:statusColor('resuelto'),borderRadius:4}}></div><div style={{fontSize:12}}>Resuelto</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{width:12,height:12,background:statusColor('en proceso'),borderRadius:4}}></div><div style={{fontSize:12}}>En Proceso</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{width:12,height:12,background:statusColor('espera'),borderRadius:4}}></div><div style={{fontSize:12}}>En Espera</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{width:12,height:12,background:statusColor('escalad'),borderRadius:4}}></div><div style={{fontSize:12}}>Escalado</div>
              </div>
            </div>
          </div>
          {/* fila de encabezado: celda de título izquierda + cuadrícula de días */}
          {(() => {
            const headerLabel = (view === 'day') ? 'Técnicos / Día' : (view === 'week') ? 'Técnicos / Semana' : (view === 'month') ? 'Técnicos / Mes' : 'Técnicos / Año';
            return (
              <div style={{display:'flex', alignItems:'stretch'}}>
                <div style={{width:300, height:32, boxSizing:'border-box', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', paddingLeft:12, fontWeight:700}}>{headerLabel}</div>
                <div style={{flex: '0 0 auto'}}>
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${days.length}, ${cellWidth}px)`, gap:0}}>
                    {days.map((d,i)=> (
                      <div key={i} style={{height:32,width:cellWidth,boxSizing:'border-box',border:'1px solid #f3f4f6',background: d.getMonth() === monthStart.getMonth() ? '#fff' : '#fafafa', fontSize:11, padding:4}}>
                        <div style={{fontSize:11,color:'#374151'}}>{d.getDate()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
          <div>
            {rowsWithEvents.map((rw,rowIndex)=> (
              <div key={rw.row.id} style={{display:'flex', borderBottom:'1px solid #f3f4f6', minHeight:88, alignItems:'stretch'}}>
                <div style={{width:300, display:'flex',alignItems:'center',paddingLeft:12,gap:10,boxSizing:'border-box'}}>
                  {rw.row.avatar ? (
                    <img src={rw.row.avatar} alt={rw.row.title} style={{width:44,height:44,borderRadius:22,objectFit:'cover',marginRight:10,boxShadow:'0 1px 2px rgba(0,0,0,0.06)'}} />
                  ) : (
                    <div style={{width:44,height:44,borderRadius:22,background:'#eef2ff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#1e3a8a',marginRight:10}}>{initials(rw.row.title)}</div>
                  )}
                  <div title={rw.row.title} tabIndex={0} aria-label={`Técnico ${rw.row.title}`} style={{fontSize:13, lineHeight:'1.2', whiteSpace:'normal', overflowWrap:'break-word', cursor:'help'}}>{rw.row.title}</div>
                </div>
                <div style={{position:'relative', width: `${days.length * cellWidth}px`, flex:'0 0 auto'}}>
                  {/* cuadrícula de fondo para esta fila */}
                  <div style={{position:'absolute', left:0, right:0, top:0, bottom:0, display:'grid', gridTemplateColumns:`repeat(${days.length}, ${cellWidth}px)`}}>
                    {days.map((d,i)=> <div key={i} style={{borderRight:'1px solid #f8fafc'}} />)}
                  </div>
                  {/* eventos */}
                  <div style={{position:'relative', paddingLeft:0, minHeight:88}}>
                    {(() => {
                      const maxVisible = 4;
                      const visibleItems = rw.items.slice(0, maxVisible);
                      const hiddenItems = rw.items.slice(maxVisible);
                      return (
                        <>
                          {visibleItems.map((it,idx)=>{
                            const startIdx = Math.max(0, daysBetween(days[0], it.start));
                            const endIdx = Math.min(days.length-1, daysBetween(days[0], it.end));
                            const left = startIdx * cellWidth;
                            const span = Math.max(1, endIdx - startIdx + 1);
                            const width = span * cellWidth - 6;
                            const color = it.isEscalado ? statusColor('escalad') : statusColor(it.status || it.raw.estado);
                            const top = 10 + (idx*24);
                            return (
                              <div key={idx} onMouseEnter={(e)=>showTooltip(e, {...it.raw, escalado: it.escaladoRecord, isEscalado: it.isEscalado})} onMouseLeave={hideTooltip} onClick={() => { if(onEventClick) onEventClick(it.raw); }} title={(it.raw && (it.raw.solicitante || ''))} role="article" aria-label={`Tique ${it.raw.id} ${it.raw.estado||''}`} style={{position:'absolute', left, top, width, borderRadius:8, background:color, color:'#fff', padding:'8px 10px', fontSize:12, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', boxShadow:'0 3px 6px rgba(0,0,0,0.08)', border:'1px solid rgba(0,0,0,0.06)', cursor: onEventClick ? 'pointer' : 'default', display:'flex',alignItems:'center',gap:8}}>
                                {/* avatar pequeño */}
                                { it.tech && (it.tech.avatar || it.tech.foto || it.tech.image) ? (
                                  <img src={it.tech.avatar||it.tech.foto||it.tech.image} alt={it.tech.nombre||''} style={{width:18,height:18,borderRadius:9,objectFit:'cover',flex:'0 0 auto'}} />
                                ) : (
                                  <div style={{width:18,height:18,borderRadius:9,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flex:'0 0 auto'}}>{initials(it.raw.tecnico || it.raw.tecnico_nombre || it.tech?.nombre || '')}</div>
                                )}
                                <div style={{overflow:'hidden',textOverflow:'ellipsis'}}>
                                  <div style={{fontWeight:700, fontSize:12}}>#{it.raw.id} {it.raw.solicitante? (' - '+ (it.raw.solicitante)): ''}</div>
                                </div>
                              </div>
                            )
                          })}
                          {hiddenItems.length>0 && (()=>{
                            const it = hiddenItems[0];
                            const startIdx = Math.max(0, daysBetween(days[0], it.start));
                            const left = startIdx * cellWidth;
                            return (
                              <div key="more" tabIndex={0} role="button" onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') openModal(`+${hiddenItems.length} más`, hiddenItems.map(h=>h.raw)) }} style={{position:'absolute', left, top:10 + ((maxVisible-1)*24), width: (cellWidth*1)-6, borderRadius:8, background:'#081023', color:'#fff', padding:'6px 8px', fontSize:12, display:'flex',alignItems:'center',justifyContent:'center', cursor:'pointer', boxShadow:'0 4px 12px rgba(2,6,23,0.35)', border:'1px solid rgba(255,255,255,0.06)'}} onClick={()=> openModal(`+${hiddenItems.length} más`, hiddenItems.map(h=>h.raw))} aria-label={`Abrir ${hiddenItems.length} eventos ocultos`}>
                                +{hiddenItems.length} más
                              </div>
                            )
                          })()}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {tooltip.visible && tooltip.data && (
          <div style={{position:'fixed', left: tooltip.x, top: tooltip.y, zIndex:9999, background:'#0f172a', color:'#fff', padding:12, borderRadius:10, boxShadow:'0 8px 28px rgba(2,6,23,0.45)', minWidth:320, maxWidth:420}}>
            <div style={{fontWeight:800, marginBottom:6}}>Tique #{tooltip.data.id}{ tooltip.data.isEscalado ? ' • ESCALADO' : ''}</div>
            <div style={{fontSize:12, opacity:0.95}}>{tooltip.data.solicitante || tooltip.data.usuario || ''}</div>
            <div style={{fontSize:12, opacity:0.9, marginTop:6}}>{tooltip.data.estado || ''}</div>
            <div style={{fontSize:11, opacity:0.85, marginTop:8}}>{tooltip.data.tecnico ? ('Técnico: ' + tooltip.data.tecnico) : ''}</div>
            <div style={{fontSize:11, opacity:0.75, marginTop:6}}>
              {tooltip.data.fecha_creacion? ('Inicio: ' + formatDate(tooltip.data.fecha_creacion)) : ''}
              {' '}
              {tooltip.data.escalado && (tooltip.data.escalado.fecha_escalado || tooltip.data.escalado.fechaEscalado) ? (' — Escalado: ' + formatDate(tooltip.data.escalado.fecha_escalado || tooltip.data.escalado.fechaEscalado)) : ''}
              {' '}
              { (tooltip.data.escalado && (tooltip.data.escalado.fecha_resuelto || tooltip.data.escalado.fechaResuelto)) ? (' — Resuelto (escalado): ' + formatDate(tooltip.data.escalado.fecha_resuelto || tooltip.data.escalado.fechaResuelto)) : (tooltip.data.fecha_resuelto? (' — Resuelto: ' + formatDate(tooltip.data.fecha_resuelto)) : '') }
            </div>
          </div>
        )}
      </div>
    )
  }

  // fallback: week/day hourly view (existing behavior)
  const hours = Array.from({length: 15}).map((_,i)=> i+6);
  const resources = (tecnicos||[]).map(t=>({ id: (t.email||t.id||t.nombre)||String(Math.random()), title: t.nombre || t.email || t.id }))
  const events = (tickets||[]).filter(tt=> tt.fecha_creacion || tt.fecha).map(tt=>{
    const start = new Date(tt.fecha_creacion || tt.fecha);
    const end = tt.fecha_resuelto ? new Date(tt.fecha_resuelto) : new Date();
    return { id: tt.id, title: `#${tt.id} ${tt.solicitante||''}`, start, end, resourceId: tt.tecnico||'' }
  })

  return (
    <div style={{display:'flex',gap:12}}>
      <div style={{width:140}}>
        <div style={{height:32}}></div>
        {hours.map(h=> <div key={h} style={{height:48,lineHeight:'48px',borderTop:'1px solid #eee',fontSize:12}}>{h}:00</div>)}
      </div>
      <div style={{flex:1,overflowX:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:`repeat(${resources.length}, minmax(220px,1fr))`, gap:8}}>
          {resources.map(r=> (
            <div key={r.id} style={{border:'1px solid #e6eef8',minHeight: (hours.length*48)+32, position:'relative', background:'#fff', padding:8}}>
              <div style={{fontWeight:700, borderBottom:'1px solid #f1f5f9', paddingBottom:6, marginBottom:6}}>{r.title}</div>
              {events.filter(ev=> (ev.resourceId||'').toString().toLowerCase() === (r.id||'').toString().toLowerCase()).map(ev=>{
                const dayStart = new Date(ev.start);
                const top = ((dayStart.getHours() - 6) * 48) + (dayStart.getMinutes()/60)*48;
                const dur = (new Date(ev.end) - new Date(ev.start)) / (1000*60*60); // hours
                const height = Math.max(32, dur * 48);
                return (<div key={ev.id} onMouseEnter={(e)=>showTooltip(e, ev)} onMouseLeave={hideTooltip} style={{position:'absolute', left:8, right:8, top, height, background:'#2563eb', color:'#fff', borderRadius:6, padding:6, fontSize:12, overflow:'hidden', cursor:'default'}}>
                  <div style={{fontWeight:700}}>{ev.title}</div>
                  <div style={{fontSize:11, opacity:0.9}}>{formatTime(ev.start)} - {formatTime(ev.end)}</div>
                </div>)
              })}
            </div>
          ))}
        </div>
      </div>
      {modal.visible && (
        <div style={{position:'fixed', left:20, top:80, right:20, bottom:40, zIndex:9999, background:'#fff', borderRadius:8, boxShadow:'0 8px 30px rgba(2,6,23,0.2)', padding:16, overflow:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontWeight:800}}>{modal.title}</div>
            <button aria-label="Cerrar modal" onClick={closeModal} style={{padding:'6px 10px',borderRadius:6}}>Cerrar</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
              <thead><tr><th>ID</th><th>Solicitante</th><th>Estado</th><th>Fecha Inicio</th><th>Fecha Escalado</th><th>Fecha Fin</th><th>Acciones</th></tr></thead>
              <tbody>
                {(modal.items||[]).map(it=> {
                  const rec = (escalados||[]).find(e=> String(e.ticket_id) === String(it.id));
                  const fechaEsc = rec ? (rec.fecha_escalado || rec.fechaEscalado) : null;
                  const fechaFin = rec ? (rec.fecha_resuelto || rec.fechaResuelto) : (it.fecha_resuelto || it.fechaResuelto || null);
                  return (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.solicitante||it.usuario||''}</td>
                      <td>{ (rec && (rec.estado || rec.estado_escalado)) ? (rec.estado || rec.estado_escalado) : (it.estado||'') }</td>
                      <td>{formatDate(it.fecha_creacion||it.fecha)}</td>
                      <td>{fechaEsc ? formatDate(fechaEsc) : ''}</td>
                      <td>{fechaFin ? formatDate(fechaFin) : ''}</td>
                      <td><button aria-label={`Abrir tique ${it.id}`} onClick={() => { try{ window.open('/tickets/'+it.id, '_blank') }catch(e){} }}>Abrir</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
