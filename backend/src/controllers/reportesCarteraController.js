const pool = require('../config/db');
const { toDateLocal, todayLocal } = require('../services/cobranzas/time');

/**
 * GET /api/reportes/cartera/vencida
 *
 * Reporte de cartera vencida por antigüedad.
 * Agrupa cuotas vencidas (saldo > 0 y fecha_vencimiento < hoy)
 * en rangos: 1-30, 31-60, 61-90, 90+ días.
 *
 * Filtros opcionales vía query string:
 *   ?empresa_id=N
 *   &fecha_corte=YYYY-MM-DD   (por defecto hoy, zona horaria local)
 */
const getCarteraVencida = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const { empresa_id, fecha_corte: fc } = req.query;

    const fechaCorte = fc ? toDateLocal(fc) : todayLocal();

    // ── Construcción dinámica de condiciones ──
    const conditions = ['cu.estado = ?', 'cu.saldo_cuota > 0', 'cu.fecha_vencimiento < ?'];
    const params = ['PENDIENTE', fechaCorte];

    // Filtro por empresa
    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      conditions.push('cr.empresa_id = ?');
      params.push(empresa_id || empresaId);
    } else if (empresa_id) {
      conditions.push('cr.empresa_id = ?');
      params.push(Number(empresa_id));
    }

    const where = conditions.join(' AND ');

    // ── Query principal: totales por rango ──
    const [rows] = await pool.query(
      `SELECT
         CASE
           WHEN DATEDIFF(?, cu.fecha_vencimiento) BETWEEN 1 AND 30  THEN '1-30 días'
           WHEN DATEDIFF(?, cu.fecha_vencimiento) BETWEEN 31 AND 60 THEN '31-60 días'
           WHEN DATEDIFF(?, cu.fecha_vencimiento) BETWEEN 61 AND 90 THEN '61-90 días'
           ELSE '90+ días'
         END AS rango,
         COUNT(cu.id) AS cantidad_cuotas,
         COUNT(DISTINCT cu.credito_id) AS cantidad_creditos,
         COUNT(DISTINCT cr.cliente_id) AS cantidad_clientes,
         COALESCE(SUM(cu.saldo_cuota), 0) AS monto_total
       FROM cuotas cu
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       WHERE ${where}
       GROUP BY rango
       ORDER BY
         CASE rango
           WHEN '1-30 días'  THEN 1
           WHEN '31-60 días' THEN 2
           WHEN '61-90 días' THEN 3
           ELSE 4
         END`,
      [fechaCorte, fechaCorte, fechaCorte, ...params, ...params, ...params]
    );

    // ── Totales generales ──
    const [totales] = await pool.query(
      `SELECT
         COUNT(cu.id) AS total_cuotas,
         COUNT(DISTINCT cu.credito_id) AS total_creditos,
         COUNT(DISTINCT cr.cliente_id) AS total_clientes,
         COALESCE(SUM(cu.saldo_cuota), 0) AS total_monto
       FROM cuotas cu
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       WHERE ${where}`,
      params
    );

    // ── Detalle por cliente (opcional, top deudores) ──
    const [detalle] = await pool.query(
      `SELECT
         cl.id AS cliente_id,
         cl.cedula,
         cl.nombre,
         cl.apellido,
         COUNT(cu.id) AS cuotas_vencidas,
         COALESCE(SUM(cu.saldo_cuota), 0) AS total_adeudado,
         MAX(DATEDIFF(?, cu.fecha_vencimiento)) AS max_dias_atraso,
         MIN(cu.fecha_vencimiento) AS fecha_vencimiento_mas_antigua
       FROM cuotas cu
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       INNER JOIN clientes cl ON cl.id = cr.cliente_id
       WHERE ${where}
       GROUP BY cl.id, cl.cedula, cl.nombre, cl.apellido
       ORDER BY total_adeudado DESC
       LIMIT 50`,
      [fechaCorte, ...params]
    );

    res.json({
      data: rows,
      totales: totales[0],
      detalle,
      fecha_corte: fechaCorte,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCarteraVencida };
