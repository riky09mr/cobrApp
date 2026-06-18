-- ============================================================
-- cobrApp - Migración v4.0
-- Fecha: Mayo 2026
-- Descripción: Tablas para el módulo del cobrador móvil
--              Fase 1: visitas y cobros en campo
-- ============================================================

-- ============================================================
-- TABLA: visitas_cobro
-- Registra cada visita que el cobrador realiza a un cliente.
-- resultado: 'cobrado' | 'ausente' | 'reagendado'
-- ============================================================

CREATE TABLE IF NOT EXISTS visitas_cobro (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  asignacion_id   BIGINT        NOT NULL COMMENT 'FK asignaciones.id',
  cobrador_id     BIGINT        NOT NULL COMMENT 'FK usuarios.id',
  resultado       ENUM('cobrado','ausente','reagendado') NOT NULL,
  monto_cobrado   DECIMAL(12,2) NULL     COMMENT 'Solo para resultado=cobrado',
  medio_pago      VARCHAR(50)   NULL     COMMENT 'Efectivo, transferencia, etc.',
  comentario      TEXT          NULL,
  foto_path       VARCHAR(500)  NULL     COMMENT 'Ruta relativa del archivo de evidencia',
  latitud         DECIMAL(10,8) NULL,
  longitud        DECIMAL(11,8) NULL,
  nueva_hora      TIME          NULL     COMMENT 'Solo para resultado=reagendado',
  fecha_hora      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_vc_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE,
  CONSTRAINT fk_vc_cobrador   FOREIGN KEY (cobrador_id)   REFERENCES usuarios(id)     ON DELETE CASCADE,
  INDEX idx_vc_cobrador_fecha (cobrador_id, fecha_hora),
  INDEX idx_vc_asignacion     (asignacion_id)
) COMMENT 'Historial de visitas realizadas por los cobradores en campo';
