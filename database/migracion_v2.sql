-- ============================================================
-- cobrApp - Script de Migración v2.0
-- Fecha: Mayo 2026
-- Descripción: Correcciones y nuevas tablas sobre el esquema
--              existente. Seguro de ejecutar sobre datos vivos.
-- ============================================================
-- Ejecutar en orden. Si algún ALTER falla porque la columna
-- ya existe, comentar esa línea y continuar.
-- ============================================================

-- ============================================================
-- 1. TABLA: creditos
--    Faltan: tasa_interes, periodicidad, updated_at
-- ============================================================

ALTER TABLE creditos ADD COLUMN numero_credito VARCHAR(100) NULL COMMENT 'Código o número de referencia del crédito (único por empresa)' AFTER cliente_id;
ALTER TABLE creditos ADD COLUMN tasa_interes DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Tasa de interés anual en porcentaje' AFTER cantidad_cuotas;
ALTER TABLE creditos ADD COLUMN periodicidad ENUM('SEMANAL','QUINCENAL','MENSUAL') DEFAULT 'MENSUAL' COMMENT 'Frecuencia de pago de las cuotas' AFTER tasa_interes;
-- ALTER TABLE creditos ADD COLUMN updated_at DATETIME DEFAULT NOW() ON UPDATE NOW() AFTER created_at; -- columna ya existe

-- Índice único para numero_credito por empresa (NULL no es considerado duplicado en MySQL)
ALTER TABLE creditos
  ADD UNIQUE KEY uq_credito_empresa (empresa_id, numero_credito);

-- ============================================================
-- 2. TABLA: cuotas
--    Faltan: fecha_pago, created_at, updated_at
-- ============================================================

ALTER TABLE cuotas ADD COLUMN fecha_pago DATE NULL COMMENT 'Fecha real en que fue pagada la cuota' AFTER estado;
ALTER TABLE cuotas ADD COLUMN created_at DATETIME DEFAULT NOW() AFTER fecha_pago;
ALTER TABLE cuotas ADD COLUMN updated_at DATETIME DEFAULT NOW() ON UPDATE NOW() AFTER created_at;

-- ============================================================
-- 3. TABLA: asignaciones
--    Faltan: supervisor_id (quién asignó), fecha_limite
-- ============================================================

ALTER TABLE asignaciones ADD COLUMN supervisor_id INT NULL COMMENT 'Supervisor que realizó la asignación' AFTER usuario_id;
ALTER TABLE asignaciones ADD COLUMN fecha_limite DATE NULL COMMENT 'Fecha límite para completar la cobranza' AFTER fecha_asignacion;

-- FK supervisor_id (solo si no existe)
ALTER TABLE asignaciones
  ADD CONSTRAINT fk_asignaciones_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ============================================================
-- 4. TABLA: gestiones
--    Falta: monto_cobrado
-- ============================================================

ALTER TABLE gestiones
  ADD COLUMN monto_cobrado DECIMAL(12,2) DEFAULT 0.00
    COMMENT 'Monto efectivamente cobrado en esta gestión'
    AFTER longitud;

-- ============================================================
-- 5. TABLA: pagos
--    Falta: gestion_id (en qué gestión se recibió el pago)
-- ============================================================

ALTER TABLE pagos
  ADD COLUMN gestion_id INT NULL
    COMMENT 'Gestión durante la cual se recibió el pago'
    AFTER cuota_id;

-- FK gestion_id
ALTER TABLE pagos
  ADD CONSTRAINT fk_pagos_gestion
    FOREIGN KEY (gestion_id) REFERENCES gestiones(id)
    ON DELETE SET NULL;

-- ============================================================
-- 6. TABLA: notificaciones
--    Faltan: tipo, leida_at
-- ============================================================

ALTER TABLE notificaciones ADD COLUMN tipo VARCHAR(50) DEFAULT 'SISTEMA' COMMENT 'Tipo: ASIGNACION | VENCIMIENTO | PAGO | SISTEMA' AFTER mensaje;
ALTER TABLE notificaciones ADD COLUMN leida_at DATETIME NULL COMMENT 'Timestamp exacto en que fue leída' AFTER leida;

-- ============================================================
-- 7. NUEVA TABLA: zonas
--    Agrupación geográfica/lógica de clientes por empresa.
--    OPCIONAL: clientes pueden tener zona_id = NULL.
-- ============================================================

CREATE TABLE IF NOT EXISTS zonas (
  id           INT          NOT NULL AUTO_INCREMENT,
  empresa_id   INT          NOT NULL,
  nombre       VARCHAR(100) NOT NULL  COMMENT 'Ej: Zona Norte, Barrio San Pedro',
  descripcion  TEXT         NULL,
  color        VARCHAR(7)   DEFAULT '#3B82F6'
                            COMMENT 'Color hex para identificar la zona en el mapa',
  estado       TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT fk_zonas_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE CASCADE
) COMMENT 'Zonas de cobranza para organizar clientes geográficamente';

-- ============================================================
-- 8. TABLA: clientes
--    Agregar zona_id (nullable = zona es opcional)
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN zona_id INT NULL
    COMMENT 'Zona de cobranza asignada. NULL = sin zona definida'
    AFTER longitud;

ALTER TABLE clientes
  ADD CONSTRAINT fk_clientes_zona
    FOREIGN KEY (zona_id) REFERENCES zonas(id)
    ON DELETE SET NULL;

-- ============================================================
-- 9. NUEVA TABLA: comprobantes
--    Imágenes o archivos adjuntos como evidencia de un pago.
--    El cobrador puede tomar foto del recibo desde la app.
-- ============================================================

CREATE TABLE IF NOT EXISTS comprobantes (
  id           INT          NOT NULL AUTO_INCREMENT,
  pago_id      INT          NOT NULL,
  url_archivo  VARCHAR(500) NOT NULL  COMMENT 'Ruta o URL del archivo subido',
  tipo         VARCHAR(50)  DEFAULT 'imagen' COMMENT 'imagen | pdf | otro',
  created_at   DATETIME     DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT fk_comprobantes_pago
    FOREIGN KEY (pago_id) REFERENCES pagos(id)
    ON DELETE CASCADE
) COMMENT 'Evidencias fotográficas o documentales de pagos registrados';

-- ============================================================
-- VERIFICACIÓN FINAL
-- Ejecutar estas consultas para confirmar que todo quedó bien
-- ============================================================

-- Ver estructura de tablas modificadas:
-- DESCRIBE creditos;
-- DESCRIBE cuotas;
-- DESCRIBE asignaciones;
-- DESCRIBE gestiones;
-- DESCRIBE pagos;
-- DESCRIBE notificaciones;
-- DESCRIBE clientes;

-- Ver tablas nuevas:
-- DESCRIBE zonas;
-- DESCRIBE comprobantes;

-- Ver todas las tablas del esquema:
-- SELECT TABLE_NAME, TABLE_COMMENT
-- FROM INFORMATION_SCHEMA.TABLES
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME;

-- ============================================================
-- RESUMEN DE CAMBIOS
-- ============================================================
-- creditos      → +numero_credito (único por empresa), +tasa_interes, +periodicidad, +updated_at
-- cuotas        → +fecha_pago, +created_at, +updated_at
-- asignaciones  → +supervisor_id (FK), +fecha_limite
-- gestiones     → +monto_cobrado
-- pagos         → +gestion_id (FK)
-- notificaciones→ +tipo, +leida_at
-- clientes      → +zona_id (FK nullable)
-- zonas         → TABLA NUEVA
-- comprobantes  → TABLA NUEVA
-- ============================================================
