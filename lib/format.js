const DEFAULT_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/Guayaquil';

export function formatDate(val, opts = {}){
  if(!val) return '';
  const d = new Date(val);
  if(isNaN(d.getTime())) return String(val);
  const locale = opts.locale || 'es-EC';
  const withTime = opts.withTime !== false; // default true
  const dateOptions = withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false } : { day: '2-digit', month: 'short', year: 'numeric' };
  try{
    return new Intl.DateTimeFormat(locale, { ...dateOptions, timeZone: opts.timeZone || DEFAULT_TIMEZONE }).format(d);
  }catch(e){
    // Fallback
    return d.toLocaleString();
  }
}

export function formatTime(val, opts = {}){
  if(!val) return '';
  const d = new Date(val);
  if(isNaN(d.getTime())) return String(val);
  const locale = opts.locale || 'es-EC';
  try{
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: opts.timeZone || DEFAULT_TIMEZONE }).format(d);
  }catch(e){
    return d.toLocaleTimeString();
  }
}

export function statusClass(status){
  if(!status) return 'Abierto';
  const s = String(status).replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\-]/g,'');
  return s;
}

export default { formatDate, statusClass };
