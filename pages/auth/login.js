import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/router'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', { redirect: false, email, password })
    if(res?.error){
      setError(res.error)
      setLoading(false)
      return
    }
    // Obtener sesión para leer rol y redirigir
    const session = await getSession()
    const role = session?.user?.rol || session?.user?.role
    if(role === 'admin') return router.push('/admin')
    if(role === 'super') return router.push('/super')
    if(role === 'tecnico' || role === 'técnico') return router.push('/tecnico')
    return router.push('/empleado')
  }

  return (
    <div style={{maxWidth:420,margin:'40px auto'}}>
      <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              background: '#ffffff', // Fondo blanco para que resalte el logo perfectamente
              borderRadius: '12px',
              width: 'fit-content'
            }}>
              <img
                src="https://exportgagroup.com/wp-content/uploads/2023/02/350x100-logo-pag-hori-e1745438808154.png"
                alt="Exportgagroup Prawn Exporter Logo"
                style={{
                  width: '100%',
                  maxWidth: '350px', // Mantiene la resolución óptima original
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </div>
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="text" />
        <label>Contraseña</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" />
        <div style={{marginTop:12}}>
          <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        </div>
        {error && <div style={{color:'red',marginTop:8}}>{error}</div>}
      </form>
    </div>
  )
}
