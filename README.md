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

3. Crear archivo `.env.local` con variables (puedes copiar `.env.example`)

4. Ejecutar en desarrollo

```bash
npm run dev
```

Deploy en Vercel:
- Conectar el repositorio a Vercel.
- Añadir `DATABASE_URL` como variable de entorno (Vercel Postgres o conexión externa).
- Añadir `JWT_SECRET` como variable.
- Deploy automático desde la rama principal.

Notas y siguientes pasos recomendados:
- Implementar endpoints faltantes: `areas`, `maquinas`, `proveedores`, `escalados` (ya existe el `schema.sql`).
- Reemplazar el login JWT por `NextAuth.js` o `Auth0` para SSO/SSO con providers.
- Añadir validaciones y tests automáticos.
- Opcional: migrar la UI completa de `Index.html` a componentes React más detallados.
