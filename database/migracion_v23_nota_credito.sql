-- ============================================================
-- cobrApp - Migracion v23: Nota de Credito y Anulacion de Recibos
-- Fecha: Agosto 2026
-- Normativa: DNIT Paraguay - Nota de Credito y Evento de Anulacion
-- ============================================================
--
-- Cambios:
--   recibos             +nota_credito_id, +aplico_nota_credito,
--                       +monto_sobrepago, +saldo_a_favor
--   saldos_a_favor      nueva tabla para saldos a favor del cliente
--
-- Reglas de negocio:
--   Sobrepago: cuando el cliente paga mas del saldo de la cuota,
--     el excedente se registra como saldo a favor del cliente.
--   Nota de Credito: se genera un documento fiscal NC por el
--     excedente cuando el medio de pago no es efectivo.
--   Anulacion manual: el recibo se anula, la cuota vuelve a
--     PENDIENTE con su saldo original, y se revierte la caja.
-- ============================================================

-- ── 1. Campos en recibos para nota de credito ────────────────
ALTER TABLE recibos
  ADD COLUMN nota_credito_id   BIGINT       NULL
    COMMENT 'FK facturas_nota_credito.id — NC generada por sobrepago'
    AFTER factura_legacy_id,
  ADD COLUMN aplico_nota_credito TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = se aplico nota de credito a este recibo'
    AFTER nota_credito_id,
  ADD COLUMN monto_sobrepago   DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Excedente pagado sobre el saldo de la cuota'
    AFTER aplico_nota_credito,
  ADD COLUMN saldo_a_favor     DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Saldo a favor del cliente generado por el sobrepago'
    AFTER monto_sobrepago;

-- ── 2. Tabla: saldos_a_favor ─────────────────────────────────
-- Registra los saldos a favor generados por sobrepagos.
-- estado: DISPONIBLE | APLICADO | ANULADO
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saldos_a_favor (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT       NOT NULL,
  cliente_id        INT          NOT NULL,
  recibo_id         BIGINT       NULL
    COMMENT 'Recibo que genero el saldo a favor',
  monto             DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  estado            ENUM('DISPONIBLE','APLICADO','ANULADO') NOT NULL DEFAULT 'DISPONIBLE',
  fecha_creacion    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_aplicacion  DATETIME     NULL,
  created_by        BIGINT       NULL,
  updated_by        BIGINT       NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saf_cliente_estado (cliente_id, estado),
  KEY idx_saf_recibo (recibo_id),
  CONSTRAINT fk_saf_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_saf_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_saf_recibo  FOREIGN KEY (recibo_id)  REFERENCES recibos(id),
  CONSTRAINT fk_saf_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_saf_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Saldos a favor del cliente generados por sobrepagos';

-- ── 3. Indice para buscar recibos anulados ───────────────────
ALTER TABLE recibos
  ADD INDEX idx_recibo_estado_anulacion (estado, fecha_anulacion);

COMMIT;
