-- ============================================================
-- cobrApp - Migracion v13: Configuracion de intereses por empresa
-- Fecha: Julio 2026
-- Objetivo:
--   - Permitir que cada empresa configure de forma independiente
--     si genera intereses por mora, cuantos dias de luz (gracia)
--     otorga, el porcentaje diario de interes y si los domingos
--     y feriados cuentan dentro del calculo.
--   - Tabla de feriados locales por empresa (seed Paraguay).
--   - Nuevos campos en cuotas para acumular interes y dias de
--     retraso efectivos calculados.
-- ============================================================

START TRANSACTION;

-- ============================================================
-- 1. Configuracion de intereses por empresa
--    Una sola fila por empresa (PK = empresa_id).
--    porcentaje_interes_diario: ej. 0.5000 = 0,50% por dia.
--    dias_gracia: dias de luz antes de empezar a generar interes.
--    contar_domingos / contar_feriados: definen si esos dias
--    forman parte del conteo de dias de retraso efectivos.
-- ============================================================

CREATE TABLE IF NOT EXISTS empresas_intereses_config (
  empresa_id                INT NOT NULL,
  generar_interes           TINYINT(1) NOT NULL DEFAULT 0,
  dias_gracia               INT NOT NULL DEFAULT 0,
  porcentaje_interes_diario DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
  contar_domingos           TINYINT(1) NOT NULL DEFAULT 0,
  contar_feriados           TINYINT(1) NOT NULL DEFAULT 0,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (empresa_id),
  CONSTRAINT fk_interes_config_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_interes_config_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_interes_config_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Configuracion de dias de luz e intereses por empresa';

-- ============================================================
-- 2. Feriados locales por empresa
--    Fechas que no cuentan como dias de retraso cuando
--    contar_feriados = 0. Incluyen feriados nacionales de
--    Paraguay y cualquier feriado particular de la empresa.
-- ============================================================

CREATE TABLE IF NOT EXISTS empresas_feriados (
  id                        BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id                INT NOT NULL,
  fecha                     DATE NOT NULL,
  descripcion               VARCHAR(120) NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME NULL,
  created_by                INT NULL,
  updated_by                INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feriado_empresa_fecha (empresa_id, fecha),
  KEY idx_feriado_empresa (empresa_id),
  KEY idx_feriado_empresa_fecha (empresa_id, fecha),
  CONSTRAINT fk_feriado_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_feriado_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_feriado_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id)
) COMMENT='Feriados locales por empresa';

-- ============================================================
-- 3. Backfill: crear config por defecto para cada empresa
--    Sin interes, 0 dias de luz (el usuario lo configura luego).
-- ============================================================

INSERT INTO empresas_intereses_config (empresa_id, created_at, updated_at)
SELECT id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM empresas
ON DUPLICATE KEY UPDATE empresa_id = empresa_id;

-- ============================================================
-- 4. Seed de feriados nacionales de Paraguay
--    Ley N 6631/2020. Los feriados moviles (Jueves y Viernes
--    Santo) se cargan con la fecha del ano 2026 como ejemplo:
--    deben actualizarse cada ano. Los demas son fechas fijas.
-- ============================================================

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-01-01', 'Año Nuevo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-04-02', 'Jueves Santo (movible)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-04-03', 'Viernes Santo (movible)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-05-01', 'Día de los Trabajadores', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-05-14', 'Independencia Nacional', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-05-15', 'Día de la Madres', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-06-12', 'Paz del Chaco', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-08-15', 'Fundación de Asunción', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-09-29', 'Victoria de Boquerón', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-12-08', 'Virgen de Caacupé', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, created_at, updated_at)
SELECT id, '2026-12-25', 'Navidad', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM empresas
ON DUPLICATE KEY UPDATE fecha = fecha;

-- ============================================================
-- 5. Campos nuevos en cuotas para el calculo de intereses
--    interes_acumulado: total de interes generado a la fecha de
--      corte (se reinicia al registrar el pago).
--    dias_retraso: dias efectivos de retraso usados para el
--      ultimo calculo (excluye gracia, domingos y feriados).
-- ============================================================

ALTER TABLE cuotas
  ADD COLUMN IF NOT EXISTS interes_acumulado DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS dias_retraso INT NOT NULL DEFAULT 0;

COMMIT;

-- ============================================================
-- Notas de implementacion
-- 1. El calculo de intereses se realiza en servicios de dominio:
--      dias_efectivos = dias habiles entre (fecha_vencimiento + dias_gracia)
--                        y la fecha de corte, excluyendo domingos si
--                        contar_domingos = 0 y feriados si contar_feriados = 0.
--      interes = saldo_cuota * (porcentaje_interes_diario / 100) * dias_efectivos.
-- 2. Los feriados moviles (Jueves y Viernes Santo) deben cargarse
--    cada ano con la fecha correspondiente del calendario liturgico.
-- 3. El recalculo masivo se hace via endpoint /recalcular con
--    transaccion + UPDATE por lote, sin tocar cuotas pagadas.
-- ============================================================
