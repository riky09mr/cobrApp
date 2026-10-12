-- ============================================================
-- cobrApp - Migracion v21: Sistema de Permisos por Vista
-- Fecha: Agosto 2026
-- Objetivo:
--   - Crear un sistema de permisos granulares por vista y accion
--     (ver, crear, editar, eliminar) para cada modulo.
--   - Tabla `permisos`: catalogo de permisos disponibles.
--   - Tabla `rol_permisos`: permisos por defecto de cada rol.
--   - Tabla `usuario_permisos`: excepciones/permisos extra
--     asignados a un usuario especifico (el SUPERVISOR asigna
--     permisos a los COBRADORES).
--   - El rol ADMIN siempre tiene acceso total (se maneja en
--     codigo, no necesita filas en rol_permisos).
-- ============================================================

START TRANSACTION;

-- ------------------------------------------------------------
-- 1. Tabla `permisos`: catalogo de permisos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permisos (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  modulo      VARCHAR(50)  NOT NULL COMMENT 'Modulo: clientes, cobranzas, gestiones, usuarios, etc.',
  accion      VARCHAR(20)  NOT NULL COMMENT 'Accion: ver, crear, editar, eliminar',
  descripcion VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permiso (modulo, accion)
) COMMENT='Catalogo de permisos por modulo y accion';

-- ------------------------------------------------------------
-- 2. Tabla `rol_permisos`: permisos por defecto de cada rol
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol_permisos (
  id         BIGINT   NOT NULL AUTO_INCREMENT,
  rol_id     INT      NOT NULL COMMENT 'FK roles.id',
  permiso_id BIGINT   NOT NULL COMMENT 'FK permisos.id',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_permiso (rol_id, permiso_id),
  KEY idx_rp_rol (rol_id),
  KEY idx_rp_permiso (permiso_id),
  CONSTRAINT fk_rp_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permiso FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
) COMMENT='Permisos por defecto de cada rol';

-- ------------------------------------------------------------
-- 3. Tabla `usuario_permisos`: excepciones por usuario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_permisos (
  id         BIGINT   NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT   NOT NULL COMMENT 'FK usuarios.id',
  permiso_id BIGINT   NOT NULL COMMENT 'FK permisos.id',
  otorgado   TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = permiso otorgado, 0 = permiso denegado',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_permiso (usuario_id, permiso_id),
  KEY idx_up_usuario (usuario_id),
  KEY idx_up_permiso (permiso_id),
  CONSTRAINT fk_up_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_permiso FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
) COMMENT='Permisos especificos asignados a un usuario (excepciones)';

-- ------------------------------------------------------------
-- 4. Seed: catalogo de permisos
-- ------------------------------------------------------------
INSERT IGNORE INTO permisos (modulo, accion, descripcion) VALUES
  -- Clientes
  ('clientes', 'ver',     'Ver listado y detalle de clientes'),
  ('clientes', 'crear',   'Crear nuevos clientes'),
  ('clientes', 'editar',  'Editar clientes existentes'),
  ('clientes', 'eliminar','Eliminar clientes'),
  -- Cobranzas
  ('cobranzas', 'ver',    'Ver cobranzas'),
  ('cobranzas', 'crear',  'Registrar cobros'),
  ('cobranzas', 'editar', 'Editar cobranzas'),
  ('cobranzas', 'eliminar','Anular cobranzas'),
  -- Gestiones
  ('gestiones', 'ver',    'Ver gestiones'),
  ('gestiones', 'crear',  'Registrar gestiones'),
  ('gestiones', 'editar', 'Editar gestiones'),
  ('gestiones', 'eliminar','Eliminar gestiones'),
  -- Usuarios
  ('usuarios', 'ver',     'Ver listado de usuarios'),
  ('usuarios', 'crear',   'Crear usuarios'),
  ('usuarios', 'editar',  'Editar usuarios'),
  ('usuarios', 'eliminar','Eliminar usuarios'),
  ('usuarios', 'permisos','Asignar permisos a usuarios'),
  -- Empresas
  ('empresas', 'ver',     'Ver empresas'),
  ('empresas', 'crear',   'Crear empresas'),
  ('empresas', 'editar',  'Editar empresas'),
  ('empresas', 'eliminar','Eliminar empresas'),
  -- Reportes
  ('reportes', 'ver',     'Ver reportes'),
  -- Configuracion
  ('configuracion', 'ver',    'Ver configuracion de cobranzas'),
  ('configuracion', 'editar', 'Editar configuracion de cobranzas'),
  ('configuracion', 'intereses', 'Gestionar intereses y feriados'),
  -- Zonas
  ('zonas', 'ver',     'Ver zonas'),
  ('zonas', 'crear',   'Crear zonas'),
  ('zonas', 'editar',  'Editar zonas'),
  ('zonas', 'eliminar','Eliminar zonas'),
  -- Metodos de pago
  ('medios_pago', 'ver',     'Ver metodos de pago'),
  ('medios_pago', 'crear',   'Crear metodos de pago'),
  ('medios_pago', 'editar',  'Editar metodos de pago'),
  ('medios_pago', 'eliminar','Eliminar metodos de pago'),
  -- Importar Excel
  ('importar', 'ver',    'Ver importacion de Excel'),
  ('importar', 'crear',  'Importar archivos Excel'),
  -- Descansos / Horarios
  ('descansos', 'ver',    'Ver descansos'),
  ('descansos', 'editar', 'Editar descansos'),
  ('horarios', 'ver',     'Ver horarios'),
  ('horarios', 'editar',  'Editar horarios'),
  -- Mensajes
  ('mensajes', 'ver',     'Ver mensajes'),
  ('mensajes', 'crear',   'Enviar mensajes'),
  ('mensajes', 'eliminar','Eliminar mensajes');

-- ------------------------------------------------------------
-- 5. Seed: permisos por defecto de cada rol
--    (ADMIN se maneja en codigo con acceso total, no necesita filas)
-- ------------------------------------------------------------
-- SUPERVISOR: acceso amplio a gestion de su empresa
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'SUPERVISOR'
  AND NOT (p.modulo = 'empresas' AND p.accion IN ('crear','editar','eliminar'))
  AND NOT (p.modulo = 'empresas' AND p.accion = 'ver')
  AND NOT (p.modulo = 'usuarios' AND p.accion = 'eliminar');

-- COBRADOR: acceso basico a cobranzas y gestiones
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'COBRADOR'
  AND (
    (p.modulo = 'cobranzas' AND p.accion IN ('ver','crear'))
    OR (p.modulo = 'gestiones' AND p.accion IN ('ver','crear'))
    OR (p.modulo = 'mensajes' AND p.accion IN ('ver','crear'))
    -- La app móvil carga los tipos de descanso en la Agenda
    -- (GET /api/descansos/tipos), así que el cobrador necesita
    -- permiso de lectura para poder iniciar/finalizar descansos.
    OR (p.modulo = 'descansos' AND p.accion = 'ver')
    -- La app móvil carga los medios de pago al confirmar un cobro
    -- (GET /api/medios-pago), así que el cobrador necesita permiso
    -- de lectura para poder seleccionar el método de pago.
    OR (p.modulo = 'medios_pago' AND p.accion = 'ver')
  );

COMMIT;
