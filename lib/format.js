export function formatDate(val){
  if(!val) return '';
  const d = new Date(val);
  if(isNaN(d.getTime())) return String(val);
  return d.toLocaleString();
}

export function statusClass(status){
  if(!status) return 'Abierto';
  const s = String(status).replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\-]/g,'');
  return s;
}

export default { formatDate, statusClass };
