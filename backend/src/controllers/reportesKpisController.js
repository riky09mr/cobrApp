const pool = require('../config/db');
const { toDateLocal, todayLocal } = require('../services/cobranzas/time');

/**
 * ─────────────────────────────────────────────────────────────
 * KPIs del marco teórico (Cárdenas, 2021 — sección 2.4)
 *
 * 1. Índice de Morosidad (IM)        → cartera/vencida
 * 2. Efectividad de Cobro (EC)       → cobrador/eficiencia
 * 3. Rotación de Cartera             → /kpis/rotacion
 * 4. Cobertura de Cobro              → /kpis/cobertura
 * 5. Costo por Gestión               → /kpis/costo
 * 6. Tasa de Reagendamiento          → /kpis/reagendamiento
 *
 * Todos usan `visitas_cobro` como fuente de verdad única de
 * gestiones de campo (migración v17/v18).
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Construye las condiciones de seguridad por rol.
 * - ADMIN/SUPERVISOR: filtra por empresa (query o la propia)
 * - COBRADOR: solo sus propios datos
 *
 * @param {object} req
 * @param {string} aliasTabla alias SQL de la tabla con empresa_id
 * @param {string} aliasUsuario alias SQL de la columna del cobrador
 * @returns {{conditions: string[], params: any[]}}
 */
function construirFiltrosRol(req, aliasTabla = 'u', aliasUsuario = 'vc.cobrador_id') {
  const { rol, id: userId, empresaId } = req.user;
  const { empresa_id, cobrador_id } = req.query;

  const conditions = [];
  const params = [];

  if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
    conditions.push(`${aliasTabla}.empresa_id = ?`);
    params.push(Number(empresa_id || empresaId));
  } else if (rol === 'COBRADOR') {
    conditions.push(`${aliasUsuario} = ?`);
    params.push(Number(userId));
  } else if (empresa_id) {
    conditions.push(`${aliasTabla}.empresa_id = ?`);
    params.push(Number(empresa_id));
  }

  if (cobrador_id) {
    conditions.push(`${aliasUsuario} = ?`);
    params.push(Number(cobrador_id));
  }

  return { conditions, params };
}

/**
 * Rango de fechas por defecto: desde inicio del año hasta hoy (hora local).
 */
function rangoFechas(query) {
  const fechaDesde = query.fecha_desde
    ? toDateLocal(query.fecha_desde)
    : `${new Date().getFullYear()}-01-01`;
  const fechaHasta = query.fecha_hasta ? toDateLocal(query.fecha_hasta) : todayLocal();
  return { fechaDesde, fechaHasta };
}

/**
 * GET /api/reportes/kpis/rotacion
 *
 * Rotación de Cartera: velocidad de recuperación de créditos.
 *   rotación = monto cobrado en el período / cartera vigente
 *   anualizada = rotación × (365 / días del período)
 *   días promedio de cobro = 365 / rotación anualizada
 *
 * La cartera vigente se aproxima con el saldo_actual de los
 * créditos ACTIVOS a la fecha de corte (no hay histórico de saldos).
 */
