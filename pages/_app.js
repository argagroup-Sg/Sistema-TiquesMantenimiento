import React from 'react'
import { SessionProvider } from 'next-auth/react'
import '../styles/global.css'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function App({ Component, pageProps: { session, ...pageProps } }){
  const showSpeed = process.env.NODE_ENV === 'production';
  return (
    <SessionProvider session={session}>
      {showSpeed && <SpeedInsights />}
      <Component {...pageProps} />
    </SessionProvider>
  )
}
