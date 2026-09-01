async function api(path, opts = {}){
  const res = await fetch('/api' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  const txt = await res.text();
  try{
    const json = txt ? JSON.parse(txt) : {};
    if(!res.ok) throw new Error(json.error || txt || res.statusText);
    return json;
  }catch(e){
    if(!res.ok) throw new Error(txt || res.statusText);
    try{ return JSON.parse(txt || '{}'); }catch(_){ return { raw: txt }; }
  }
}

export { api };
export default api;
