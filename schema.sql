-- Vercel Postgres schema for Sistema de Mantenimiento

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('empleado','tecnico','admin')),
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS maquinas (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  solicitante TEXT NOT NULL,
  area TEXT,
  maquina TEXT,
  urgencia TEXT,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'Abierto',
  tecnico TEXT,
  fecha_asignacion TIMESTAMP WITH TIME ZONE,
  fecha_en_proceso TIMESTAMP WITH TIME ZONE,
  fecha_en_espera TIMESTAMP WITH TIME ZONE,
  fecha_resuelto TIMESTAMP WITH TIME ZONE,
  fecha_escalado TIMESTAMP WITH TIME ZONE,
  nota TEXT,
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalados (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  fecha_escalado TIMESTAMP WITH TIME ZONE DEFAULT now(),
  proveedor TEXT,
  estado TEXT,
  fecha_en_proceso TIMESTAMP WITH TIME ZONE,
  fecha_en_espera TIMESTAMP WITH TIME ZONE,
  fecha_resuelto TIMESTAMP WITH TIME ZONE,
  solicitante TEXT,
  area TEXT,
  maquina TEXT,
  urgencia TEXT,
  descripcion TEXT,
  responsable TEXT,
  nota TEXT,
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS historial (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accion TEXT,
  estado TEXT,
  usuario TEXT,
  detalle TEXT
);
