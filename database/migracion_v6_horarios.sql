-- ============================================================
-- cobrApp - Migración v6.0
-- Fecha: Mayo 2026
-- Descripción: Horarios de cobrador configurados por supervisor
--              + duración de descansos
-- ============================================================

-- ============================================================
-- 1. TABLA: horarios_cobrador
-- Horario semanal por cobrador. El supervisor define los días
-- y horarios en que el cobrador debe trabajar.
-- dia_semana: 0=Domingo, 1=Lunes, ..., 6=Sábado
-- ============================================================

CREATE TABLE IF NOT EXISTS horarios_cobrador (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  cobrador_id  BIGINT       NOT NULL,
  empresa_id   BIGINT       NOT NULL,
  dia_semana   TINYINT      NOT NULL COMMENT '0=Dom 1=Lun 2=Mar 3=Mie 4=Jue 5=Vie 6=Sab',
  hora_inicio  TIME         NOT NULL,
  hora_fin     TIME         NOT NULL,
  activo       TINYINT(1)   DEFAULT 1,
  created_by   BIGINT       NULL COMMENT 'Supervisor que creó el horario',
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_horario_dia (cobrador_id, dia_semana),
  CONSTRAINT fk_hc_cobrador  FOREIGN KEY (cobrador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_hc_empresa   FOREIGN KEY (empresa_id)  REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_hc_creado_by FOREIGN KEY (created_by)  REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_hc_empresa (empresa_id),
  INDEX idx_hc_cobrador (cobrador_id)
) COMMENT 'Horario laboral semanal de cada cobrador, configurado por el supervisor';

-- ============================================================
-- 2. TABLA: excepciones_horario
-- Fechas específicas en que el cobrador no trabaja (LIBRE)
-- o trabaja con horario distinto (HORARIO_ESPECIAL).
-- ============================================================

CREATE TABLE IF NOT EXISTS excepciones_horario (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  cobrador_id  BIGINT       NOT NULL,
  empresa_id   BIGINT       NOT NULL,
  fecha        DATE         NOT NULL COMMENT 'Fecha de la excepción',
  tipo         ENUM('LIBRE','HORARIO_ESPECIAL') NOT NULL DEFAULT 'LIBRE',
  hora_inicio  TIME         NULL COMMENT 'Solo para HORARIO_ESPECIAL',
  hora_fin     TIME         NULL COMMENT 'Solo para HORARIO_ESPECIAL',
  motivo       VARCHAR(255) NULL,
  created_by   BIGINT       NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_excepcion_fecha (cobrador_id, fecha),
  CONSTRAINT fk_exc_cobrador  FOREIGN KEY (cobrador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_exc_empresa   FOREIGN KEY (empresa_id)  REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_exc_creado_by FOREIGN KEY (created_by)  REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_exc_cobrador_fecha (cobrador_id, fecha)
) COMMENT 'Excepciones al horario habitual (días libres o con horario especial)';

-- ============================================================
-- 3. TABLA: descansos_cobrador
--    Agregar columna duracion_minutos (calculada al finalizar)
-- ============================================================

ALTER TABLE descansos_cobrador
  ADD COLUMN duracion_minutos INT NULL
    COMMENT 'Duración en minutos del descanso (calculada al finalizar)'
    AFTER hora_fin_real;
