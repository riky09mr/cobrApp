-- ============================================================
-- LIMPIEZA DE DATOS DE GESTIÓN
-- ============================================================
-- Este script elimina TODOS los datos transaccionales de gestión
-- (créditos, cuotas, asignaciones, clientes, caja, arqueos,
--  recibos, pagos, visitas, facturación, mensajes, notificaciones)
-- y reinicia los AUTO_INCREMENT.
--
-- CONSERVA: configuraciones (empresas, usuarios, roles, zonas,
--           medios_pago, feriados, intereses, cajas, etc.)
--
-- ⚠️ OPERACIÓN IRREVERSIBLE ⚠️
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── Facturación (depende de cuotas, clientes, recibos) ──
TRUNCATE TABLE facturas_pago;
TRUNCATE TABLE facturas_detalle;
TRUNCATE TABLE facturas;

-- ── Recibos y pagos ──
TRUNCATE TABLE comprobantes;
TRUNCATE TABLE recibo_detalles;
TRUNCATE TABLE recibos;
TRUNCATE TABLE pagos;

-- ── Visitas de cobro (depende de asignaciones, recibos, arqueos) ──
TRUNCATE TABLE visitas_cobro;

-- ── Caja y arqueos ──
TRUNCATE TABLE rendiciones;
TRUNCATE TABLE movimientos_caja;
TRUNCATE TABLE cierres_caja;
TRUNCATE TABLE caja_movimientos;
TRUNCATE TABLE caja_cambios;
TRUNCATE TABLE caja_aperturas;
TRUNCATE TABLE arqueos_caja;
TRUNCATE TABLE arqueos;

-- ── Asignaciones, cuotas y créditos ──
TRUNCATE TABLE asignaciones;
TRUNCATE TABLE cuotas;
TRUNCATE TABLE creditos;

-- ── Clientes ──
TRUNCATE TABLE clientes_empresa_old;
TRUNCATE TABLE clientes_empresas;
TRUNCATE TABLE clientes;

-- ── Mensajes y notificaciones ──
TRUNCATE TABLE notificaciones;
TRUNCATE TABLE mensajes;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Verificación: debería devolver 0 filas en todas las tablas
-- ============================================================
SELECT 'creditos' AS tabla, COUNT(*) AS filas FROM creditos
UNION ALL SELECT 'cuotas', COUNT(*) FROM cuotas
UNION ALL SELECT 'asignaciones', COUNT(*) FROM asignaciones
UNION ALL SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL SELECT 'clientes_empresas', COUNT(*) FROM clientes_empresas
UNION ALL SELECT 'visitas_cobro', COUNT(*) FROM visitas_cobro
UNION ALL SELECT 'recibos', COUNT(*) FROM recibos
UNION ALL SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL SELECT 'arqueos', COUNT(*) FROM arqueos
UNION ALL SELECT 'arqueos_caja', COUNT(*) FROM arqueos_caja
UNION ALL SELECT 'cierres_caja', COUNT(*) FROM cierres_caja
UNION ALL SELECT 'facturas', COUNT(*) FROM facturas
UNION ALL SELECT 'mensajes', COUNT(*) FROM mensajes
UNION ALL SELECT 'notificaciones', COUNT(*) FROM notificaciones;
