-- ============================================================
-- cobrApp - Migracion v24: Nota de Credito para Recibos
-- Fecha: Agosto 2026
-- ============================================================
--
-- Cambios:
--   facturas_nota_credito  nueva tabla para NC por recibo
--                          (factura_id NULL, recibo_id FK)
--
-- Motivo: cuando el cliente paga de mas (transferencia/POS) el
--   recibo se emite por el monto de la cuota. El sobrepago se
--   detecta manualmente y se genera una NC que referencia el
--   recibo (no una factura). Por eso factura_id es NULL.
-- ============================================================

-- ── 1. Tabla: facturas_nota_credito ─────────────────────────
-- Documento fiscal emitido para anular total o parcialmente
-- una factura o un recibo. Requiere su propio timbrado.
-- factura_id: NULL si la NC es por recibo (sobrepago).
-- recibo_id:  FK a recibos si la NC es por sobrepago.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_nota_credito (
  id                INT           NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT        NOT NULL,
  timbrado_id       INT           NOT NULL
    COMMENT 'FK a facturas_timbrado — timbrado especifico para NC',
  factura_id        INT           NULL
    COMMENT 'Factura original que esta NC anula — NULL si es por recibo',
  recibo_id         BIGINT        NULL
    COMMENT 'FK recibos.id — recibo que genero la NC por sobrepago',

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
  monto_sobrepago   DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Excedente pagado sobre el total del recibo',
  saldo_a_favor     DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Saldo a favor del cliente generado por el sobrepago',
  monto_iva_10      DECIMAL(15,0) NOT NULL DEFAULT 0,
  monto_iva_5       DECIMAL(15,0) NOT NULL DEFAULT 0,
  monto_exento      DECIMAL(15,0) NOT NULL DEFAULT 0,

  -- Motivo obligatorio DNIT
  motivo            VARCHAR(255)  NOT NULL DEFAULT ''
    COMMENT 'Descripcion del motivo de la anulacion (requerida por DNIT)',

  fecha_emision     DATETIME      NOT NULL DEFAULT NOW(),
  created_at        DATETIME      DEFAULT NOW(),

  PRIMARY KEY (id),

  UNIQUE KEY uq_nc_cdc     (cdc_nc),

  CONSTRAINT fk_nc_empresa  FOREIGN KEY (empresa_id)
    REFERENCES empresas(id)           ON DELETE CASCADE,
  CONSTRAINT fk_nc_timbrado FOREIGN KEY (timbrado_id)
    REFERENCES facturas_timbrado(id),
  CONSTRAINT fk_nc_factura  FOREIGN KEY (factura_id)
    REFERENCES facturas(id),
  CONSTRAINT fk_nc_recibo   FOREIGN KEY (recibo_id)
    REFERENCES recibos(id),

  INDEX idx_nc_empresa (empresa_id),
  INDEX idx_nc_factura (factura_id),
  INDEX idx_nc_recibo  (recibo_id)

) COMMENT 'Notas de Credito emitidas para anulacion de facturas o recibos (impresa o SIFEN)';

COMMIT;
