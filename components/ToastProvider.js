import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast(){
  return useContext(ToastContext)
}

export default function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type='info', ttl=4000) => {
    const id = Date.now() + Math.random().toString(36).slice(2,8)
    const t = { id, message, type }
    setToasts(s => s.concat([t]))
    setTimeout(() => setToasts(s => s.filter(x=>x.id!==id)), ttl)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={"toast " + (t.type||'info')}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
