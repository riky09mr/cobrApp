-- ============================================================
-- cobrApp - Migracion v14: Feriados moviles con origen
-- Fecha: Agosto 2026
-- Objetivo:
--   - Agregar la columna origen a empresas_feriados para distinguir
--     feriados MANUALes de los generados automaticamente por
--     Semana Santa (Computus) y traslados de la Ley 6631/2020.
--   - Marcar los feriados moviles ya existentes (Jueves y Viernes
--     Santo 2026) con su origen para que el modulo de generacion
--     pueda sobrescribirlos cada ano.
-- ============================================================

START TRANSACTION;

ALTER TABLE empresas_feriados
  ADD COLUMN IF NOT EXISTS origen VARCHAR(50) NOT NULL DEFAULT 'MANUAL'
  COMMENT 'Origen del feriado: MANUAL, jueves_santo, viernes_santo, traslado_heroes, traslado_paz_chaco, traslado_fundacion_asuncion';

UPDATE empresas_feriados
SET origen = 'jueves_santo'
WHERE fecha = '2026-04-02' AND deleted_at IS NULL;

UPDATE empresas_feriados
SET origen = 'viernes_santo'
WHERE fecha = '2026-04-03' AND deleted_at IS NULL;

COMMIT;

-- ============================================================
-- Notas de implementacion
-- 1. MySQL 8 no soporta ADD COLUMN IF NOT EXISTS: el runner
--    applyMigrationV14.js aplica la columna con ensureColumn.
-- 2. Los feriados con origen distinto de MANUAL son generados por
--    el endpoint POST /feriados/generar (se reemplazan por ano).
-- 3. Los feriados fijos (Año Nuevo, Independencia, Navidad, etc.)
--    quedan con origen MANUAL y solo se gestionan a mano.
-- ============================================================
