
# Sistema de Mantenimiento — Next.js

Este repositorio contiene la aplicación "Sistema de Mantenimiento" migrada a Next.js (Pages router). Incluye API routes para CRUD y autenticación (NextAuth con Credentials + un endpoint JWT para casos E2E).

Resumen rápido
- Next.js + API routes
- Conexión a Postgres (DATABASE_URL)
- Autenticación: NextAuth (Credentials) y endpoint `/api/auth/login` para JWT

Requisitos locales
- Node >= 16 (recomendado 18+)
- PostgreSQL (Vercel Postgres, Neon o local)

Instalación y ejecución local
1. Instalar dependencias

```bash
cd next-app
npm install
```

2. Crear `.env.local` (no lo subas al repo). Copia `.env.example` y rellena valores:

- `DATABASE_URL` — cadena de conexión a Postgres
- `NEXTAUTH_URL` — URL de la app en dev (ej. `http://localhost:3000`)
- `NEXTAUTH_SECRET` — secreto fuerte
- `JWT_SECRET` — (opcional) si usas endpoints JWT

3. Crear tablas en la DB

```bash
psql "$DATABASE_URL" -f schema.sql
```

4. Ejecutar en desarrollo

```bash
npm run dev
```

Verificación rápida
- Abrir `http://localhost:3000` y probar el login.
- Revisar `/admin` y `/super` según roles.

Checklist antes del deploy (revisa estos puntos)
- [ ] `NEXTAUTH_URL` y `NEXTAUTH_SECRET` configurados correctamente
- [ ] `DATABASE_URL` apuntando a la DB de producción (o Vercel Postgres)
- [ ] Ejecutadas migraciones / `schema.sql` en la DB objetivo
- [ ] Ejecutar `npm run build` localmente para detectar errores de compilación
- [ ] Tests (si aplica) pasan: `npm run test`
- [ ] Revisar callbacks de NextAuth: `jwt` y `session` exponen `role`/`rol` (ya está implementado)
- [ ] `signOut({ callbackUrl: '/auth/login' })` redirige correctamente (se manejó la callback de redirect para rutas relativas)

Preparar repo y deploy a GitHub
1. Inicializar git y push al repo remoto (ejemplo):

```bash
cd next-app
git init
git add .
git commit -m "Import: Sistema de Mantenimiento (Next.js)"
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

Despliegue en Vercel (pasos)
1. Ir a https://vercel.com y crear un proyecto importando el repositorio GitHub.
2. En Vercel > Project > Settings > Environment Variables, añadir las variables que uso la app:

- `DATABASE_URL` — connection string a Postgres (Production)
- `NEXTAUTH_URL` — URL pública del despliegue (ej. `https://tu-app.vercel.app`)
- `NEXTAUTH_SECRET` — secreto fuerte
- `JWT_SECRET` — (opcional)

Notas sobre entornos en Vercel:
- Añade cada variable de entorno para los scopes `Preview` y `Production` (y `Development` si quieres).
- No subas `.env.local` al repo. En Vercel la UI guarda las variables de entorno y se inyectan en tiempo de build/runtime.

Usar Vercel CLI (opcional) para añadir variables:

```bash
npx vercel login
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
```

Checklist post-deploy
- [ ] Revisar `Build Logs` en Vercel para errores
- [ ] Verificar rutas principales: `/`, `/auth/login`, `/admin`, `/super`
- [ ] Probar cerrar sesión y comprobar redirect a `/auth/login` (en la misma host)
- [ ] Comprobar que las APIs funcionan y que la app puede leer/escribir en la DB

Buenas prácticas y seguridad
- No incluyas `.env.local` en el repo
- Rota secretos si los compartiste accidentalmente
- Usa usuarios DB con mínimos privilegios
- Configura backups y monitorización para la base de datos



---


