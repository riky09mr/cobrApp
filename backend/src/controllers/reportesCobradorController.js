const pool = require('../config/db');
const { normalizeDateStr, todayLocal } = require('../services/cobranzas/time');

/**
 * GET /api/reportes/cobrador/eficiencia
 *
 * Reporte de eficiencia por cobrador.
 * Filtros opcionales vía query string:
 *   ?empresa_id=N
 *   &cobrador_id=N
 *   &fecha_desde=YYYY-MM-DD
 *   &fecha_hasta=YYYY-MM-DD
 *   &eficiencia_min=N   (filtra después del cálculo)
 */
const getEficiencia = async (req, res, next) => {
  try {
    const { rol, id: userId, empresaId } = req.user;
    const { empresa_id, cobrador_id, fecha_desde, fecha_hasta } = req.query;

    const conditions = ['r.nombre = ?'];
    const params = ['COBRADOR'];

    // Seguridad por rol — ADMIN también filtra por su empresa
    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      conditions.push('u.empresa_id = ?');
      params.push(empresaId);
    } else if (rol === 'COBRADOR') {
      conditions.push('u.id = ?');
      params.push(userId);
    }

    // Filtros opcionales
    if (empresa_id) {
      conditions.push('u.empresa_id = ?');
      params.push(Number(empresa_id));
    }
    if (cobrador_id) {
      conditions.push('u.id = ?');
      params.push(Number(cobrador_id));
    }
    if (fecha_desde) {
      conditions.push('vc.fecha_hora >= ?');
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push('vc.fecha_hora <= ?');
      params.push(fecha_hasta);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT
         u.id AS cobrador_id,
         CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS cobrador,
         e.razon_social AS empresa,
         COUNT(DISTINCT a.id) AS total_asignaciones,
         COUNT(DISTINCT CASE WHEN a.estado = 'COMPLETADO' THEN a.id END) AS completadas,
         COUNT(DISTINCT CASE WHEN a.estado = 'PENDIENTE' THEN a.id END) AS pendientes,
         COALESCE(SUM(CASE WHEN vc.resultado = 'cobrado' THEN vc.monto_cobrado END), 0) AS monto_cobrado,
         COUNT(DISTINCT vc.id) AS visitas_realizadas,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'cobrado' THEN vc.id END) AS visitas_cobradas,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'ausente' THEN vc.id END) AS visitas_ausentes,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'reagendado' THEN vc.id END) AS visitas_reagendadas
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       INNER JOIN empresas e ON e.id = u.empresa_id
       LEFT JOIN asignaciones a ON a.usuario_id = u.id
       LEFT JOIN visitas_cobro vc ON vc.asignacion_id = a.id AND vc.cobrador_id = u.id
       ${where}
       GROUP BY u.id, u.nombre, u.apellido, e.razon_social
       ORDER BY completadas DESC`,
      params
    );

    let data = rows.map((r) => ({
      cobrador_id: r.cobrador_id,
      cobrador: r.cobrador,
      empresa: r.empresa,
      total_asignaciones: Number(r.total_asignaciones),
      completadas: Number(r.completadas),
      pendientes: Number(r.pendientes),
      monto_cobrado: Number(r.monto_cobrado),
      visitas_realizadas: Number(r.visitas_realizadas),
      visitas_cobradas: Number(r.visitas_cobradas),
      visitas_ausentes: Number(r.visitas_ausentes),
      visitas_reagendadas: Number(r.visitas_reagendadas),
      eficiencia:
        Number(r.total_asignaciones) > 0
          ? Number(
              (
                (Number(r.completadas) / Number(r.total_asignaciones)) *
                100
              ).toFixed(1)
            )
          : 0,
      tasa_efectividad_visitas:
        Number(r.visitas_realizadas) > 0
          ? Number(
              (
                (Number(r.visitas_cobradas) / Number(r.visitas_realizadas)) *
                100
              ).toFixed(1)
            )
          : 0,
    }));

    // Filtro post-cálculo: eficiencia_min
    const { eficiencia_min } = req.query;
    if (eficiencia_min) {
      data = data.filter((r) => r.eficiencia >= Number(eficiencia_min));
    }

    // ── Desglose mensual ──
    const [rowsMensual] = await pool.query(
      `SELECT
         DATE_FORMAT(vc.fecha_hora, '%Y-%m') AS mes,
         COUNT(DISTINCT vc.id) AS cantidad_cobros,
         COALESCE(SUM(vc.monto_cobrado), 0) AS monto_mes
       FROM visitas_cobro vc
       INNER JOIN asignaciones a ON a.id = vc.asignacion_id AND a.usuario_id = vc.cobrador_id
       INNER JOIN usuarios u ON u.id = vc.cobrador_id
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE r.nombre = 'COBRADOR'
         AND vc.resultado = 'cobrado'
         ${rol === 'ADMIN' || rol === 'SUPERVISOR' ? 'AND u.empresa_id = ?' : ''}
         ${rol === 'COBRADOR' ? 'AND u.id = ?' : ''}
         ${empresa_id ? 'AND u.empresa_id = ?' : ''}
         ${cobrador_id ? 'AND u.id = ?' : ''}
         ${fecha_desde ? 'AND vc.fecha_hora >= ?' : ''}
         ${fecha_hasta ? 'AND vc.fecha_hora <= ?' : ''}
       GROUP BY DATE_FORMAT(vc.fecha_hora, '%Y-%m')
       ORDER BY mes ASC`,
      [
        ...(rol === 'ADMIN' || rol === 'SUPERVISOR' ? [empresaId] : []),
        ...(rol === 'COBRADOR' ? [userId] : []),
        ...(empresa_id ? [Number(empresa_id)] : []),
        ...(cobrador_id ? [Number(cobrador_id)] : []),
        ...(fecha_desde ? [fecha_desde] : []),
        ...(fecha_hasta ? [fecha_hasta] : []),
      ]
    );

    const mensual = rowsMensual.map((r) => ({
      mes: r.mes,
      cantidad_cobros: Number(r.cantidad_cobros),
      monto_mes: Number(r.monto_mes),
    }));

    return res.json({ data, mensual });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/reportes/cobradores/dia
 *
 * Reporte de actividad de cobradores para un día puntual.
 * Filtros opcionales vía query string:
 *   ?fecha=YYYY-MM-DD   (por defecto hoy, zona horaria local)
 *
 * Nota: se usa DATE(a.fecha_asignacion) porque fecha_limite es NULL
 * en la base de datos actual.
 */
const getCobradoresDia = async (req, res, next) => {
  try {
    const { rol, id: userId, empresaId } = req.user;
    const { fecha: fechaQuery } = req.query;

    const fecha = fechaQuery ? normalizeDateStr(fechaQuery) : todayLocal();

    const [rows] = await pool.query(
      `SELECT
         u.id AS cobrador_id,
         CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS cobrador,
         e.razon_social AS empresa,
         COUNT(DISTINCT a.id) AS asignaciones_dia,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'cobrado' AND DATE(vc.fecha_hora) = ? THEN vc.id END) AS cobros_dia,
         COALESCE(SUM(CASE WHEN vc.resultado = 'cobrado' AND DATE(vc.fecha_hora) = ? THEN vc.monto_cobrado END), 0) AS monto_cobrado_dia,
         COUNT(DISTINCT CASE WHEN DATE(vc.fecha_hora) = ? THEN vc.id END) AS visitas_dia
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       INNER JOIN empresas e ON e.id = u.empresa_id
       LEFT JOIN asignaciones a ON a.usuario_id = u.id AND DATE(a.fecha_asignacion) = ?
       LEFT JOIN visitas_cobro vc ON vc.asignacion_id = a.id AND vc.cobrador_id = u.id
       WHERE r.nombre = 'COBRADOR'
         ${rol === 'ADMIN' || rol === 'SUPERVISOR' ? 'AND u.empresa_id = ?' : ''}
         ${rol === 'COBRADOR' ? 'AND u.id = ?' : ''}
       GROUP BY u.id, u.nombre, u.apellido, e.razon_social
       ORDER BY monto_cobrado_dia DESC, visitas_dia DESC`,
      [
        fecha,
        fecha,
        fecha,
        fecha,
        ...(rol === 'ADMIN' || rol === 'SUPERVISOR' ? [empresaId] : []),
        ...(rol === 'COBRADOR' ? [userId] : []),
      ]
    );

    const data = rows.map((r) => ({
      cobrador_id: r.cobrador_id,
      cobrador: r.cobrador,
      empresa: r.empresa,
      asignaciones_dia: Number(r.asignaciones_dia),
      cobros_dia: Number(r.cobros_dia),
      monto_cobrado_dia: Number(r.monto_cobrado_dia),
      visitas_dia: Number(r.visitas_dia),
    }));

    return res.json({ data, fecha });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/reportes/cobrador/ranking
 *
 * Ranking de cobradores por monto cobrado en un período.
 * Filtros opcionales vía query string:
 *   ?empresa_id=N
 *   &fecha_desde=YYYY-MM-DD
 *   &fecha_hasta=YYYY-MM-DD
 */
const getRankingCobradores = async (req, res, next) => {
  try {
    const { rol, id: userId, empresaId } = req.user;
    const { empresa_id, fecha_desde, fecha_hasta } = req.query;

    const conditions = ['r.nombre = ?'];
    const params = ['COBRADOR'];

    // Seguridad por rol — ADMIN también filtra por su empresa
    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      conditions.push('u.empresa_id = ?');
      params.push(empresaId);
    } else if (rol === 'COBRADOR') {
      conditions.push('u.id = ?');
      params.push(userId);
    }

    // Filtros opcionales
    if (empresa_id) {
      conditions.push('u.empresa_id = ?');
      params.push(Number(empresa_id));
    }
    if (fecha_desde) {
      conditions.push('vc.fecha_hora >= ?');
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push('vc.fecha_hora <= ?');
      params.push(fecha_hasta);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT
         u.id AS cobrador_id,
         CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS cobrador,
         e.razon_social AS empresa,
         COUNT(DISTINCT a.id) AS total_asignaciones,
         COUNT(DISTINCT CASE WHEN a.estado = 'COMPLETADO' THEN a.id END) AS completadas,
         COUNT(DISTINCT CASE WHEN a.estado = 'PENDIENTE' THEN a.id END) AS pendientes,
         COALESCE(SUM(CASE WHEN vc.resultado = 'cobrado' THEN vc.monto_cobrado END), 0) AS monto_cobrado,
         COUNT(DISTINCT vc.id) AS visitas_realizadas,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'cobrado' THEN vc.id END) AS visitas_cobradas,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'ausente' THEN vc.id END) AS visitas_ausentes,
         COUNT(DISTINCT CASE WHEN vc.resultado = 'reagendado' THEN vc.id END) AS visitas_reagendadas
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       INNER JOIN empresas e ON e.id = u.empresa_id
       LEFT JOIN asignaciones a ON a.usuario_id = u.id
       LEFT JOIN visitas_cobro vc ON vc.asignacion_id = a.id AND vc.cobrador_id = u.id
       ${where}
       GROUP BY u.id, u.nombre, u.apellido, e.razon_social
       ORDER BY monto_cobrado DESC, visitas_cobradas DESC, completadas DESC`,
      params
    );

    // Solo cobradores con actividad en el período (monto o visitas > 0)
    const conActividad = rows.filter(
      (r) => Number(r.monto_cobrado) > 0 || Number(r.visitas_realizadas) > 0
    );

    const data = conActividad.map((r, idx) => ({
      posicion: idx + 1,
      cobrador_id: r.cobrador_id,
      cobrador: r.cobrador,
      empresa: r.empresa,
      total_asignaciones: Number(r.total_asignaciones),
      completadas: Number(r.completadas),
      pendientes: Number(r.pendientes),
      monto_cobrado: Number(r.monto_cobrado),
      visitas_realizadas: Number(r.visitas_realizadas),
      visitas_cobradas: Number(r.visitas_cobradas),
      visitas_ausentes: Number(r.visitas_ausentes),
      visitas_reagendadas: Number(r.visitas_reagendadas),
      tasa_efectividad_visitas:
        Number(r.visitas_realizadas) > 0
          ? Number(
              (
                (Number(r.visitas_cobradas) / Number(r.visitas_realizadas)) *
                100
              ).toFixed(1)
            )
          : 0,
    }));

    return res.json({
      data,
      fecha_desde: fecha_desde || null,
      fecha_hasta: fecha_hasta || null,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getEficiencia,
  getCobradoresDia,
  getRankingCobradores,
};
