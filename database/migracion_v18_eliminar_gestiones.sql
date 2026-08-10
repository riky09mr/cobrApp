-- Migración v18 — Eliminación de la tabla `gestiones`
--
-- Contexto: la tabla `gestiones` era una fuente de verdad duplicada de las
-- cobranzas. `visitas_cobro` es el modelo canónico (resultado ENUM,
-- medio_pago_id, arqueo_id, nro_comprobante, recibo_id, coordenadas, etc.).
--
-- Precondición: migración v17 ya verificó que todas las filas de `gestiones`
-- tienen su equivalente en `visitas_cobro` (0 huérfanas). Por eso el DROP
-- no implica pérdida de datos.
--
-- Este archivo es la referencia documental; la ejecución real la hace
-- backend/scripts/applyMigrationV18.js (idempotente).

DROP TABLE IF EXISTS `gestiones`;
