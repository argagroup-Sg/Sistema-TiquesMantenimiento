Resumen de cambios y pasos para commit/despliegue

Cambios principales:
- Migración de lógica GAS a Next.js API routes (`/api/*`) y páginas en `next-app`.
- Autenticación: NextAuth (Credentials) + endpoint JWT `/api/auth/login` para E2E.
- Endpoints: tickets, escalados, historial, usuarios, areas, maquinas, proveedores, tecnicos.
- UI: `pages/admin.js`, `pages/tecnico.js`, `pages/empleado.js` con estilos en `styles/global.css`.
- Nuevas utilidades: `lib/format.js` (formatDate, statusClass).

Cómo probar localmente:

1. Instalar dependencias y variables de entorno (en `next-app/.env.local` o sistema):

```powershell
cd "C:\Users\user\Desktop\Sistema de Mantenimiento\next-app"
npm install
# crear .env.local con las variables requeridas
# Copy from .env.example
```

2. Ejecutar servidor dev:

```powershell
npm run dev
# Next.js normalmente arranca en http://localhost:3000 (si está ocupado prueba el puerto mostrado)
```

3. Seed de usuarios (opcional):

```powershell
node scripts/create_users_bulk.js
```

4. Pruebas E2E rápidas (programmatic login):

```powershell
node -e "(async()=>{const base='http://localhost:3000'; const fetch=global.fetch|| (await import('node-fetch')).default; const email='admin@example.com'; const password=process.env.DEFAULT_USER_PASSWORD||'TempPass123!'; const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}); console.log(await login.json()); })()"
```

Despliegue a Vercel (resumen):
- Conectar el repo a Vercel.
- Variables de entorno en Vercel: `DATABASE_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `NEXTAUTH_URL`, `DEFAULT_USER_PASSWORD`.
- Build command: `npm run build` (Next 14) — Vercel detecta Next.js.
- Asegurar que la base de datos Postgres esté accesible desde Vercel (Vercel Postgres o external DB).

Sugerencia de commits:

```bash
git add .
git commit -m "feat: migración GAS → Next.js; auth, APIs, admin UI, historial y toasts"
git push origin main
```

