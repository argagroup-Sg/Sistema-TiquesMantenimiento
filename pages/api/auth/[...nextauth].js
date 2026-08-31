const NextAuth = require('next-auth').default;
const CredentialsProvider = require('next-auth/providers/credentials').default;
const db = require('../../../../lib/db');
const bcrypt = require('bcryptjs');

async function findUserByEmail(email){
  const r = await db.query('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  return r.rows[0];
}

module.exports = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const user = await findUserByEmail(credentials.email);
        if (!user) return null;
        if (user.password_hash) {
          const ok = await bcrypt.compare(credentials.password, user.password_hash);
          if (!ok) return null;
        }
        return { id: user.id, email: user.email, name: user.nombre, rol: user.rol };
      }
    })
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }){
      if (user) {
        token.role = user.rol || user.role;
        token.name = user.name || user.nombre;
      }
      return token;
    },
    async session({ session, token }){
      session.user.role = token.role;
      session.user.name = token.name || session.user.name;
      return session;
    }
  },
  secret: process.env.JWT_SECRET || 'dev-secret-replace'
});
