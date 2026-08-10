-- ============================================================
-- cobrApp - Migración v19.0
-- Fecha: 2026
-- Descripción: Lotes de importación para que el supervisor pueda
--              eliminar un lote cargado por error (mientras no
--              haya sido asignado a un cobrador).
-- ============================================================

-- ============================================================
-- 1. TABLA: lotes_importacion
--    Registra cada carga masiva de clientes/créditos desde Excel.
-- ============================================================

CREATE TABLE IF NOT EXISTS lotes_importacion (
  id                 BIGINT       NOT NULL AUTO_INCREMENT,
  empresa_id         BIGINT       NOT NULL COMMENT 'FK empresas.id',
  usuario_id         BIGINT       NOT NULL COMMENT 'FK usuarios.id (quién importó)',
  nombre_archivo     VARCHAR(255) NULL COMMENT 'Nombre original del archivo Excel',
  total_filas        INT          NOT NULL DEFAULT 0,
  clientes_nuevos    INT          NOT NULL DEFAULT 0,
  clientes_actualizados INT       NOT NULL DEFAULT 0,
  creditos_creados   INT          NOT NULL DEFAULT 0,
  errores            INT          NOT NULL DEFAULT 0,
  fecha_importacion  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado             ENUM('ACTIVO','ELIMINADO') NOT NULL DEFAULT 'ACTIVO',

  PRIMARY KEY (id),
  KEY idx_lote_empresa (empresa_id),
  KEY idx_lote_usuario (usuario_id),
  KEY idx_lote_fecha (fecha_importacion),
  CONSTRAINT fk_lote_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_lote_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) COMMENT='Lotes de importación masiva de clientes y créditos';

-- ============================================================
-- 2. Columna id_lote en creditos
--    Permite saber a qué lote pertenece cada crédito.
-- ============================================================

ALTER TABLE creditos
  ADD COLUMN id_lote BIGINT NULL
    COMMENT 'Lote de importación al que pertenece este crédito'
    AFTER estado;

ALTER TABLE creditos
  ADD CONSTRAINT fk_credito_lote
    FOREIGN KEY (id_lote) REFERENCES lotes_importacion(id)
    ON DELETE SET NULL;

-- ============================================================
-- 3. Columna id_lote en clientes_empresas
--    Permite saber qué clientes fueron creados por este lote
--    (para limpiar clientes huérfanos al eliminar el lote).
-- ============================================================

ALTER TABLE clientes_empresas
  ADD COLUMN id_lote BIGINT NULL
    COMMENT 'Lote de importación que creó/actualizó esta relación cliente-empresa'
    AFTER longitud;

ALTER TABLE clientes_empresas
  ADD CONSTRAINT fk_ce_lote
    FOREIGN KEY (id_lote) REFERENCES lotes_importacion(id)
    ON DELETE SET NULL;
