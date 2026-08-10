const pool = require('../../config/db');

/**
 * Fecha de "hoy" en zona horaria de Paraguay (America/Asuncion).
 * Se usa para la fecha de corte por defecto en los recálculos.
 */
const todayLocal = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

/**
 * Convierte 'YYYY-MM-DD' o Date a un Date local (medianoche).
 */
const parseDate = (value) => {
  const str = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Suma n dias naturales a una fecha local.
 */
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Cuenta los dias efectivos de retraso entre la fecha de inicio
 * (vencimiento + dias de gracia) y la fecha de corte, recorriendo
 * dia por dia para poder excluir domingos y/o feriados.
 *
 * @param {Date} inicio   Primer dia en que el interes empieza a correr.
 * @param {Date} corte    Fecha de corte (inclusive).
 * @param {Set<string>} feriados  Fechas 'YYYY-MM-DD' de feriados de la empresa.
 * @param {boolean} contarDomingos Si false, los domingos no cuentan.
 * @param {boolean} contarFeriados Si false, los feriados no cuentan.
 * @returns {number} Dias habiles de retraso (nunca negativo).
 */
const contarDiasEfectivos = (inicio, corte, feriados, contarDomingos, contarFeriados) => {
  if (corte < inicio) return 0;

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let dias = 0;
  for (let d = new Date(inicio); d <= corte; d.setDate(d.getDate() + 1)) {
    const esDomingo = d.getDay() === 0;
    if (!contarDomingos && esDomingo) continue;
    if (!contarFeriados && feriados.has(fmt(d))) continue;
    dias += 1;
  }
  return dias;
};

/**
 * Obtiene la configuracion de intereses de una empresa.
 * Si no existe (caso extremo), devuelve la configuracion por defecto.
 */
const getConfig = async (empresaId) => {
  const [[row]] = await pool.query(
    `SELECT empresa_id, generar_interes, dias_gracia, porcentaje_interes_diario,
            contar_domingos, contar_feriados
     FROM empresas_intereses_config
     WHERE empresa_id = ?
     LIMIT 1`,
    [empresaId]
  );
  if (!row) {
    return {
      empresa_id: empresaId,
      generar_interes: 0,
      dias_gracia: 0,
      porcentaje_interes_diario: 0,
      contar_domingos: 0,
      contar_feriados: 0,
    };
  }
  return {
    ...row,
    generar_interes: Number(row.generar_interes),
    contar_domingos: Number(row.contar_domingos),
    contar_feriados: Number(row.contar_feriados),
  };
};

/**
 * Obtiene las fechas de feriados de la empresa como Set de 'YYYY-MM-DD'.
 */
const getFeriados = async (empresaId) => {
  const [rows] = await pool.query(
    `SELECT fecha
     FROM empresas_feriados
     WHERE empresa_id = ? AND deleted_at IS NULL`,
    [empresaId]
  );
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return new Set(rows.map((r) => fmt(new Date(r.fecha))));
};

/**
 * Calcula el interes de una cuota vencida al corte indicado.
 *
 * Regla:
 *   dias_efectivos = dias habiles entre (fecha_vencimiento + dias_gracia)
 *                    y la fecha de corte, excluyendo domingos si
 *                    contar_domingos = 0 y feriados si contar_feriados = 0.
 *   interes = saldo_cuota * (porcentaje_interes_diario / 100) * dias_efectivos
 *
 * @param {object} cuota  { id, saldo_cuota, fecha_vencimiento, estado }
 * @param {number} empresaId
 * @param {string} fechaCorte  'YYYY-MM-DD' (default hoy en America/Asuncion)
 * @returns {Promise<{ diasRetraso: number, interes: number }>}
 */
const calcularInteresCuota = async (cuota, empresaId, fechaCorte = todayLocal()) => {
  const config = await getConfig(empresaId);

  // Sin configuracion de interes activa o sin saldo pendiente: no genera nada.
  if (!config.generar_interes || Number(cuota.saldo_cuota) <= 0) {
    return { diasRetraso: 0, interes: 0 };
  }

  const corte = parseDate(fechaCorte);
  const vencimiento = parseDate(cuota.fecha_vencimiento);
  const inicio = addDays(vencimiento, Number(config.dias_gracia) + 1); // el interes corre al dia siguiente del ultimo dia de luz

  if (corte < inicio) {
    return { diasRetraso: 0, interes: 0 };
  }

  const feriados = await getFeriados(empresaId);
  const diasRetraso = contarDiasEfectivos(
    inicio,
    corte,
    feriados,
    Boolean(config.contar_domingos),
    Boolean(config.contar_feriados)
  );

  if (diasRetraso <= 0) {
    return { diasRetraso: 0, interes: 0 };
  }

  const porcentaje = Number(config.porcentaje_interes_diario) / 100;
  const interes = Number(cuota.saldo_cuota) * porcentaje * diasRetraso;

  return { diasRetraso, interes: Math.round(interes * 100) / 100 };
};

/**
 * Recalcula interes_acumulado y dias_retraso de todas las cuotas
 * vencidas (no pagadas) de una empresa, hasta la fecha de corte.
 * No toca cuotas pagadas.
 *
 * @param {number} empresaId
 * @param {string} fechaCorte 'YYYY-MM-DD'
 * @returns {Promise<{ procesadas: number, actualizadas: number }>}
 */
const recalcularInteresesEmpresa = async (empresaId, fechaCorte = todayLocal()) => {
  const config = await getConfig(empresaId);
  if (!config.generar_interes) {
    // Si la empresa no genera interes, limpiamos los acumulados de
    // cuotas aun no pagadas para no dejar valores obsoletos.
    const [result] = await pool.query(
      `UPDATE cuotas
       SET interes_acumulado = 0.00, dias_retraso = 0, updated_at = NOW()
       WHERE credito_id IN (SELECT id FROM creditos WHERE empresa_id = ?)
         AND estado IN ('PENDIENTE','VENCIDA')
         AND (interes_acumulado <> 0.00 OR dias_retraso <> 0)`,
      [empresaId]
    );
    return { procesadas: 0, actualizadas: result.affectedRows };
  }

  // Estado en mayusculas (PENDIENTE/VENCIDA) para consistencia con cuotas.
  const [rows] = await pool.query(
    `SELECT cu.id, cu.saldo_cuota, cu.fecha_vencimiento, cu.estado
     FROM cuotas cu
     INNER JOIN creditos cr ON cr.id = cu.credito_id
     WHERE cr.empresa_id = ?
       AND cu.estado IN ('PENDIENTE','VENCIDA')
       AND cu.saldo_cuota > 0
       AND cu.fecha_vencimiento < ?`,
    [empresaId, fechaCorte]
  );

  const feriados = await getFeriados(empresaId);
  const corte = parseDate(fechaCorte);
  const procesadas = rows.length;
  let actualizadas = 0;

  for (const cuota of rows) {
    const vencimiento = parseDate(cuota.fecha_vencimiento);
    const inicio = addDays(vencimiento, Number(config.dias_gracia) + 1);
    const diasRetraso = corte < inicio
      ? 0
      : contarDiasEfectivos(
          inicio,
          corte,
          feriados,
          Boolean(config.contar_domingos),
          Boolean(config.contar_feriados)
        );

    const interes = diasRetraso > 0
      ? Math.round(Number(cuota.saldo_cuota) * (Number(config.porcentaje_interes_diario) / 100) * diasRetraso * 100) / 100
      : 0;

    await pool.query(
      `UPDATE cuotas
       SET interes_acumulado = ?, dias_retraso = ?, updated_at = NOW()
       WHERE id = ?`,
      [interes, diasRetraso, cuota.id]
    );
    actualizadas += 1;
  }

  return { procesadas, actualizadas };
};

module.exports = {
  todayLocal,
  contarDiasEfectivos,
  getConfig,
  getFeriados,
  calcularInteresCuota,
  recalcularInteresesEmpresa,
};
