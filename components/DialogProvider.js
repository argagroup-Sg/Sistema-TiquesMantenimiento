import React, { createContext, useContext, useState, useRef } from 'react'

const DialogContext = createContext(null)

export function useDialog(){
  return useContext(DialogContext)
}

export default function DialogProvider({ children }){
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  function close(result){
    const r = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if(r) r(result);
  }

  function openConfirm(message, title='Confirmar'){
    return new Promise((resolve)=>{
      resolverRef.current = resolve;
      setDialog({ type:'confirm', title, message });
    });
  }

  function openPrompt(message, defaultValue='', title='Entrada'){
    return new Promise((resolve)=>{
      resolverRef.current = resolve;
      setDialog({ type:'prompt', title, message, defaultValue });
    });
  }

  return (
    <DialogContext.Provider value={{ openConfirm, openPrompt }}>
      {children}
      {dialog && (
        <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)',zIndex:9999}}>
          <div style={{background:'#fff',padding:18,borderRadius:8,minWidth:320,maxWidth:'90%'}}>
            <div style={{fontWeight:700,marginBottom:8}}>{dialog.title}</div>
            <div style={{marginBottom:12}}>{dialog.message}</div>
            {dialog.type === 'prompt' && (
              <PromptBody defaultValue={dialog.defaultValue} onCancel={()=>close(null)} onOk={(v)=>close(v)} />
            )}
            {dialog.type === 'confirm' && (
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button onClick={()=>close(false)}>No</button>
                <button onClick={()=>close(true)} style={{background:'#2563eb',color:'#fff'}}>Sí</button>
              </div>
            )}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

function PromptBody({ defaultValue='', onOk, onCancel }){
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <input autoFocus value={value} onChange={e=>setValue(e.target.value)} style={{width:'100%',padding:8,marginBottom:12}} />
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
        <button onClick={()=>onCancel()}>Cancelar</button>
        <button onClick={()=>onOk(value)} style={{background:'#2563eb',color:'#fff'}}>Aceptar</button>
      </div>
    </div>
  )
}
