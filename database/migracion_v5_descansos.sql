-- ============================================================
-- cobrApp - Migración v5.0
-- Fecha: Mayo 2026
-- Descripción: Módulo de descansos para cobradores
--              tipos_descanso + descansos_cobrador
-- ============================================================

-- ============================================================
-- TABLA: tipos_descanso
-- Configurada por el supervisor para su empresa.
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_descanso (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  empresa_id      BIGINT        NOT NULL,
  nombre          VARCHAR(100)  NOT NULL COMMENT 'Ej: Almuerzo, Sanitario, Combustible',
  es_obligatorio  TINYINT(1)    DEFAULT 0 COMMENT '1 = el sistema puede activarlo auto',
  hora_inicio     TIME          NULL      COMMENT 'Desde cuándo puede activarse (ej: 11:00)',
  hora_fin_auto   TIME          NULL      COMMENT 'Se activa automáticamente a esta hora si no fue activado',
  activo          TINYINT(1)    DEFAULT 1,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_td_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  INDEX idx_td_empresa (empresa_id)
) COMMENT 'Tipos de descanso configurados por cada empresa';

-- ============================================================
-- TABLA: descansos_cobrador
-- Registro de cada descanso iniciado/finalizado por un cobrador.
-- ============================================================

CREATE TABLE IF NOT EXISTS descansos_cobrador (
  id                  BIGINT        NOT NULL AUTO_INCREMENT,
  tipo_descanso_id    BIGINT        NOT NULL,
  cobrador_id         BIGINT        NOT NULL,
  fecha               DATE          NOT NULL,
  hora_inicio_real    DATETIME      NOT NULL  COMMENT 'Cuando el cobrador o el sistema activó el descanso',
  hora_fin_real       DATETIME      NULL      COMMENT 'Cuando el cobrador reanudó; NULL = descanso activo',
  activado_auto       TINYINT(1)    DEFAULT 0 COMMENT '1 = activado por el cron del sistema',
  comentario          VARCHAR(255)  NULL,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_dc_tipo     FOREIGN KEY (tipo_descanso_id) REFERENCES tipos_descanso(id) ON DELETE CASCADE,
  CONSTRAINT fk_dc_cobrador FOREIGN KEY (cobrador_id)      REFERENCES usuarios(id)       ON DELETE CASCADE,
  INDEX idx_dc_cobrador_fecha (cobrador_id, fecha),
  INDEX idx_dc_tipo           (tipo_descanso_id)
) COMMENT 'Historial de descansos tomados por los cobradores';
