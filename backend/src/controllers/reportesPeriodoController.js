const pool = require('../config/db');
const { toDateLocal, todayLocal } = require('../services/cobranzas/time');

/**
 * GET /api/reportes/periodo/cobranza
 *
 * Reporte de cobranza por período.
 * Agrupa montos cobrados por día, semana o mes según el parámetro `agrupacion`.
 *
 * Filtros vía query string:
 *   ?empresa_id=N
 *   &fecha_desde=YYYY-MM-DD
 *   &fecha_hasta=YYYY-MM-DD
 *   &agrupacion=diaria|semanal|mensual   (por defecto mensual)
 *   &cobrador_id=N                        (opcional)
 */
const getCobranzaPeriodo = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const {
      empresa_id,
      fecha_desde,
      fecha_hasta,
      agrupacion: agrup,
      cobrador_id,
    } = req.query;

    const agrupacion = agrup || 'mensual';
    const fechaDesde = fecha_desde ? toDateLocal(fecha_desde) : `${new Date().getFullYear()}-01-01`;
    const fechaHasta = fecha_hasta ? toDateLocal(fecha_hasta) : todayLocal();

    // ── Construcción dinámica de condiciones ──
    const conditions = ['vc.resultado = ?', 'vc.fecha_hora BETWEEN ? AND ?'];
    const params = ['cobrado', fechaDesde, fechaHasta];

    // Filtro por empresa
    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      conditions.push('u.empresa_id = ?');
      params.push(empresa_id || empresaId);
    } else if (empresa_id) {
      conditions.push('u.empresa_id = ?');
      params.push(Number(empresa_id));
    }

    // Filtro por cobrador
    if (cobrador_id) {
      conditions.push('vc.cobrador_id = ?');
      params.push(Number(cobrador_id));
    }

    const where = conditions.join(' AND ');

    // ── Formato de agrupación ──
    let formatoFecha;
    let orderExpr;
    switch (agrupacion) {
      case 'diaria':
        formatoFecha = "%Y-%m-%d";
        orderExpr = 'periodo ASC';
        break;
      case 'semanal':
        formatoFecha = "%Y-%u";
        orderExpr = 'periodo ASC';
        break;
      default: // mensual
        formatoFecha = "%Y-%m";
        orderExpr = 'periodo ASC';
    }

    // ── Query principal ──
    const [rows] = await pool.query(
      `SELECT
         DATE_FORMAT(vc.fecha_hora, '${formatoFecha}') AS periodo,
         COUNT(vc.id) AS cantidad_cobros,
         COUNT(DISTINCT vc.cobrador_id) AS cobradores_activos,
         COALESCE(SUM(vc.monto_cobrado), 0) AS monto_cobrado,
         COALESCE(AVG(vc.monto_cobrado), 0) AS promedio_por_cobro
       FROM visitas_cobro vc
       INNER JOIN usuarios u ON u.id = vc.cobrador_id
       WHERE ${where}
       GROUP BY periodo
       ORDER BY ${orderExpr}`,
      params
    );

    // ── Totales del período ──
    const [totales] = await pool.query(
      `SELECT
         COUNT(vc.id) AS total_cobros,
         COUNT(DISTINCT vc.cobrador_id) AS total_cobradores,
         COALESCE(SUM(vc.monto_cobrado), 0) AS total_monto,
         COALESCE(AVG(vc.monto_cobrado), 0) AS promedio_general
       FROM visitas_cobro vc
       INNER JOIN usuarios u ON u.id = vc.cobrador_id
       WHERE ${where}`,
      params
    );

    // ── Cobradores activos en el período (para el filtro) ──
    const [cobradores] = await pool.query(
      `SELECT DISTINCT
         u.id,
         u.nombre,
         u.apellido
       FROM visitas_cobro vc
       INNER JOIN usuarios u ON u.id = vc.cobrador_id
       WHERE ${where}
       ORDER BY u.nombre, u.apellido`,
      params
    );

    res.json({
      data: rows,
      totales: totales[0],
      cobradores,
      filtros: {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        agrupacion,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCobranzaPeriodo };
