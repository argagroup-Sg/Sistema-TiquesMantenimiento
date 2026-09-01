# Sistema de Mantenimiento — Migración a Next.js + Vercel Postgres

Resumen rápido:
- Proyecto Next.js con API routes para reemplazar Google Apps Script.
- Conexión a Vercel Postgres via `DATABASE_URL`.
- Autenticación inicial con JWT (login por email). Puedes integrar Auth0/Clerk/NextAuth más adelante.

Pasos para ejecutar localmente:

1. Instalar dependencias

```bash
cd "next-app"
npm install
```

2. Crear la base de datos en Vercel Postgres o local Postgres y ejecutar `schema.sql`:

```bash
# Usando psql
psql $DATABASE_URL -f schema.sql
```

3. Crear archivo `.env.local` con variables (puedes copiar `.env.example`). Variables importantes:

- `DATABASE_URL` — connection string a Postgres (Vercel Postgres / Neon / local)
- `NEXTAUTH_URL` — URL pública/local de la app (ej. `http://localhost:3006` en dev)
- `NEXTAUTH_SECRET` — secreto para NextAuth y JWT (usar valor fuerte en producción)
- `JWT_SECRET` — (opcional) alias para compatibilidad con tokens JWT existentes

4. Ejecutar en desarrollo

```bash
npm run dev
```

Deploy en Vercel:
- Conectar el repositorio a Vercel.
- Añadir variables de entorno en Vercel (Settings > Environment Variables):
	- `DATABASE_URL` — connection string a Vercel Postgres
	- `NEXTAUTH_URL` — la URL pública del despliegue (ej. https://tu-app.vercel.app)
	- `NEXTAUTH_SECRET` — secreto fuerte para NextAuth
	- `JWT_SECRET` — (opcional) si aún usas tokens JWT
- Deploy automático desde la rama principal.

Notas y siguientes pasos recomendados:
- Endpoints ya implementados: `areas`, `maquinas`, `proveedores`, `escalados`, `tickets`, `users` y `tecnicos`.
- Autenticación: hay soporte dual durante la migración:
	- `NextAuth` con provider `credentials` (usa cookies de sesión en el navegador).
	- Endpoint `/api/auth/login` que emite un JWT para pruebas programáticas y clientes API.
- Recomendación: en producción usa `NextAuth` con `NEXTAUTH_SECRET` y `NEXTAUTH_URL`. Mantener `/api/auth/login` es útil para scripts/E2E.
- Añadir validaciones y tests automáticos.
- Opcional: migrar la UI completa de `Index.html` a componentes React más detallados.

Comandos útiles adicionales

- Ejecutar tests:

```bash
npm run test
```

- Build para producción:

```bash
npm run build
```

Despliegue en Vercel (resumen)

1. Crear un repositorio en GitHub y push del contenido de la carpeta `next-app`.
2. Importar el proyecto en Vercel (Import Project).
3. Añadir variables de entorno en Vercel (Settings > Environment Variables):
	- `DATABASE_URL` — connection string a Vercel Postgres o Neon/Heroku/Postgres
	- `JWT_SECRET` — secreto fuerte para NextAuth y JWT
4. Vercel ejecutará `npm run build` y desplegará la app.

Ejecutar migraciones (crear tablas) en la DB antes de usar la app:

```bash
# usando psql (ejemplo):
psql "$DATABASE_URL" -f schema.sql
```

Seguridad y buenas prácticas

- No incluyas `.env.local` en el repo. Rota las credenciales si las compartiste.
- Usa un usuario/contraseña con privilegios mínimos para la app.
- Considera integrar un proveedor SSO (Auth0/Clerk) para producción.

CI / Tests

- Hay un workflow en `.github/workflows/ci.yml` que ejecuta tests en cada push/PR a `main`.

Siguientes acciones disponibles

- Puedo crear el repositorio en GitHub y empujar los archivos por ti (proporciona la URL de repo o autorización para ejecutar comandos locales).
- Puedo configurar Vercel y ayudarte a añadir las variables de entorno.
- Puedo integrar Auth0/Clerk para SSO en producción.

