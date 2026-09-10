import React, { useMemo, useState } from 'react'
import { formatTime, formatDate } from '../lib/format'

function parseLocalDate(value){
  if(!value) return new Date();
  if(value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if(typeof value === 'string'){
    const trimmed = value.trim();
    const match = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
    if(match){
      const [y,m,d] = trimmed.split('-').map(Number);
      return new Date(y, m-1, d);
    }
    const dt = new Date(trimmed);
    if(!Number.isNaN(dt.getTime())){
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = fmt.formatToParts(dt).reduce((acc, p) => { if(p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
      if(parts.year && parts.month && parts.day) return new Date(Number(parts.year), Number(parts.month)-1, Number(parts.day));
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
  }
  const dt = new Date(value);
  if(Number.isNaN(dt.getTime())) return new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(dt).reduce((acc, p) => { if(p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  if(parts.year && parts.month && parts.day) return new Date(Number(parts.year), Number(parts.month)-1, Number(parts.day));
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function startOfMonth(d){ const dt = parseLocalDate(d); dt.setDate(1); dt.setHours(0,0,0,0); return dt; }
function endOfMonth(d){ const dt = parseLocalDate(d); dt.setMonth(dt.getMonth()+1); dt.setDate(0); dt.setHours(23,59,59,999); return dt; }
function startOfDay(d){ const dt = parseLocalDate(d); dt.setHours(0,0,0,0); return dt; }
function addDays(d, count){ const dt = parseLocalDate(d); dt.setDate(dt.getDate() + count); return dt; }
function startOfWeek(d, weekStartsOn = 1){
  const dt = parseLocalDate(d);
  const day = dt.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0,0,0,0);
  return dt;
}
function daysBetween(a,b){ const A = startOfDay(a); const B = startOfDay(b); const diff = Math.floor((B - A) / (1000*60*60*24)); return diff; }

function normalizeDateForComparison(value){
  if(!value) return null;
  const dt = new Date(value);
  if(Number.isNaN(dt.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(dt).reduce((acc, p) => { if(p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  if(parts.year && parts.month && parts.day){
    return new Date(Number(parts.year), Number(parts.month)-1, Number(parts.day), 0, 0, 0, 0);
  }
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
}

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
  const date = parseLocalDate(currentDate || new Date());
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
    rows.push({ id: '__sin_asignar', title: 'Sin asignar', avatar: null });
    return rows;
  }, [tecnicos]);

  const visibleTechRows = useMemo(()=>{
    let rows = techRows;
    if(filterTecnico){ rows = rows.filter(r => String(r.id) === String(filterTecnico)); }
    if(onlyAvailable){
      const busyIds = new Set((tickets||[]).filter(t => t.tecnico || t.tecnico_email || t.tecnico_id || t.tecnicoId || t.tecnico_nombre || t.tecnicoNombre).map(t => String(t.tecnico || t.tecnico_email || t.tecnico_id || t.tecnicoId || t.tecnico_nombre || t.tecnicoNombre)));
      rows = rows.filter(r => !busyIds.has(String(r.id)) || String(r.id) === '__sin_asignar');
    }
    return rows;
  }, [techRows, filterTecnico, onlyAvailable, tickets]);

  if(view === 'year'){
    const months = Array.from({length:12}, (_,i)=> new Date(date.getFullYear(), i, 1));
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const yearEvents = (tickets||[]).map(tt=>{
      const s = tt.fecha_creacion || tt.fecha || tt.fecha_programada || null;
      const start = s ? new Date(s) : null;
      if(!start) return null;
      const techKey = (tt.tecnico || tt.tecnico_email || tt.tecnicoId || tt.tecnico_id || '') || '__sin_asignar';
      const tech = techMap[String(techKey)] || null;
      return { ...tt, start, tech, techKey };
    }).filter(Boolean);

    return (
      <div style={{overflowX:'auto', position:'relative'}}>
        <div style={{display:'flex', alignItems:'center', padding:'8px 12px', gap:12}}>
          <div style={{width:300}} />
          <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('resuelto'),borderRadius:4}}></div><div style={{fontSize:12}}>Resuelto</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('en proceso'),borderRadius:4}}></div><div style={{fontSize:12}}>En Proceso</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('espera'),borderRadius:4}}></div><div style={{fontSize:12}}>En Espera</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('escalad'),borderRadius:4}}></div><div style={{fontSize:12}}>Escalado</div></div>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'300px auto', alignItems:'stretch', width:'fit-content'}}>
          <div style={{width:300, height:32, boxSizing:'border-box', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', paddingLeft:12, fontWeight:700, flex:'0 0 300px'}}>{'Técnicos / Año'}</div>
          <div style={{display:'grid', gridTemplateColumns:`repeat(${months.length}, minmax(72px, 1fr))`, width: `${months.length * 72}px`}}>
            {months.map((m,i)=> (
              <div key={i} style={{height:32, boxSizing:'border-box', borderRight:'1px solid #f3f4f6', borderTop:'1px solid #f3f4f6', borderBottom:'1px solid #f3f4f6', background:'#fff', fontSize:11, padding:'4px 6px', textAlign:'center'}}>
                {monthNames[i]}
              </div>
            ))}
          </div>
        </div>
        <div>
          {visibleTechRows.map((rw)=> (
            <div key={rw.row ? rw.row.id : rw.id} style={{display:'grid', gridTemplateColumns:'300px auto', borderBottom:'1px solid #f3f4f6', minHeight: 44, alignItems:'stretch', width:'fit-content'}}>
              <div style={{width:300, display:'flex',alignItems:'center',paddingLeft:12,gap:10,boxSizing:'border-box', flex:'0 0 300px'}}>
                {rw.avatar ? (
                  <img src={rw.avatar} alt={rw.title} style={{width:44,height:44,borderRadius:22,objectFit:'cover',marginRight:10,boxShadow:'0 1px 2px rgba(0,0,0,0.06)'}} />
                ) : (
                  <div style={{width:44,height:44,borderRadius:22,background:'#eef2ff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#1e3a8a',marginRight:10}}>{initials(rw.title)}</div>
                )}
                <div title={rw.title} style={{fontSize:13, lineHeight:'1.2', whiteSpace:'normal', overflowWrap:'break-word', cursor:'help'}}>{rw.title}</div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:`repeat(${months.length}, minmax(72px, 1fr))`, width: `${months.length * 72}px`, minHeight: 42}}>
                {months.map((m, idx)=> {
                  const monthItems = yearEvents.filter(ev => {
                    const rowId = rw.id || '__sin_asignar';
                    const techId = (ev.tecnico || ev.tecnico_email || ev.tecnico_id || ev.tecnicoId || '') || '__sin_asignar';
                    const matchesTech = rowId === '__sin_asignar' ? (!ev.tecnico && !ev.tecnico_email && !ev.tecnico_id && !ev.tecnicoId) : String(techId) === String(rowId);
                    return matchesTech && ev.start && ev.start.getFullYear() === date.getFullYear() && ev.start.getMonth() === idx;
                  });
                  return (
                    <div key={idx} style={{borderRight:'1px solid #f8fafc', boxSizing:'border-box', minHeight:42, padding:'6px 4px', background:'#fafafa', display:'flex', alignItems:'center', justifyContent:'center', gap:4, flexWrap:'wrap'}}>
                      {monthItems.slice(0, 3).map((ev, evIndex) => (
                        <div key={`${ev.id}-${evIndex}`} title={ev.id} style={{width:16, height:16, borderRadius:4, background: ev.estado && ev.estado.toString().toLowerCase().includes('escalad') ? statusColor('escalad') : statusColor(ev.estado), boxShadow:'0 1px 2px rgba(0,0,0,0.08)'}} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if(view === 'month' || view === 'week' || view === 'day'){
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const gridStart = (view === 'week')
      ? startOfWeek(date, 1)
      : (view === 'day')
        ? startOfDay(date)
        : startOfWeek(monthStart, 1);
    const totalDays = (view === 'week') ? 7 : (view === 'day') ? 1 : 42;
    const days = Array.from({length: totalDays}).map((_,i)=> addDays(gridStart, i));
    const cellWidth = (view === 'week') ? 120 : (view === 'day') ? 220 : 36;

    const evs = (tickets||[]).map(tt=>{
      const s = tt.fecha_creacion || tt.fecha || tt.fecha_programada || null;
      const start = s ? new Date(s) : null;
      const escaladoRecord = (escalados||[]).find(e=> String(e.ticket_id) === String(tt.id));
      const endDateRaw = (escaladoRecord && (escaladoRecord.fecha_resuelto || escaladoRecord.fechaResuelto)) ? (escaladoRecord.fecha_resuelto || escaladoRecord.fechaResuelto) : (tt.fecha_resuelto || tt.fechaResuelto || null);
      const end = endDateRaw ? new Date(endDateRaw) : new Date();
      const techKey = (tt.tecnico || tt.tecnico_email || tt.tecnicoId || tt.tecnico_id || '') || '__sin_asignar';
      const tech = techMap[String(techKey)] || null;
      const isEscalado = !!escaladoRecord || String(tt.estado||'').toLowerCase().includes('escalad');
      const normalizedStart = start ? normalizeDateForComparison(start) : null;
      const normalizedEnd = end ? normalizeDateForComparison(end) : null;
      return { raw: tt, start, end, status: tt.estado, techKey, tech, isEscalado, escaladoRecord, normalizedStart, normalizedEnd };
    }).filter(ev=> ev.start);

    const rowsWithEvents = visibleTechRows.map(r=>{
      const items = evs.filter(ev=>{
        const techId = (ev.raw.tecnico||'') || (ev.raw.tecnico_email||'') || '__sin_asignar';
        const rowId = r.id || '__sin_asignar';
        const matchesTech = rowId === '__sin_asignar' ? (!ev.raw.tecnico && !ev.raw.tecnico_email && !ev.raw.tecnico_id && !ev.raw.tecnicoId) : (String(techId) === String(rowId));
        if(!matchesTech) return false;
        const normalizedStart = ev.normalizedStart || normalizeDateForComparison(ev.start);
        const normalizedEnd = ev.normalizedEnd || normalizeDateForComparison(ev.end);
        return !(normalizedEnd < days[0] || normalizedStart > days[days.length-1]);
      }).map(ev=>({ ...ev, raw: ev.raw })).sort((a,b)=> (new Date(a.start) - new Date(b.start)) || (new Date(a.end) - new Date(b.end)));

      const lanes = [];
      const positionedItems = items.map(item => {
        const startIdx = Math.max(0, daysBetween(days[0], item.start));
        const endIdx = Math.min(days.length - 1, daysBetween(days[0], item.end));
        const laneIndex = lanes.findIndex((laneEnd) => laneEnd < startIdx);
        const assignedLane = laneIndex === -1 ? lanes.length : laneIndex;
        lanes[assignedLane] = endIdx;
        return { ...item, startIdx, endIdx, lane: assignedLane };
      });

      const laneCount = Math.max(1, ...positionedItems.map(item => item.lane + 1), 1);
      return { row: r, items: positionedItems, rowHeight: Math.max(88, laneCount * 26 + 16) };
    });

    if(view === 'day'){
      const dayOnlyLabel = 'Técnicos / Día';
      return (
        <div style={{overflowX:'auto', position:'relative'}}>
          <div style={{display:'flex', alignItems:'center', padding:'8px 12px', gap:12}}>
            <div style={{width:300}} />
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('resuelto'),borderRadius:4}}></div><div style={{fontSize:12}}>Resuelto</div></div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('en proceso'),borderRadius:4}}></div><div style={{fontSize:12}}>En Proceso</div></div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('espera'),borderRadius:4}}></div><div style={{fontSize:12}}>En Espera</div></div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={{width:12,height:12,background:statusColor('escalad'),borderRadius:4}}></div><div style={{fontSize:12}}>Escalado</div></div>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'300px auto', alignItems:'stretch', width:'fit-content'}}>
            <div style={{width:300, height:32, boxSizing:'border-box', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', paddingLeft:12, fontWeight:700, flex:'0 0 300px'}}>{dayOnlyLabel}</div>
            <div style={{display:'grid', gridTemplateColumns:`repeat(${days.length}, ${cellWidth}px)`, gap:0, width: days.length * cellWidth}}>
              {days.map((d,i)=> (
                <div key={i} style={{height:32,width:cellWidth,boxSizing:'border-box',borderRight:'1px solid #f3f4f6',borderTop:'1px solid #f3f4f6',borderBottom:'1px solid #f3f4f6',background:'#fff', fontSize:11, padding:4}}>
                  <div style={{fontSize:11,color:'#374151'}}>{d.getDate()}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            {visibleTechRows.map((rw)=> (
              <div key={rw.id} style={{display:'grid', gridTemplateColumns:'300px auto', borderBottom:'1px solid #f3f4f6', minHeight: 60, alignItems:'stretch', width:'fit-content'}}>
                <div style={{width:300, display:'flex',alignItems:'center',paddingLeft:12,gap:10,boxSizing:'border-box', flex:'0 0 300px'}}>
                  {rw.avatar ? (<img src={rw.avatar} alt={rw.title} style={{width:44,height:44,borderRadius:22,objectFit:'cover',marginRight:10,boxShadow:'0 1px 2px rgba(0,0,0,0.06)'}} />) : (<div style={{width:44,height:44,borderRadius:22,background:'#eef2ff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#1e3a8a',marginRight:10}}>{initials(rw.title)}</div>)}
                  <div title={rw.title} style={{fontSize:13, lineHeight:'1.2', whiteSpace:'normal', overflowWrap:'break-word'}}>{rw.title}</div>
                </div>
                <div style={{position:'relative', width: `${days.length * cellWidth}px`, flex:'0 0 auto'}}>
                  <div style={{display:'grid', gridTemplateColumns:`repeat(${days.length}, ${cellWidth}px)`, position:'relative', minHeight:60, width: days.length * cellWidth}}>
                    {days.map((d,i)=> <div key={i} style={{borderRight:'1px solid #f8fafc', minHeight:60, boxSizing:'border-box'}} />)}
                    {rowsWithEvents.filter(rw2 => String(rw2.row.id) === String(rw.id)).flatMap(rw2 => rw2.items).map((it)=> {
                      const startColumn = 1;
                      const span = 1;
                      const color = it.isEscalado ? statusColor('escalad') : statusColor(it.status || it.raw.estado);
                      return (
                        <div key={`${it.raw.id}-${it.lane}`} onMouseEnter={(e)=>showTooltip(e, {...it.raw, escalado: it.escaladoRecord, isEscalado: it.isEscalado})} onMouseLeave={hideTooltip} onClick={() => { if(onEventClick) onEventClick(it.raw); }} role="article" aria-label={`Tique ${it.raw.id} ${it.raw.estado||''}`} style={{gridColumn:`${startColumn} / span ${span}`, gridRow: it.lane + 1, margin:'2px 2px 0 2px', borderRadius:8, background:color, color:'#fff', padding:'8px 10px', fontSize:12, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', boxShadow:'0 3px 6px rgba(0,0,0,0.08)', border:'1px solid rgba(0,0,0,0.06)', cursor:onEventClick ? 'pointer' : 'default', display:'flex', alignItems:'center', gap:8, zIndex:2, minHeight:24, maxHeight:26, alignSelf:'stretch'}}>
                          <div style={{width:18,height:18,borderRadius:9,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flex:'0 0 auto'}}>{initials(it.raw.tecnico || it.raw.tecnico_nombre || it.tech?.nombre || '')}</div>
                          <div style={{overflow:'hidden',textOverflow:'ellipsis'}}><div style={{fontWeight:700, fontSize:12}}>#{it.raw.id}</div></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
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
            const headerLabel = (view === 'day') ? 'Técnicos / Día' : (view === 'week') ? 'Técnicos / Semana' : 'Técnicos / Mes';
            const showMonthBg = (view === 'month' || view === 'week' || view === 'day');
            return (
              <div style={{display:'grid', gridTemplateColumns:'300px auto', alignItems:'stretch', width:'fit-content'}}>
                <div style={{width:300, height:32, boxSizing:'border-box', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', paddingLeft:12, fontWeight:700, flex:'0 0 300px'}}>{headerLabel}</div>
                <div style={{flex:'0 0 auto', overflowX:'auto', overflowY:'hidden', minWidth: days.length * cellWidth}}>
                  <div style={{display:'grid', gridTemplateColumns:`repeat(${days.length}, ${cellWidth}px)`, gap:0, width: days.length * cellWidth, minWidth: days.length * cellWidth}}>
                    {days.map((d,i)=> (
                      <div key={i} style={{height:32,width:cellWidth,boxSizing:'border-box',borderRight:'1px solid #f3f4f6',borderTop:'1px solid #f3f4f6',borderBottom:'1px solid #f3f4f6',background: showMonthBg && d.getMonth() === monthStart.getMonth() ? '#fff' : '#fafafa', fontSize:11, padding:4}}>
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
              <div key={rw.row.id} style={{display:'grid', gridTemplateColumns:'300px auto', borderBottom:'1px solid #f3f4f6', minHeight: rw.rowHeight, alignItems:'stretch', width:'fit-content'}}>
                <div style={{width:300, display:'flex',alignItems:'center',paddingLeft:12,gap:10,boxSizing:'border-box', flex:'0 0 300px'}}>
                  {rw.row.avatar ? (
                    <img src={rw.row.avatar} alt={rw.row.title} style={{width:44,height:44,borderRadius:22,objectFit:'cover',marginRight:10,boxShadow:'0 1px 2px rgba(0,0,0,0.06)'}} />
                  ) : (
                    <div style={{width:44,height:44,borderRadius:22,background:'#eef2ff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#1e3a8a',marginRight:10}}>{initials(rw.row.title)}</div>
                  )}
                  <div title={rw.row.title} tabIndex={0} aria-label={`Técnico ${rw.row.title}`} style={{fontSize:13, lineHeight:'1.2', whiteSpace:'normal', overflowWrap:'break-word', cursor:'help'}}>{rw.row.title}</div>
                </div>
                <div style={{position:'relative', width: `${days.length * cellWidth}px`, minWidth: `${days.length * cellWidth}px`, flex:'0 0 auto'}}>
                  <div style={{display:'grid', gridTemplateColumns:`repeat(${days.length}, ${cellWidth}px)`, position:'relative', minHeight: rw.rowHeight, width: days.length * cellWidth, minWidth: days.length * cellWidth}}>
                    {days.map((d,i)=> <div key={i} style={{borderRight:'1px solid #f8fafc', minHeight: rw.rowHeight, boxSizing:'border-box'}} />)}
                    {rw.items.map((it)=> {
                      const startColumn = Math.max(0, it.startIdx) + 1;
                      const span = Math.max(1, it.endIdx - it.startIdx + 1);
                      const color = it.isEscalado ? statusColor('escalad') : statusColor(it.status || it.raw.estado);
                      return (
                        <div
                          key={`${it.raw.id}-${it.lane}`}
                          onMouseEnter={(e)=>showTooltip(e, {...it.raw, escalado: it.escaladoRecord, isEscalado: it.isEscalado})}
                          onMouseLeave={hideTooltip}
                          onClick={() => { if(onEventClick) onEventClick(it.raw); }}
                          title={(it.raw && (it.raw.solicitante || ''))}
                          role="article"
                          aria-label={`Tique ${it.raw.id} ${it.raw.estado||''}`}
                          style={{
                            gridColumn: `${startColumn} / span ${span}`,
                            gridRow: it.lane + 1,
                            margin: '2px 2px 0 2px',
                            borderRadius:8,
                            background: color,
                            color:'#fff',
                            padding:'8px 10px',
                            fontSize:12,
                            overflow:'hidden',
                            whiteSpace:'nowrap',
                            textOverflow:'ellipsis',
                            boxShadow:'0 3px 6px rgba(0,0,0,0.08)',
                            border:'1px solid rgba(0,0,0,0.06)',
                            cursor: onEventClick ? 'pointer' : 'default',
                            display:'flex',
                            alignItems:'center',
                            gap:8,
                            zIndex:2,
                            minHeight:24,
                            maxHeight:26,
                            alignSelf:'stretch'
                          }}
                        >
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
