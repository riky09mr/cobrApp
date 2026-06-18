-- ═══════════════════════════════════════════════════════════════
-- Migración v11 – Arqueos de caja y medios de pago
-- ═══════════════════════════════════════════════════════════════

-- 1. Catálogo de medios de pago por empresa
--    El supervisor define qué medios acepta su empresa.
--    requiere_comprobante = TRUE → nro_comprobante es obligatorio al cobrar.
CREATE TABLE IF NOT EXISTS medios_pago (
    id                   INT          AUTO_INCREMENT PRIMARY KEY,
    empresa_id           INT          NOT NULL,
    nombre               VARCHAR(80)  NOT NULL,
    requiere_comprobante BOOLEAN      DEFAULT FALSE,
    activo               BOOLEAN      DEFAULT TRUE,
    created_at           DATETIME     DEFAULT NOW(),
    CONSTRAINT fk_mp_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- 2. Caja diaria del cobrador
--    Un cobrador solo puede tener UNA caja con estado = 'ABIERTO' a la vez
--    (restricción aplicada a nivel de aplicación).
CREATE TABLE IF NOT EXISTS arqueos_caja (
    id              BIGINT        AUTO_INCREMENT PRIMARY KEY,
    empresa_id      INT           NOT NULL,
    cobrador_id     INT           NOT NULL,
    fecha_apertura  DATETIME      NOT NULL,
    fecha_cierre    DATETIME      NULL,
    saldo_inicial   DECIMAL(12,2) DEFAULT 0,
    saldo_esperado  DECIMAL(12,2) DEFAULT 0,   -- calculado al cerrar
    saldo_contado   DECIMAL(12,2) DEFAULT 0,   -- declarado por cobrador
    diferencia      DECIMAL(12,2) DEFAULT 0,   -- saldo_contado - saldo_esperado
    observacion     TEXT          NULL,
    estado          ENUM('ABIERTO','CERRADO') DEFAULT 'ABIERTO',
    created_at      DATETIME      DEFAULT NOW(),
    CONSTRAINT fk_arqueo_empresa  FOREIGN KEY (empresa_id)  REFERENCES empresas(id),
    CONSTRAINT fk_arqueo_cobrador FOREIGN KEY (cobrador_id) REFERENCES usuarios(id)
);

-- 3. Gastos del cobrador durante la jornada (combustible, etc.)
--    Estos egresos reducen el saldo_esperado en efectivo.
CREATE TABLE IF NOT EXISTS movimientos_caja (
    id          BIGINT        AUTO_INCREMENT PRIMARY KEY,
    arqueo_id   BIGINT        NOT NULL,
    concepto    VARCHAR(200)  NOT NULL,
    monto       DECIMAL(12,2) NOT NULL,
    fecha_hora  DATETIME      DEFAULT NOW(),
    CONSTRAINT fk_mov_arqueo FOREIGN KEY (arqueo_id) REFERENCES arqueos_caja(id)
);

-- 4. Rendición: supervisor confirma recepción del dinero
--    Un arqueo cerrado tiene exactamente una rendición.
CREATE TABLE IF NOT EXISTS rendiciones (
    id               BIGINT        AUTO_INCREMENT PRIMARY KEY,
    arqueo_id        BIGINT        NOT NULL,
    supervisor_id    INT           NOT NULL,
    monto_recibido   DECIMAL(12,2) NOT NULL,
    fecha_rendicion  DATETIME      DEFAULT NOW(),
    estado           ENUM('CUADRADO','SOBRANTE','FALTANTE') NOT NULL,
    observacion      TEXT          NULL,
    CONSTRAINT fk_rend_arqueo     FOREIGN KEY (arqueo_id)     REFERENCES arqueos_caja(id),
    CONSTRAINT fk_rend_supervisor FOREIGN KEY (supervisor_id) REFERENCES usuarios(id)
);

-- 5. Extender visitas_cobro con las nuevas columnas
--    - arqueo_id      : referencia a la caja abierta del cobrador al momento del cobro
--    - medio_pago_id  : FK al catálogo de medios de pago (reemplaza el string libre)
--    - nro_comprobante: número de transferencia, cheque, etc. (nullable)
--    El campo medio_pago (VARCHAR) se mantiene por compatibilidad con registros anteriores.
ALTER TABLE visitas_cobro
    ADD COLUMN arqueo_id       BIGINT       NULL,
    ADD COLUMN medio_pago_id   INT          NULL,
    ADD COLUMN nro_comprobante VARCHAR(100) NULL,
    ADD CONSTRAINT fk_vc_arqueo     FOREIGN KEY (arqueo_id)     REFERENCES arqueos_caja(id),
    ADD CONSTRAINT fk_vc_medio_pago FOREIGN KEY (medio_pago_id) REFERENCES medios_pago(id);
