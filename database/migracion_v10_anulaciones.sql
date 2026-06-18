-- ============================================================
-- cobrApp - Migracion v10: Sistema de Anulacion de Facturas
-- Fecha: Mayo 2026
-- Normativa: DNIT Paraguay - Nota de Credito y Evento de Anulacion
-- ============================================================
--
-- Cambios:
--   facturas            +estado, +fecha_anulacion, +motivo_anulacion
--                        (columna "anulada" queda deprecada, se migran
--                        los datos y se puede eliminar en v11)
--   visitas_cobro       +anulada  (excluir del arqueo diario)
--   facturas_nota_credito  nueva tabla para NC con su propio timbrado
--
-- Reglas de negocio implementadas en el backend:
--   Evento de Anulacion (estado=2):
--     - Solo dentro de las 48 h (e-DE) o antes del cierre del dia (impresa)
--     - Revierte cuotas.estado = 'PENDIENTE', saldo_cuota y fecha_pago
--     - Marca visitas_cobro.anulada = 1 (excluye del arqueo)
--   Nota de Credito (estado=3):
--     - Genera un documento fiscal propio con su timbrado
--     - Revierte cuotas.estado = 'PENDIENTE'
--     - La visita_cobro permanece (el cobro historicamente ocurrio)
-- ============================================================


-- ── 1. Columnas de estado en facturas ─────────────────────────
-- estado: 1=Activa  2=Anulada por Evento SIFEN  3=Anulada por NC
-- anulada se mantiene por compatibilidad; se sincroniza abajo.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE facturas
  ADD COLUMN estado           TINYINT(1)   NOT NULL DEFAULT 1
    COMMENT '1=Activa | 2=Anulada por Evento SIFEN (48 h) | 3=Anulada por Nota de Credito'
    AFTER anulada,
  ADD COLUMN fecha_anulacion  DATETIME     NULL
    COMMENT 'Fecha y hora en que se anulo el documento'
    AFTER estado,
  ADD COLUMN motivo_anulacion VARCHAR(255) NULL
    COMMENT 'Motivo de anulacion exigido por la DNIT'
    AFTER fecha_anulacion;

-- Migrar datos previos: anulada=1 -> estado=2
UPDATE facturas SET estado = 2 WHERE anulada = 1;

-- Indice para filtrar rapidamente facturas activas por empresa
ALTER TABLE facturas
  ADD INDEX idx_f_empresa_estado (empresa_id, estado);


-- ── 2. Flag de anulacion en visitas_cobro ─────────────────────
-- Cuando una factura se anula por Evento (dentro del mismo dia),
-- la visita se marca como anulada para excluirla del arqueo/totales.
-- Para anulaciones por NC (dias posteriores) la visita NO se anula
-- porque el cobro historicamente ocurrio.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE visitas_cobro
  ADD COLUMN anulada TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = cobro revertido por Evento de Anulacion (excluir del arqueo diario)'
    AFTER resultado;

ALTER TABLE visitas_cobro
  ADD INDEX idx_vc_anulada (anulada);


-- ── 3. Tabla: facturas_nota_credito ───────────────────────────
-- Documento fiscal emitido para anular total o parcialmente
-- una factura entregada al cliente. Requiere su propio timbrado
-- (la DNIT autoriza timbrados separados para NC).
-- Se enlaza a la factura original y al timbrado de la NC.
--
-- Notas de Credito IMPRESAS:  cdc_nc = NULL
-- Notas de Credito SIFEN:     cdc_nc = 44 digitos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_nota_credito (
  id                INT           NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT        NOT NULL,
  timbrado_id       INT           NOT NULL
    COMMENT 'FK a facturas_timbrado — timbrado especifico para NC',
  factura_id        INT           NOT NULL
    COMMENT 'Factura original que esta NC anula',

  numero_secuencial INT           NOT NULL
    COMMENT 'Numero secuencial asignado por el timbrado de la NC',
  numero_nc         VARCHAR(15)   NOT NULL
    COMMENT 'Formato 001-001-0000001 (establecimiento-punto-secuencial)',

  -- Solo para NC Electronica SIFEN
  cdc_nc            VARCHAR(44)   NULL
    COMMENT 'Codigo de Control 44 digitos — NULL si es impresa',
  estado_dnit       VARCHAR(20)   NULL
    COMMENT 'PENDIENTE | APROBADO | RECHAZADO — NULL si es impresa',

  -- Montos
  monto_anulado     DECIMAL(15,0) NOT NULL DEFAULT 0
    COMMENT 'Monto total que revierte (puede ser parcial en creditos a cuenta)',
  monto_iva_10      DECIMAL(15,0) NOT NULL DEFAULT 0,
  monto_iva_5       DECIMAL(15,0) NOT NULL DEFAULT 0,
  monto_exento      DECIMAL(15,0) NOT NULL DEFAULT 0,

  -- Motivo obligatorio DNIT
  motivo            VARCHAR(255)  NOT NULL DEFAULT ''
    COMMENT 'Descripcion del motivo de la anulacion (requerida por DNIT)',

  fecha_emision     DATETIME      NOT NULL DEFAULT NOW(),
  created_at        DATETIME      DEFAULT NOW(),

  PRIMARY KEY (id),

  -- Una sola NC de anulacion total por factura.
  -- Si la empresa emite NC parciales sobre la misma factura,
  -- quitar esta restriccion y controlar el saldo por suma de monto_anulado.
  UNIQUE KEY uq_nc_factura (factura_id),

  UNIQUE KEY uq_nc_cdc     (cdc_nc),

  CONSTRAINT fk_nc_empresa  FOREIGN KEY (empresa_id)
    REFERENCES empresas(id)           ON DELETE CASCADE,
  CONSTRAINT fk_nc_timbrado FOREIGN KEY (timbrado_id)
    REFERENCES facturas_timbrado(id),
  CONSTRAINT fk_nc_factura  FOREIGN KEY (factura_id)
    REFERENCES facturas(id),

  INDEX idx_nc_empresa (empresa_id),
  INDEX idx_nc_factura (factura_id)

) COMMENT 'Notas de Credito emitidas para anulacion de facturas (impresa o SIFEN)';


-- ── 4. Vista: arqueo_diario_cobros ────────────────────────────
-- Reemplaza los SELECT directos sobre visitas_cobro en el dashboard.
-- Excluye automaticamente las visitas anuladas por Evento.
-- Uso: SELECT * FROM arqueo_diario_cobros WHERE cobrador_id = ?
--      AND DATE(fecha_hora) = CURDATE()
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW arqueo_diario_cobros AS
SELECT
  vc.id,
  vc.cobrador_id,
  vc.asignacion_id,
  vc.resultado,
  vc.monto_cobrado,
  vc.medio_pago,
  vc.fecha_hora,
  vc.anulada
FROM visitas_cobro vc
WHERE vc.resultado = 'cobrado'
  AND vc.anulada   = 0;