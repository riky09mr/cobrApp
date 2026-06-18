-- ============================================================
-- Migracion v10: Logo de empresa
-- Descripcion: Agrega campo logo_url a la tabla empresas para
--              mostrar el logo en el panel del supervisor/cobrador.
-- ============================================================

ALTER TABLE empresas
  ADD COLUMN logo_url VARCHAR(500) NULL COMMENT 'Ruta relativa al logo de la empresa (ej: /uploads/logos/empresa_1.png)'
  AFTER direccion;
