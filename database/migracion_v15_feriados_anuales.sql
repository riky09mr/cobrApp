-- ============================================================
-- migracion_v15_feriados_anuales.sql
-- Feriados de Paraguay con reset anual automático:
--  1. Agrega columna fecha_original: fecha canónica original de
--     cada feriado (para trazabilidad cuando el admin edita la
--     fecha de un feriado fijo de un año puntual).
--  2. Backfill: fecha_original = fecha para las filas existentes.
--  3. Reclasifica los feriados "trasladados" (Ley 6631/2020) a
--     MANUAL: ya no se generan traslados automáticos.
-- Aplicada por backend/scripts/applyMigrationV15.js
-- ============================================================

-- 1) Columna fecha_original (aplicada con helper en el script,
--    MySQL 8 no soporta ADD COLUMN IF NOT EXISTS)
-- ALTER TABLE empresas_feriados
--   ADD COLUMN fecha_original DATE NULL
--   COMMENT 'Fecha original del feriado (referencia para el reset anual)' AFTER fecha;

-- 2) Backfill: la fecha original de las filas existentes es su fecha.
UPDATE empresas_feriados
SET fecha_original = fecha
WHERE fecha_original IS NULL;

-- 3) Los traslados ya no se generan: se tratan como feriados fijos
--    editables manualmente.
UPDATE empresas_feriados
SET origen = 'MANUAL'
WHERE origen IN ('traslado_heroes', 'traslado_paz_chaco', 'traslado_fundacion_asuncion');