const getRotacionCartera = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = rangoFechas(req.query);
    const { rol, id: userId, empresaId } = req.user;
    const { empresa_id, cobrador_id } = req.query;

    // ── Filtro de empresa (ADMIN/SUPERVISOR) o cobrador (COBRADOR) ──
    const condVisitas = ['vc.resultado = ?', 'vc.fecha_hora >= ?', 'vc.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)'];
    const paramsVisitas = ['cobrado', `${fechaDesde} 00:00:00`, fechaHasta];

    const condCartera = ['cr.estado = ?'];
    const paramsCartera = ['ACTIVO'];

    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      const emp = Number(empresa_id || empresaId);
      condVisitas.push('u.empresa_id = ?');
      paramsVisitas.push(emp);
      condCartera.push('cr.empresa_id = ?');
      paramsCartera.push(emp);
    } else if (rol === 'COBRADOR') {
      condVisitas.push('vc.cobrador_id = ?');
      paramsVisitas.push(Number(userId));
      // Para el cobrador, la cartera vigente se aproxima con los
      // créditos que tiene asignados (a través de sus cuotas).
      condCartera.push(
        'cr.id IN (SELECT cu.credito_id FROM cuotas cu INNER JOIN asignaciones a ON a.cuota_id = cu.id WHERE a.usuario_id = ?)'
      );
      paramsCartera.push(Number(userId));
    } else if (empresa_id) {
      condVisitas.push('u.empresa_id = ?');
      paramsVisitas.push(Number(empresa_id));
      condCartera.push('cr.empresa_id = ?');
      paramsCartera.push(Number(empresa_id));
    }

    if (cobrador_id) {
      condVisitas.push('vc.cobrador_id = ?');
      paramsVisitas.push(Number(cobrador_id));
    }

    // ── Monto cobrado en el período ──
    const [cobrado] = await pool.query(
      `SELECT COALESCE(SUM(vc.monto_cobrado), 0) AS monto_cobrado,
              COUNT(DISTINCT vc.cobrador_id) AS cobradores_activos
         FROM visitas_cobro vc
         INNER JOIN usuarios u ON u.id = vc.cobrador_id
         WHERE ${condVisitas.join(' AND ')}`,
      paramsVisitas
    );

    // ── Cartera vigente (créditos ACTIVOS) ──
    const [cartera] = await pool.query(
      `SELECT COALESCE(SUM(cr.saldo_actual), 0) AS saldo_vigente,
              COUNT(cr.id) AS creditos_activos
         FROM creditos cr
         WHERE ${condCartera.join(' AND ')}`,
      paramsCartera
    );

    const montoCobrado = Number(cobrado[0]?.monto_cobrado || 0);
    const saldoVigente = Number(cartera[0]?.saldo_vigente || 0);
    const creditosActivos = Number(cartera[0]?.creditos_activos || 0);

    const diasPeriodo = Math.max(
      1,
      Math.round((new Date(fechaHasta) - new Date(fechaDesde)) / 86400000) + 1
    );

    const rotacion = saldoVigente > 0 ? montoCobrado / saldoVigente : 0;
    const rotacionAnual = rotacion * (365 / diasPeriodo);
    const diasPromedioCobro = rotacionAnual > 0 ? 365 / rotacionAnual : null;

    res.json({
      data: {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        monto_cobrado: montoCobrado,
        cartera_vigente: saldoVigente,
        creditos_activos: creditosActivos,
        dias_periodo: diasPeriodo,
        rotacion_cartera: Number(rotacion.toFixed(4)),
        rotacion_anualizada: Number(rotacionAnual.toFixed(4)),
        dias_promedio_cobro: diasPromedioCobro === null ? null : Number(diasPromedioCobro.toFixed(1)),
        kpi: {
          clave: 'rotacion_cartera',
          nombre: 'Rotación de Cartera',
          valor: Number(rotacionAnual.toFixed(4)),
          unidad: 'veces/año',
          descripcion:
            'Velocidad de recuperación: monto cobrado en el período sobre la cartera vigente, anualizada.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reportes/kpis/cobertura
 *
 * Cobertura de Cobro: % de asignaciones que recibieron al menos una
 * visita de gestión en el período.
 *   cobertura = asignaciones con visita / total asignaciones × 100
 */
const getCoberturaCobro = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = rangoFechas(req.query);
    const { rol, id: userId, empresaId } = req.user;
    const { empresa_id, cobrador_id } = req.query;

    const conditions = ['a.fecha_asignacion >= ?', 'a.fecha_asignacion < DATE_ADD(?, INTERVAL 1 DAY)'];
    const params = [`${fechaDesde} 00:00:00`, fechaHasta];

    if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
      conditions.push('cr.empresa_id = ?');
      params.push(Number(empresa_id || empresaId));
    } else if (rol === 'COBRADOR') {
      conditions.push('a.usuario_id = ?');
      params.push(Number(userId));
    } else if (empresa_id) {
      conditions.push('cr.empresa_id = ?');
      params.push(Number(empresa_id));
    }

    if (cobrador_id) {
      conditions.push('a.usuario_id = ?');
      params.push(Number(cobrador_id));
    }

    const where = conditions.join(' AND ');

    const [rows] = await pool.query(
      `SELECT
         COUNT(DISTINCT a.id) AS total_asignaciones,
         COUNT(DISTINCT CASE WHEN vc.id IS NOT NULL THEN a.id END) AS asignaciones_con_visita,
         COUNT(DISTINCT vc.id) AS total_visitas
       FROM asignaciones a
       INNER JOIN cuotas cu ON cu.id = a.cuota_id
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       LEFT JOIN visitas_cobro vc ON vc.asignacion_id = a.id
       WHERE ${where}`,
      params
    );

    const total = Number(rows[0]?.total_asignaciones || 0);
    const conVisita = Number(rows[0]?.asignaciones_con_visita || 0);
    const visitas = Number(rows[0]?.total_visitas || 0);

    const cobertura = total > 0 ? (conVisita / total) * 100 : 0;

    res.json({
      data: {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        total_asignaciones: total,
        asignaciones_con_visita: conVisita,
        total_visitas: visitas,
        cobertura_cobro: Number(cobertura.toFixed(2)),
        kpi: {
          clave: 'cobertura_cobro',
          nombre: 'Cobertura de Cobro',
          valor: Number(cobertura.toFixed(2)),
          unidad: '%',
          descripcion:
            'Porcentaje de cuotas asignadas que recibieron al menos una visita de gestión en el período.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reportes/kpis/reagendamiento
 *
 * Tasa de Reagendamiento: % de visitas que terminaron en reprogramación.
 *   tasa = visitas reagendadas / total visitas × 100
 */
const getTasaReagendamiento = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = rangoFechas(req.query);
    const { conditions, params } = construirFiltrosRol(req);

    const where = [
      'vc.fecha_hora >= ?',
      'vc.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)',
      ...conditions,
    ].join(' AND ');
    const queryParams = [`${fechaDesde} 00:00:00`, fechaHasta, ...params];

    const [rows] = await pool.query(
      `SELECT
         COUNT(vc.id) AS total_visitas,
         COUNT(CASE WHEN vc.resultado = 'reagendado' THEN vc.id END) AS visitas_reagendadas,
         COUNT(CASE WHEN vc.resultado = 'cobrado' THEN vc.id END) AS visitas_cobradas,
         COUNT(CASE WHEN vc.resultado = 'ausente' THEN vc.id END) AS visitas_ausentes
       FROM visitas_cobro vc
       INNER JOIN usuarios u ON u.id = vc.cobrador_id
       WHERE ${where}`,
      queryParams
    );

    const total = Number(rows[0]?.total_visitas || 0);
    const reagendadas = Number(rows[0]?.visitas_reagendadas || 0);
    const cobradas = Number(rows[0]?.visitas_cobradas || 0);
    const ausentes = Number(rows[0]?.visitas_ausentes || 0);

    const tasa = total > 0 ? (reagendadas / total) * 100 : 0;

    res.json({
      data: {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        total_visitas: total,
        visitas_reagendadas: reagendadas,
        visitas_cobradas: cobradas,
        visitas_ausentes: ausentes,
        tasa_reagendamiento: Number(tasa.toFixed(2)),
        kpi: {
          clave: 'tasa_reagendamiento',
          nombre: 'Tasa de Reagendamiento',
          valor: Number(tasa.toFixed(2)),
          unidad: '%',
          descripcion:
            'Porcentaje de visitas de gestión que resultaron en reprogramación (reagendado).',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reportes/kpis/costo
 *
 * Costo por Gestión: costo operativo / número de gestiones (visitas).
 * El sistema NO registra costos operativos; el cálculo usa el
 * parámetro opcional ?costo_operativo=N (en la moneda configurada).
 * Si no se envía, devuelve null con observación.
 */
const getCostoGestion = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = rangoFechas(req.query);
    const costoOperativo = req.query.costo_operativo
      ? Number(req.query.costo_operativo)
      : null;

    const { conditions, params } = construirFiltrosRol(req);

    const where = [
      'vc.fecha_hora >= ?',
      'vc.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)',
      ...conditions,
    ].join(' AND ');
    const queryParams = [`${fechaDesde} 00:00:00`, fechaHasta, ...params];

    const [rows] = await pool.query(
      `SELECT COUNT(vc.id) AS total_gestiones
         FROM visitas_cobro vc
         INNER JOIN usuarios u ON u.id = vc.cobrador_id
         WHERE ${where}`,
      queryParams
    );

    const totalGestiones = Number(rows[0]?.total_gestiones || 0);
    const costoPorGestion =
      costoOperativo !== null && totalGestiones > 0
        ? Number((costoOperativo / totalGestiones).toFixed(2))
        : null;

    res.json({
      data: {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        total_gestiones: totalGestiones,
        costo_operativo: costoOperativo,
        costo_por_gestion: costoPorGestion,
        kpi: {
          clave: 'costo_gestion',
          nombre: 'Costo por Gestión',
          valor: costoPorGestion,
          unidad: 'moneda local',
          descripcion:
            'Costo operativo dividido entre el número de gestiones (visitas). Requiere el parámetro ?costo_operativo=N.',
          disponible: costoOperativo !== null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reportes/kpis/resumen
 *
 * Consolidado de los 6 KPIs del marco teórico en una sola respuesta.
 * Filtros: ?empresa_id &fecha_desde &fecha_hasta &costo_operativo
 */
const getKpisResumen = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = rangoFechas(req.query);
    const { rol, id: userId, empresaId } = req.user;
    const { empresa_id, costo_operativo } = req.query;

    const costoOperativo = costo_operativo ? Number(costo_operativo) : null;

    // ── Filtros de rol ──
    // - morosidad/cartera: filtran por empresa (cr.empresa_id)
    // - visitas/cobertura: filtran por cobrador (vc.cobrador_id / u.empresa_id)
    const isAdminSuper = rol === 'ADMIN' || rol === 'SUPERVISOR';
    let empresaFiltro = isAdminSuper ? Number(empresa_id || empresaId) : null;
    const cobradorFiltro = rol === 'COBRADOR' ? Number(userId) : null;

    // Para COBRADOR: resolver su empresa para acotar morosidad y cartera
    if (cobradorFiltro !== null && empresaFiltro === null) {
      const [userRows] = await pool.query('SELECT empresa_id FROM usuarios WHERE id = ?', [cobradorFiltro]);
      empresaFiltro = userRows[0] ? Number(userRows[0].empresa_id) : null;
    }

    // Condiciones por contexto
    const condEmpresa = [];
    const paramsEmpresa = [];
    if (empresaFiltro !== null) {
      condEmpresa.push('cr.empresa_id = ?');
      paramsEmpresa.push(empresaFiltro);
    }

    const condCobrador = [];
    const paramsCobrador = [];
    if (cobradorFiltro !== null) {
      condCobrador.push('vc.cobrador_id = ?');
      paramsCobrador.push(cobradorFiltro);
    }

    // ── 1. Índice de Morosidad (cuotas vencidas / cuotas activas) ──
    const whereMorosidad = ['cu.estado = ?', 'cu.saldo_cuota > 0', ...condEmpresa];
    const [morosidadRows] = await pool.query(
      `SELECT
         COUNT(CASE WHEN cu.fecha_vencimiento < ? THEN cu.id END) AS cuotas_vencidas,
         COUNT(cu.id) AS cuotas_activas,
         COALESCE(SUM(CASE WHEN cu.fecha_vencimiento < ? THEN cu.saldo_cuota END), 0) AS monto_vencido,
         COALESCE(SUM(cu.saldo_cuota), 0) AS monto_activo
       FROM cuotas cu
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       WHERE ${whereMorosidad.join(' AND ')}`,
      [fechaHasta, fechaHasta, 'PENDIENTE', ...paramsEmpresa]
    );
    const cuotasVencidas = Number(morosidadRows[0]?.cuotas_vencidas || 0);
    const cuotasActivas = Number(morosidadRows[0]?.cuotas_activas || 0);
    const montoVencido = Number(morosidadRows[0]?.monto_vencido || 0);
    const montoActivo = Number(morosidadRows[0]?.monto_activo || 0);
    const indiceMorosidad = cuotasActivas > 0 ? (cuotasVencidas / cuotasActivas) * 100 : 0;
    const morosidadMonto = montoActivo > 0 ? (montoVencido / montoActivo) * 100 : 0;

    // ── 2 y 6. Efectividad + Tasa de Reagendamiento (visitas en período) ──
    const condVisitas = [];
    const paramsVisitas = [];
    if (empresaFiltro !== null) {
      condVisitas.push('u.empresa_id = ?');
      paramsVisitas.push(empresaFiltro);
    }
    if (cobradorFiltro !== null) {
      condVisitas.push('vc.cobrador_id = ?');
      paramsVisitas.push(cobradorFiltro);
    }
    if (req.query.cobrador_id) {
      condVisitas.push('vc.cobrador_id = ?');
      paramsVisitas.push(Number(req.query.cobrador_id));
    }

    const whereVisitas = [
      'vc.fecha_hora >= ?',
      'vc.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)',
      ...condVisitas,
    ];
    const [visitasRows] = await pool.query(
      `SELECT
         COUNT(vc.id) AS total_visitas,
         COUNT(CASE WHEN vc.resultado = 'cobrado' THEN vc.id END) AS visitas_cobradas,
         COUNT(CASE WHEN vc.resultado = 'reagendado' THEN vc.id END) AS visitas_reagendadas,
         COUNT(CASE WHEN vc.resultado = 'ausente' THEN vc.id END) AS visitas_ausentes,
         COALESCE(SUM(CASE WHEN vc.resultado = 'cobrado' THEN vc.monto_cobrado END), 0) AS monto_cobrado
       FROM visitas_cobro vc
       INNER JOIN usuarios u ON u.id = vc.cobrador_id
       WHERE ${whereVisitas.join(' AND ')}`,
      [`${fechaDesde} 00:00:00`, fechaHasta, ...paramsVisitas]
    );
    const totalVisitas = Number(visitasRows[0]?.total_visitas || 0);
    const visitasCobradas = Number(visitasRows[0]?.visitas_cobradas || 0);
    const visitasReagendadas = Number(visitasRows[0]?.visitas_reagendadas || 0);
    const montoCobrado = Number(visitasRows[0]?.monto_cobrado || 0);

    const efectividad = totalVisitas > 0 ? (visitasCobradas / totalVisitas) * 100 : 0;
    const tasaReagendamiento = totalVisitas > 0 ? (visitasReagendadas / totalVisitas) * 100 : 0;

    // ── 3. Rotación de Cartera ──
    const whereCartera = ['cr.estado = ?', ...condEmpresa];
    const [carteraRows] = await pool.query(
      `SELECT COALESCE(SUM(cr.saldo_actual), 0) AS saldo_vigente
         FROM creditos cr
         WHERE ${whereCartera.join(' AND ')}`,
      ['ACTIVO', ...paramsEmpresa]
    );
    const saldoVigente = Number(carteraRows[0]?.saldo_vigente || 0);
    const diasPeriodo = Math.max(
      1,
      Math.round((new Date(fechaHasta) - new Date(fechaDesde)) / 86400000) + 1
    );
    const rotacion = saldoVigente > 0 ? montoCobrado / saldoVigente : 0;
    const rotacionAnual = rotacion * (365 / diasPeriodo);
    const diasPromedioCobro = rotacionAnual > 0 ? 365 / rotacionAnual : null;

    // ── 4. Cobertura de Cobro ──
    const condCobertura = [];
    const paramsCobertura = [];
    if (empresaFiltro !== null) {
      condCobertura.push('cr.empresa_id = ?');
      paramsCobertura.push(empresaFiltro);
    }
    if (cobradorFiltro !== null) {
      condCobertura.push('a.usuario_id = ?');
      paramsCobertura.push(cobradorFiltro);
    }
    if (req.query.cobrador_id) {
      condCobertura.push('a.usuario_id = ?');
      paramsCobertura.push(Number(req.query.cobrador_id));
    }

    const whereCobertura = [
      'a.fecha_asignacion >= ?',
      'a.fecha_asignacion < DATE_ADD(?, INTERVAL 1 DAY)',
      ...condCobertura,
    ];
    const [coberturaRows] = await pool.query(
      `SELECT
         COUNT(DISTINCT a.id) AS total_asignaciones,
         COUNT(DISTINCT CASE WHEN vc.id IS NOT NULL THEN a.id END) AS asignaciones_con_visita
       FROM asignaciones a
       INNER JOIN cuotas cu ON cu.id = a.cuota_id
       INNER JOIN creditos cr ON cr.id = cu.credito_id
       LEFT JOIN visitas_cobro vc ON vc.asignacion_id = a.id
       WHERE ${whereCobertura.join(' AND ')}`,
      [`${fechaDesde} 00:00:00`, fechaHasta, ...paramsCobertura]
    );
    const totalAsignaciones = Number(coberturaRows[0]?.total_asignaciones || 0);
    const asignacionesConVisita = Number(coberturaRows[0]?.asignaciones_con_visita || 0);
    const cobertura = totalAsignaciones > 0 ? (asignacionesConVisita / totalAsignaciones) * 100 : 0;

    // ── 5. Costo por Gestión ──
    const costoPorGestion =
      costoOperativo !== null && totalVisitas > 0
        ? Number((costoOperativo / totalVisitas).toFixed(2))
        : null;

    res.json({
      data: {
        periodo: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
        kpis: [
          {
            clave: 'indice_morosidad',
            nombre: 'Índice de Morosidad',
            valor: Number(indiceMorosidad.toFixed(2)),
            unidad: '%',
            descripcion: 'Cuotas vencidas sobre cuotas activas (por cantidad y por monto).',
            detalle: {
              cuotas_vencidas: cuotasVencidas,
              cuotas_activas: cuotasActivas,
              monto_vencido: montoVencido,
              monto_activo: montoActivo,
              morosidad_por_monto: Number(morosidadMonto.toFixed(2)),
            },
          },
          {
            clave: 'efectividad_cobro',
            nombre: 'Efectividad de Cobro',
            valor: Number(efectividad.toFixed(2)),
            unidad: '%',
            descripcion: 'Visitas con cobro sobre el total de visitas en el período.',
            detalle: {
              visitas_cobradas: visitasCobradas,
              total_visitas: totalVisitas,
              monto_cobrado: montoCobrado,
            },
          },
          {
            clave: 'rotacion_cartera',
            nombre: 'Rotación de Cartera',
            valor: Number(rotacionAnual.toFixed(4)),
            unidad: 'veces/año',
            descripcion: 'Monto cobrado sobre cartera vigente, anualizado.',
            detalle: {
              monto_cobrado: montoCobrado,
              cartera_vigente: saldoVigente,
              rotacion_periodo: Number(rotacion.toFixed(4)),
              dias_promedio_cobro: diasPromedioCobro === null ? null : Number(diasPromedioCobro.toFixed(1)),
            },
          },
          {
            clave: 'cobertura_cobro',
            nombre: 'Cobertura de Cobro',
            valor: Number(cobertura.toFixed(2)),
            unidad: '%',
            descripcion: 'Asignaciones con al menos una visita sobre el total asignado.',
            detalle: {
              asignaciones_con_visita: asignacionesConVisita,
              total_asignaciones: totalAsignaciones,
            },
          },
          {
            clave: 'costo_gestion',
            nombre: 'Costo por Gestión',
            valor: costoPorGestion,
            unidad: 'moneda local',
            descripcion:
              'Costo operativo entre gestiones. Requiere ?costo_operativo=N (el sistema no registra costos).',
            detalle: {
              costo_operativo: costoOperativo,
              total_gestiones: totalVisitas,
            },
          },
          {
            clave: 'tasa_reagendamiento',
            nombre: 'Tasa de Reagendamiento',
            valor: Number(tasaReagendamiento.toFixed(2)),
            unidad: '%',
            descripcion: 'Visitas reagendadas sobre el total de visitas en el período.',
            detalle: {
              visitas_reagendadas: visitasReagendadas,
              total_visitas: totalVisitas,
            },
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRotacionCartera,
  getCoberturaCobro,
  getTasaReagendamiento,
  getCostoGestion,
  getKpisResumen,
};
