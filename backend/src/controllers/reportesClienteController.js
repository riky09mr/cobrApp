const pool = require('../config/db');
const { normalizeDateStr, todayLocal } = require('../services/cobranzas/time');

/**
 * GET /api/reportes/cliente/morosidad
 *
 * Reporte de morosidad por cliente.
 * Lista los clientes con cuotas vencidas (saldo > 0 y fecha_vencimiento
 * anterior a la fecha de corte), con el total adeudado, cantidad de
 * cuotas/creditos vencidos y los días máximos de atraso.
 *
 * Filtros opcionales vía query string:
 *   ?empresa_id=N
 *   &fecha_corte=YYYY-MM-DD   (por defecto hoy, zona horaria local)
 */
const getMorosidadCliente = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const { empresa_id, fecha_corte: fc } = req.query;

    const fechaCorte = fc ? normalizeDateStr(fc) : todayLocal();

    // ── Construcción dinámica de condiciones ──
    const conditions = ['cu.estado = ?', 'cu.saldo_cuota > 0', 'cu.fecha_vencimiento < ?'];
    const params = ['PENDIENTE', fechaCorte];

    // Filtro por empresa (mismo patrón de seguridad que cartera vencida)
    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      conditions.push('cr.empresa_id = ?');
      params.push(empresa_id || empresaId);
    } else if (empresa_id) {
      conditions.push('cr.empresa_id = ?');
      params.push(Number(empresa_id));
    }

    const where = conditions.join(' AND ');

    // ── Detalle por cliente ──
    const [detalle] = await pool.query(
      `SELECT
         cl.id AS cliente_id,
         cl.cedula,
         cl.nombre,
         cl.apellido,
         cl.telefono,
         ce.direccion,
         COUNT(cu.id) AS cuotas_vencidas,
         COUNT(DISTINCT cr.id) AS creditos_vencidos,
         COALESCE(SUM(cu.saldo_cuota), 0) AS total_adeudado,
         MAX(DATEDIFF(?, cu.fecha_vencimiento)) AS max_dias_atraso,
         MIN(cu.fecha_vencimiento) AS fecha_vencimiento_mas_antigua
       FROM cuotas cu
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       INNER JOIN clientes cl ON cl.id = cr.cliente_id
       LEFT JOIN clientes_empresas ce ON ce.cliente_id = cl.id
                                      AND ce.empresa_id = cr.empresa_id
       WHERE ${where}
       GROUP BY cl.id, cl.cedula, cl.nombre, cl.apellido, cl.telefono, ce.direccion
       ORDER BY total_adeudado DESC
       LIMIT 200`,
      [fechaCorte, ...params]
    );

    // ── Totales generales ──
    const [totales] = await pool.query(
      `SELECT
         COUNT(DISTINCT cr.cliente_id) AS total_clientes,
         COUNT(cu.id) AS total_cuotas,
         COUNT(DISTINCT cu.credito_id) AS total_creditos,
         COALESCE(SUM(cu.saldo_cuota), 0) AS total_adeudado
       FROM cuotas cu
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       WHERE ${where}`,
      params
    );

    res.json({
      data: detalle,
      totales: totales[0],
      fecha_corte: fechaCorte,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMorosidadCliente };
