-- ============================================================
-- cobrApp - Migracion v22: Permiso medios_pago:ver para COBRADOR
-- Fecha: Agosto 2026
-- Objetivo:
--   Otorgar al rol COBRADOR el permiso de lectura de medios de
--   pago (medios_pago:ver). Sin este permiso, la app movil no
--   puede cargar la lista de metodos de pago al confirmar un
--   cobro (GET /api/medios-pago devuelve 403 y la lista queda
--   vacia).
-- ============================================================

START TRANSACTION;

-- Otorgar al rol COBRADOR el permiso de ver medios de pago
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'COBRADOR'
  AND p.modulo = 'medios_pago'
  AND p.accion = 'ver';

COMMIT;
