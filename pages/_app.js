import React from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import '../styles/global.css'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ToastProvider from '../components/ToastProvider'

function Layout({ children }){
  const { data: session } = useSession();
  return (
    <>
      <header style={{background:'#0f172a',color:'#fff',padding:'8px 0'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 12px'}}>
          <Link href="/" style={{color:'#fff',textDecoration:'none',fontWeight:700}}>Sistema de Mantenimiento</Link>
          <div>
            {session ? (
              <>
                <span style={{marginRight:12}}>{session.user?.name || session.user?.email}</span>
                <button onClick={()=>signOut({ callbackUrl: '/auth/login' })} style={{background:'#ef4444',color:'#fff',border:'none',padding:'6px 10px',borderRadius:4}}>Cerrar sesión</button>
              </>
            ) : (
              <Link href="/auth/login" style={{color:'#fff',textDecoration:'underline'}}>Iniciar sesión</Link>
            )}
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
    </>
  )
}

export default function App({ Component, pageProps: { session, ...pageProps }}){
  const showSpeed = process.env.NODE_ENV === 'production';
  return (
    <SessionProvider session={session}>
      {showSpeed && <SpeedInsights />}
      <ToastProvider>
        <Layout>
          <div style={{padding:'18px 0'}}>
            <Component {...pageProps} />
          </div>
        </Layout>
      </ToastProvider>
    </SessionProvider>
  )
}
