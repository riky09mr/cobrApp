-- ============================================================
-- cobrApp - Migracion v12: Rediseno ERP de Cobranzas Multientidad
-- Fecha: Julio 2026
-- Objetivo:
--   - Preparar el modulo para multiples empresas, timbrados,
--     establecimientos, puntos de expedicion, cajas y cobradores.
--   - Mantener operativos los flujos legacy actuales.
--   - Evitar perdida de informacion y habilitar migracion progresiva.
-- ============================================================

START TRANSACTION;

-- ============================================================
-- 0. Auditoria tecnica sobre tablas existentes clave
-- ============================================================

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL;

-- ============================================================
-- 1. Timbrados ERP
--    Reemplaza operativamente a facturas_timbrado en el nuevo flujo,
--    pero sin borrar la tabla legacy.
-- ============================================================

CREATE TABLE IF NOT EXISTS timbrados (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  numero_timbrado           VARCHAR(20) NOT NULL,
  fecha_inicio              DATE NOT NULL,
  fecha_fin                 DATE NOT NULL,
  estado                    ENUM('BORRADOR','VIGENTE','VENCIDO','ANULADO','INACTIVO') NOT NULL DEFAULT 'BORRADOR',
  observaciones             TEXT NULL,
  es_electronico            TINYINT(1) NOT NULL DEFAULT 0,
  facturas_timbrado_legacy_id INT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_timbrado_empresa_numero (empresa_id, numero_timbrado),
  KEY idx_timbrado_empresa_estado (empresa_id, estado),
  KEY idx_timbrado_empresa_fechas (empresa_id, fecha_inicio, fecha_fin),
  CONSTRAINT fk_timbrado_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_timbrado_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_timbrado_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Timbrados fiscales por empresa con historial completo';

-- ============================================================
-- 2. Establecimientos
-- ============================================================

CREATE TABLE IF NOT EXISTS establecimientos (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  timbrado_id               BIGINT NULL,
  codigo                    CHAR(3) NOT NULL,
  descripcion               VARCHAR(150) NOT NULL,
  activo                    TINYINT(1) NOT NULL DEFAULT 1,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_establecimiento_empresa_codigo (empresa_id, codigo),
  KEY idx_establecimiento_timbrado (timbrado_id),
  KEY idx_establecimiento_empresa_activo (empresa_id, activo),
  CONSTRAINT fk_establecimiento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_establecimiento_timbrado FOREIGN KEY (timbrado_id) REFERENCES timbrados(id),
  CONSTRAINT fk_establecimiento_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_establecimiento_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Establecimientos fiscales de la empresa';

-- ============================================================
-- 3. Puntos de expedicion
-- ============================================================

CREATE TABLE IF NOT EXISTS puntos_expedicion (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  timbrado_id               BIGINT NOT NULL,
  establecimiento_id        BIGINT NOT NULL,
  codigo                    CHAR(3) NOT NULL,
  descripcion               VARCHAR(150) NULL,
  activo                    TINYINT(1) NOT NULL DEFAULT 1,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_punto_establecimiento_codigo (establecimiento_id, codigo),
  KEY idx_punto_empresa_activo (empresa_id, activo),
  KEY idx_punto_timbrado (timbrado_id),
  CONSTRAINT fk_punto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_punto_timbrado FOREIGN KEY (timbrado_id) REFERENCES timbrados(id),
  CONSTRAINT fk_punto_establecimiento FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id),
  CONSTRAINT fk_punto_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_punto_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Puntos de expedicion por establecimiento';

-- ============================================================
-- 4. Cajas
--    Una caja referencia un unico punto de expedicion. El historial
--    operacional se conserva en caja_aperturas y caja_cambios.
-- ============================================================

CREATE TABLE IF NOT EXISTS cajas (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  punto_expedicion_id       BIGINT NOT NULL,
  nombre                    VARCHAR(120) NOT NULL,
  estado                    ENUM('ACTIVA','BLOQUEADA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  cobrador_asignado_id      INT NULL,
  saldo_inicial_referencia  DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_actual              DECIMAL(14,2) NOT NULL DEFAULT 0,
  fecha_apertura_actual     DATETIME NULL,
  fecha_cierre_actual       DATETIME NULL,
  observaciones             TEXT NULL,
  legacy_arqueo_caja_id     BIGINT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_caja_empresa_nombre (empresa_id, nombre),
  KEY idx_caja_punto (punto_expedicion_id),
  KEY idx_caja_empresa_estado (empresa_id, estado),
  KEY idx_caja_cobrador (cobrador_asignado_id),
  CONSTRAINT fk_caja_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_caja_punto FOREIGN KEY (punto_expedicion_id) REFERENCES puntos_expedicion(id),
  CONSTRAINT fk_caja_cobrador FOREIGN KEY (cobrador_asignado_id) REFERENCES usuarios(id),
  CONSTRAINT fk_caja_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_caja_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Caja operativa asociada a un punto de expedicion';

CREATE TABLE IF NOT EXISTS caja_cambios (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  caja_id                   BIGINT NOT NULL,
  tipo_cambio               ENUM('ASIGNACION_COBRADOR','CAMBIO_COBRADOR','CAMBIO_PUNTO','BLOQUEO','DESBLOQUEO','CAMBIO_TIMBRADO') NOT NULL,
  cobrador_anterior_id      INT NULL,
  cobrador_nuevo_id         INT NULL,
  punto_anterior_id         BIGINT NULL,
  punto_nuevo_id            BIGINT NULL,
  timbrado_anterior_id      BIGINT NULL,
  timbrado_nuevo_id         BIGINT NULL,
  observacion               TEXT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  KEY idx_caja_cambios_caja (caja_id, created_at),
  CONSTRAINT fk_caja_cambio_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_caja_cambio_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_caja_cambio_cobrador_ant FOREIGN KEY (cobrador_anterior_id) REFERENCES usuarios(id),
  CONSTRAINT fk_caja_cambio_cobrador_new FOREIGN KEY (cobrador_nuevo_id) REFERENCES usuarios(id),
  CONSTRAINT fk_caja_cambio_punto_ant FOREIGN KEY (punto_anterior_id) REFERENCES puntos_expedicion(id),
  CONSTRAINT fk_caja_cambio_punto_new FOREIGN KEY (punto_nuevo_id) REFERENCES puntos_expedicion(id),
  CONSTRAINT fk_caja_cambio_timbrado_ant FOREIGN KEY (timbrado_anterior_id) REFERENCES timbrados(id),
  CONSTRAINT fk_caja_cambio_timbrado_new FOREIGN KEY (timbrado_nuevo_id) REFERENCES timbrados(id),
  CONSTRAINT fk_caja_cambio_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_caja_cambio_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Historial de cambios estructurales sobre la caja';

-- ============================================================
-- 5. Aperturas de caja
-- ============================================================

CREATE TABLE IF NOT EXISTS caja_aperturas (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  caja_id                   BIGINT NOT NULL,
  cobrador_id               INT NOT NULL,
  fecha_operacion           DATE NOT NULL,
  fecha_hora_apertura       DATETIME NOT NULL,
  saldo_inicial             DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_actual              DECIMAL(14,2) NOT NULL DEFAULT 0,
  estado                    ENUM('ABIERTA','CERRADA','ANULADA') NOT NULL DEFAULT 'ABIERTA',
  ip_apertura               VARCHAR(45) NULL,
  gps_apertura_latitud      DECIMAL(10,8) NULL,
  gps_apertura_longitud     DECIMAL(11,8) NULL,
  observaciones             TEXT NULL,
  legacy_arqueo_caja_id     BIGINT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  KEY idx_apertura_empresa_fecha (empresa_id, fecha_operacion),
  KEY idx_apertura_caja_estado (caja_id, estado),
  KEY idx_apertura_cobrador_fecha (cobrador_id, fecha_operacion),
  CONSTRAINT fk_apertura_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_apertura_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_apertura_cobrador FOREIGN KEY (cobrador_id) REFERENCES usuarios(id),
  CONSTRAINT fk_apertura_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_apertura_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Aperturas diarias de caja por cobrador';

-- ============================================================
-- 6. Numeradores por punto de expedicion
--    Reemplaza el uso de MAX()+1 y desacopla la secuencia de las tablas
--    facturas_timbrado/facturas.
-- ============================================================

CREATE TABLE IF NOT EXISTS numeradores (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  timbrado_id               BIGINT NOT NULL,
  establecimiento_id        BIGINT NOT NULL,
  punto_expedicion_id       BIGINT NOT NULL,
  tipo_documento            ENUM('RECIBO_COBRANZA','FACTURA_CONTADO','FACTURA_CREDITO','NOTA_CREDITO') NOT NULL DEFAULT 'RECIBO_COBRANZA',
  serie                     VARCHAR(20) NOT NULL DEFAULT 'A1',
  numero_desde              BIGINT NOT NULL DEFAULT 1,
  numero_hasta              BIGINT NOT NULL DEFAULT 9999999,
  ultimo_numero_asignado    BIGINT NOT NULL DEFAULT 0,
  activo                    TINYINT(1) NOT NULL DEFAULT 1,
  bloqueado                 TINYINT(1) NOT NULL DEFAULT 0,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_numerador_scope (empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id, tipo_documento, serie),
  KEY idx_numerador_punto_activo (punto_expedicion_id, activo, bloqueado),
  CONSTRAINT fk_numerador_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_numerador_timbrado FOREIGN KEY (timbrado_id) REFERENCES timbrados(id),
  CONSTRAINT fk_numerador_establecimiento FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id),
  CONSTRAINT fk_numerador_punto FOREIGN KEY (punto_expedicion_id) REFERENCES puntos_expedicion(id),
  CONSTRAINT fk_numerador_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_numerador_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Secuencias fiscales por punto de expedicion y tipo de documento';

-- ============================================================
-- 7. Recibos de cobranza
-- ============================================================

CREATE TABLE IF NOT EXISTS recibos (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  timbrado_id               BIGINT NOT NULL,
  establecimiento_id        BIGINT NOT NULL,
  punto_expedicion_id       BIGINT NOT NULL,
  caja_id                   BIGINT NOT NULL,
  caja_apertura_id          BIGINT NOT NULL,
  cobrador_id               INT NOT NULL,
  cliente_id                INT NOT NULL,
  numerador_id              BIGINT NOT NULL,
  visita_cobro_id           BIGINT NULL,
  factura_legacy_id         INT NULL,
  numero_secuencia          BIGINT NOT NULL,
  numero_recibo             VARCHAR(25) NOT NULL,
  estado                    ENUM('EMITIDO','ANULADO','REVERSADO','CONTINGENCIA') NOT NULL DEFAULT 'EMITIDO',
  fecha_emision             DATETIME NOT NULL,
  moneda                    CHAR(3) NOT NULL DEFAULT 'PYG',
  total_recibo              DECIMAL(14,2) NOT NULL DEFAULT 0,
  observaciones             TEXT NULL,
  motivo_anulacion          VARCHAR(255) NULL,
  fecha_anulacion           DATETIME NULL,
  tipo_emision              ENUM('IMPRESO','ELECTRONICO') NOT NULL DEFAULT 'IMPRESO',
  cdc                       VARCHAR(44) NULL,
  xml_firmado               LONGTEXT NULL,
  hash_documento            VARCHAR(128) NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recibo_numero (empresa_id, numero_recibo),
  UNIQUE KEY uq_recibo_cdc (cdc),
  UNIQUE KEY uq_recibo_visita (visita_cobro_id),
  KEY idx_recibo_empresa_fecha (empresa_id, fecha_emision),
  KEY idx_recibo_caja_apertura (caja_apertura_id),
  KEY idx_recibo_cliente (cliente_id),
  CONSTRAINT fk_recibo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_recibo_timbrado FOREIGN KEY (timbrado_id) REFERENCES timbrados(id),
  CONSTRAINT fk_recibo_establecimiento FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id),
  CONSTRAINT fk_recibo_punto FOREIGN KEY (punto_expedicion_id) REFERENCES puntos_expedicion(id),
  CONSTRAINT fk_recibo_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_recibo_apertura FOREIGN KEY (caja_apertura_id) REFERENCES caja_aperturas(id),
  CONSTRAINT fk_recibo_cobrador FOREIGN KEY (cobrador_id) REFERENCES usuarios(id),
  CONSTRAINT fk_recibo_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_recibo_numerador FOREIGN KEY (numerador_id) REFERENCES numeradores(id),
  CONSTRAINT fk_recibo_visita FOREIGN KEY (visita_cobro_id) REFERENCES visitas_cobro(id),
  CONSTRAINT fk_recibo_factura_legacy FOREIGN KEY (factura_legacy_id) REFERENCES facturas(id),
  CONSTRAINT fk_recibo_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_recibo_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Recibos fiscales y operativos emitidos por cobranzas';

CREATE TABLE IF NOT EXISTS recibo_detalles (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  recibo_id                 BIGINT NOT NULL,
  cuota_id                  INT NULL,
  credito_id                INT NULL,
  concepto                  VARCHAR(255) NOT NULL,
  cantidad                  DECIMAL(12,2) NOT NULL DEFAULT 1,
  monto_unitario            DECIMAL(14,2) NOT NULL DEFAULT 0,
  monto_total               DECIMAL(14,2) NOT NULL DEFAULT 0,
  orden_detalle             INT NOT NULL DEFAULT 1,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  KEY idx_recibo_detalle_recibo (recibo_id, orden_detalle),
  KEY idx_recibo_detalle_cuota (cuota_id),
  CONSTRAINT fk_recibo_detalle_recibo FOREIGN KEY (recibo_id) REFERENCES recibos(id),
  CONSTRAINT fk_recibo_detalle_cuota FOREIGN KEY (cuota_id) REFERENCES cuotas(id),
  CONSTRAINT fk_recibo_detalle_credito FOREIGN KEY (credito_id) REFERENCES creditos(id),
  CONSTRAINT fk_recibo_detalle_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_recibo_detalle_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Detalle de conceptos cobrados por recibo';

-- ============================================================
-- 8. Movimientos de caja
--    Nunca se modifica el saldo manualmente. Todo impacto se registra aqui.
-- ============================================================

CREATE TABLE IF NOT EXISTS caja_movimientos (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  caja_id                   BIGINT NOT NULL,
  caja_apertura_id          BIGINT NOT NULL,
  recibo_id                 BIGINT NULL,
  arqueo_id                 BIGINT NULL,
  cierre_caja_id            BIGINT NULL,
  tipo_movimiento           ENUM('INGRESO','COBRANZA','EGRESO','AJUSTE','ANULACION','CIERRE') NOT NULL,
  sentido_saldo             ENUM('SUMA','RESTA') NOT NULL,
  importe                   DECIMAL(14,2) NOT NULL,
  saldo_anterior            DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_posterior           DECIMAL(14,2) NOT NULL DEFAULT 0,
  descripcion               VARCHAR(255) NOT NULL,
  referencia_tabla          VARCHAR(100) NULL,
  referencia_id             BIGINT NULL,
  fecha_hora_movimiento     DATETIME NOT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  KEY idx_mov_caja_apertura_fecha (caja_apertura_id, fecha_hora_movimiento),
  KEY idx_mov_tipo_fecha (tipo_movimiento, fecha_hora_movimiento),
  KEY idx_mov_recibo (recibo_id),
  CONSTRAINT fk_mov_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_mov_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_mov_apertura FOREIGN KEY (caja_apertura_id) REFERENCES caja_aperturas(id),
  CONSTRAINT fk_mov_recibo FOREIGN KEY (recibo_id) REFERENCES recibos(id),
  CONSTRAINT fk_mov_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_mov_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Libro mayor de caja con trazabilidad de saldos';

-- ============================================================
-- 9. Arqueos historicos
-- ============================================================

CREATE TABLE IF NOT EXISTS arqueos (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  caja_id                   BIGINT NOT NULL,
  caja_apertura_id          BIGINT NOT NULL,
  cobrador_id               INT NOT NULL,
  fecha_hora_arqueo         DATETIME NOT NULL,
  saldo_sistema             DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_declarado           DECIMAL(14,2) NOT NULL DEFAULT 0,
  diferencia                DECIMAL(14,2) NOT NULL DEFAULT 0,
  observaciones             TEXT NULL,
  ip_origen                 VARCHAR(45) NULL,
  gps_latitud               DECIMAL(10,8) NULL,
  gps_longitud              DECIMAL(11,8) NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  KEY idx_arqueo_apertura_fecha (caja_apertura_id, fecha_hora_arqueo),
  KEY idx_arqueo_cobrador_fecha (cobrador_id, fecha_hora_arqueo),
  CONSTRAINT fk_arqueo_empresa_new FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_arqueo_caja_new FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_arqueo_apertura_new FOREIGN KEY (caja_apertura_id) REFERENCES caja_aperturas(id),
  CONSTRAINT fk_arqueo_cobrador_new FOREIGN KEY (cobrador_id) REFERENCES usuarios(id),
  CONSTRAINT fk_arqueo_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_arqueo_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Arqueos historicos no eliminables';

-- ============================================================
-- 10. Cierres de caja
-- ============================================================

CREATE TABLE IF NOT EXISTS cierres_caja (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  caja_id                   BIGINT NOT NULL,
  caja_apertura_id          BIGINT NOT NULL,
  cobrador_id               INT NOT NULL,
  fecha_hora_cierre         DATETIME NOT NULL,
  saldo_inicial             DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_ingresos            DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_egresos             DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_esperado            DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_declarado           DECIMAL(14,2) NOT NULL DEFAULT 0,
  diferencia                DECIMAL(14,2) NOT NULL DEFAULT 0,
  observaciones             TEXT NULL,
  ip_cierre                 VARCHAR(45) NULL,
  gps_cierre_latitud        DECIMAL(10,8) NULL,
  gps_cierre_longitud       DECIMAL(11,8) NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cierre_apertura (caja_apertura_id),
  KEY idx_cierre_caja_fecha (caja_id, fecha_hora_cierre),
  CONSTRAINT fk_cierre_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_cierre_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_cierre_apertura FOREIGN KEY (caja_apertura_id) REFERENCES caja_aperturas(id),
  CONSTRAINT fk_cierre_cobrador FOREIGN KEY (cobrador_id) REFERENCES usuarios(id),
  CONSTRAINT fk_cierre_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_cierre_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Resultado consolidado del cierre de una apertura';

-- ============================================================
-- 11. Auditoria generica
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NULL,
  usuario_id                INT NULL,
  fecha_hora_evento         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_origen                 VARCHAR(45) NULL,
  accion                    ENUM('INSERT','UPDATE','DELETE','ANULAR','APERTURAR','CERRAR','LOGIN','LOGOUT','ASIGNAR','DESASIGNAR','EMITIR') NOT NULL,
  tabla_afectada            VARCHAR(100) NOT NULL,
  registro_id               VARCHAR(100) NOT NULL,
  datos_antes               JSON NULL,
  datos_despues             JSON NULL,
  observaciones             TEXT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                BIGINT NULL,
  updated_by                BIGINT NULL,
  PRIMARY KEY (id),
  KEY idx_auditoria_empresa_fecha (empresa_id, fecha_hora_evento),
  KEY idx_auditoria_tabla_registro (tabla_afectada, registro_id),
  KEY idx_auditoria_usuario_fecha (usuario_id, fecha_hora_evento),
  CONSTRAINT fk_auditoria_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_auditoria_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_auditoria_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Bitacora de auditoria transversal del modulo';

-- ============================================================
-- 12. Compatibilidad con tablas legacy actuales
-- ============================================================

ALTER TABLE visitas_cobro
  ADD COLUMN IF NOT EXISTS recibo_id BIGINT NULL,
  ADD KEY IF NOT EXISTS idx_visitas_recibo (recibo_id),
  ADD CONSTRAINT fk_visita_recibo FOREIGN KEY (recibo_id) REFERENCES recibos(id);

ALTER TABLE arqueos_caja
  ADD COLUMN IF NOT EXISTS caja_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS caja_apertura_id BIGINT NULL,
  ADD KEY IF NOT EXISTS idx_arqueo_caja_new_ref (caja_id, caja_apertura_id),
  ADD CONSTRAINT fk_arqueos_caja_caja_new FOREIGN KEY (caja_id) REFERENCES cajas(id),
  ADD CONSTRAINT fk_arqueos_caja_apertura_new FOREIGN KEY (caja_apertura_id) REFERENCES caja_aperturas(id);

-- ============================================================
-- 13. Backfill inicial sin destruir historico
-- ============================================================

INSERT INTO timbrados (
  empresa_id,
  numero_timbrado,
  fecha_inicio,
  fecha_fin,
  estado,
  observaciones,
  es_electronico,
  facturas_timbrado_legacy_id,
  created_at,
  updated_at
)
SELECT
  ft.empresa_id,
  ft.numero_timbrado,
  COALESCE(ft.fecha_inicio, CURRENT_DATE),
  COALESCE(ft.fecha_vencimiento, DATE_ADD(CURRENT_DATE, INTERVAL 1 YEAR)),
  CASE
    WHEN ft.activo = 1 AND (ft.fecha_vencimiento IS NULL OR ft.fecha_vencimiento >= CURRENT_DATE) THEN 'VIGENTE'
    WHEN ft.fecha_vencimiento IS NOT NULL AND ft.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO'
    ELSE 'INACTIVO'
  END,
  'Migrado desde facturas_timbrado',
  COALESCE(ft.es_electronica, 0),
  ft.id,
  COALESCE(ft.created_at, CURRENT_TIMESTAMP),
  COALESCE(ft.updated_at, CURRENT_TIMESTAMP)
FROM facturas_timbrado ft
LEFT JOIN timbrados t
  ON t.facturas_timbrado_legacy_id = ft.id
WHERE t.id IS NULL;

COMMIT;

-- ============================================================
-- Notas de implementacion
-- 1. Las restricciones de negocio "un solo timbrado vigente por empresa",
--    "un solo punto por caja activa" y "una sola apertura diaria activa por
--    cobrador" deben validarse con transacciones + SELECT ... FOR UPDATE en
--    servicios de dominio, no con MAX()+1 ni actualizaciones manuales.
-- 2. No eliminar tablas legacy hasta completar la migracion dual-write.
-- ============================================================