-- ============================================================
-- migracion_v16_auditoria.sql
-- Amplía la tabla `auditoria` (bitácora transversal) para
-- alinearla con la documentación técnica:
--   - empresa_id      : contexto multiempresa
--   - ip_origen       : IP desde donde se ejecutó la acción
--   - accion          : VARCHAR(20) con valores INSERT/UPDATE/
--                       DELETE/ANULAR/APERTURAR/CERRAR/LOGIN/
--                       LOGOUT/ASIGNAR/DESASIGNAR/EMITIR
--   - datos_antes     : JSON con el estado previo del registro
--   - datos_despues   : JSON con el estado posterior
--   - observaciones   : texto libre
--   - fecha_hora_evento: marca de tiempo del evento
--   - deleted_at, created_by, updated_by: soft-delete y trazabilidad
-- Aplicada por backend/scripts/applyMigrationV16.js
-- ============================================================

ALTER TABLE `auditoria`
  ADD COLUMN `empresa_id` BIGINT NULL AFTER `id`,
  ADD COLUMN `ip_origen` VARCHAR(45) NULL AFTER `usuario_id`,
  ADD COLUMN `accion` VARCHAR(20) NOT NULL DEFAULT 'INSERT'
    COMMENT 'INSERT|UPDATE|DELETE|ANULAR|APERTURAR|CERRAR|LOGIN|LOGOUT|ASIGNAR|DESASIGNAR|EMITIR' AFTER `registro_id`,
  ADD COLUMN `tabla_afectada` VARCHAR(100) NULL AFTER `accion`,
  ADD COLUMN `registro_id` BIGINT NULL AFTER `tabla_afectada`,
  ADD COLUMN `datos_antes` JSON NULL AFTER `detalle`,
  ADD COLUMN `datos_despues` JSON NULL AFTER `datos_antes`,
  ADD COLUMN `observaciones` TEXT NULL AFTER `datos_despues`,
  ADD COLUMN `fecha_hora_evento` DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER `observaciones`,
  ADD COLUMN `deleted_at` DATETIME NULL AFTER `fecha_hora_evento`,
  ADD COLUMN `created_by` BIGINT NULL AFTER `deleted_at`,
  ADD COLUMN `updated_by` BIGINT NULL AFTER `created_by`,
  ADD INDEX `idx_auditoria_empresa_fecha` (`empresa_id`, `fecha_hora_evento`),
  ADD INDEX `idx_auditoria_tabla_registro` (`tabla_afectada`, `registro_id`),
  ADD INDEX `idx_auditoria_usuario_fecha` (`usuario_id`, `fecha_hora_evento`);
