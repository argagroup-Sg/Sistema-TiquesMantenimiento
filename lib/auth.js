const { getToken } = require('next-auth/jwt');
const jwt = require('jsonwebtoken');

// Preferir NEXTAUTH_SECRET, usar JWT_SECRET como respaldo por compatibilidad
const SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-replace';

async function getUserFromReq(req) {
  try {
    // Intentar primero getToken de next-auth (maneja cookies y flujos estándar)
    const token = await getToken({ req, secret: SECRET });
    if (token) {
      token.role = token.role || token.rol || '';
      return token;
    }

    // Alternativa: revisar encabezado Authorization para token Bearer
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (auth && auth.toString().toLowerCase().startsWith('bearer ')) {
      const t = auth.split(' ')[1];
      try {
        const payload = jwt.verify(t, SECRET);
        payload.role = payload.role || payload.rol || '';
        return payload;
      } catch (e) {
        return null;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

function requireRole(user, roles) {
  if (!user) return false;
  const r = (user.role || user.rol || '').toString().toLowerCase();
  if (Array.isArray(roles)) return roles.map(x=>x.toString().toLowerCase()).includes(r);
  return r === roles.toString().toLowerCase();
}

module.exports = { getUserFromReq, requireRole };
