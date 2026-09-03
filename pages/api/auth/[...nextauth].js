import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import db from '../../../lib/db'
import bcrypt from 'bcryptjs'

async function findUserByEmail(email) {
  const r = await db.query('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [email])
  return r.rows[0]
}

const options = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const user = await findUserByEmail(credentials.email)
        if (!user) return null
        if (user.password_hash) {
          const ok = await bcrypt.compare(credentials.password, user.password_hash)
          if (!ok) return null
        }
        return { id: user.id, email: user.email, name: user.nombre, rol: user.rol }
      }
    })
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }){
      if (user) {
        token.role = user.rol || user.role
        token.rol = user.rol || user.role
        token.name = user.name || user.nombre
        token.nombre = user.name || user.nombre
      }
      return token
    },
    async session({ session, token }){
      session.user.role = token.role
      session.user.rol = token.rol
      session.user.name = token.name || token.nombre || session.user.name
      session.user.nombre = token.nombre || session.user.name
      return session
    }
    ,
    async redirect({ url, baseUrl }){
      // Ensure signOut and other redirects land on the app login page
      try{
        if(!url) return baseUrl
        // If it's a relative path, keep it within app
        // Return relative URLs as-is so the browser stays on the current origin
        if(url.startsWith('/')) return url
        const to = new URL(url)
        if(to.origin === baseUrl) return url
      }catch(e){ /* fallthrough */ }
      return baseUrl + '/auth/login'
    }
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-replace'
}

export default NextAuth(options)
