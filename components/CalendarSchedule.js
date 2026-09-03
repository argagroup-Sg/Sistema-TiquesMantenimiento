import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr:false })

export default function CalendarSchedule({ tecnicos = [], tickets = [], view='week', currentDate=null, filterTecnico=null, onlyAvailable=false }){
  const resources = useMemo(()=> (tecnicos||[]).map(t=>({ id: (t.email||t.id||t.nombre)||String(Math.random()), title: t.nombre || t.email || t.id, raw: t })) , [tecnicos])
  const events = useMemo(()=> (tickets||[]).filter(tt=> (tt.fecha_creacion||tt.fecha)).map(tt=>{
    const start = tt.fecha_creacion || tt.fecha;
    let end = tt.fecha_resuelto || null;
    if(!end) end = new Date(new Date(start).getTime() + 1000*60*60*2).toISOString();
    return {
      id: String(tt.id),
      title: `#${tt.id} ${tt.solicitante || tt.descripcion || ''}`.slice(0,60),
      start,
      end,
      resourceId: (tt.tecnico||'')
    }
  }), [tickets])

  // aplicar filtro por técnico
  const filteredResources = useMemo(()=>{
    if(!filterTecnico) return resources;
    return resources.filter(r=> String(r.id) === String(filterTecnico));
  }, [resources, filterTecnico])

  const filteredEvents = useMemo(()=>{
    let ev = events;
    if(filterTecnico) ev = ev.filter(e=> String(e.resourceId) === String(filterTecnico));
    return ev;
  }, [events, filterTecnico])

  // si onlyAvailable: mostrar recursos que no tienen eventos en la ventana visible
  const visibleResources = useMemo(()=>{
    if(!onlyAvailable) return filteredResources;
    // determinar ventana de fechas (mes de currentDate)
    const start = currentDate ? new Date(currentDate) : new Date();
    const windowStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const windowEnd = new Date(start.getFullYear(), start.getMonth()+1, 1);
    const busyIds = new Set(filteredEvents.filter(ev=> new Date(ev.start) < windowEnd && new Date(ev.end) >= windowStart).map(ev=> String(ev.resourceId)));
    return filteredResources.filter(r=> !busyIds.has(String(r.id)));
  }, [filteredResources, onlyAvailable, filteredEvents, currentDate])

  // vista agregada anual
  if(view === 'year'){
    // calcular cantidad de tiques por mes
    const refDate = currentDate ? new Date(currentDate) : new Date();
    const year = refDate.getFullYear();
    const months = new Array(12).fill(0);
    (filteredEvents||[]).forEach(ev=>{
      const d = new Date(ev.start);
      if(d.getFullYear() === year) months[d.getMonth()] += 1;
    })
    return (
      <div style={{minHeight:300,padding:8}}>
        <h4 style={{marginTop:0}}>Resumen anual {year}</h4>
        <div style={{height:160,display:'flex',alignItems:'end',gap:8}}>
          {months.map((m,i)=>{
            const total = Math.max(...months,1);
            const h = Math.round((months[i]/total) * 120);
            return (
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{width:'80%',height:h,background:'#2563eb',borderRadius:6}} />
                <div className="small" style={{marginTop:6}}>{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i]}</div>
                <div style={{fontWeight:700}}>{months[i]}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // mapear nuestros nombres de vista simples a vistas de FullCalendar
  const initialView = view === 'day' ? 'resourceTimeGridDay' : (view === 'week' ? 'resourceTimeGridWeek' : (view === 'month' ? 'dayGridMonth' : 'resourceTimeGridWeek'));

  return (
    <div style={{minHeight:400}}>
      <FullCalendar
        plugins={[ resourceTimeGridPlugin, timeGridPlugin, dayGridPlugin, interactionPlugin ]}
        initialView={initialView}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,resourceTimeGridDay' }}
        resources={visibleResources}
        events={filteredEvents}
        nowIndicator
        height={600}
        initialDate={currentDate || undefined}
      />
    </div>
  )
}
