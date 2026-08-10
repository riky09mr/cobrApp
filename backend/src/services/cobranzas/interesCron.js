const pool = require('../../config/db');
const {
  recalcularInteresesEmpresa,
  todayLocal,
} = require('./interesService');

/**
 * Cron diario de intereses por mora.
 *
 * Recorre todas las empresas con generar_interes = 1 y recalcula
 * interes_acumulado y dias_retraso de sus cuotas vencidas con la
 * fecha de corte = hoy (America/Asuncion).
 *
 * Se ejecuta vía node-cron a las 02:00 AM (America/Asuncion).
 */
const recalcularInteresesTodasEmpresas = async () => {
  const fechaCorte = todayLocal();

  const [empresas] = await pool.query(
    `SELECT empresa_id
     FROM empresas_intereses_config
     WHERE generar_interes = 1`
  );

  if (empresas.length === 0) {
    console.log('[Cron intereses] Ninguna empresa con generar_interes = 1.');
    return { fecha_corte: fechaCorte, empresas: [] };
  }

  const resultados = [];
  for (const { empresa_id } of empresas) {
    try {
      const res = await recalcularInteresesEmpresa(empresa_id, fechaCorte);
      resultados.push({ empresa_id, ...res });
      console.log(
        `[Cron intereses] Empresa ${empresa_id}: ${res.procesadas} cuotas procesadas, ${res.actualizadas} actualizadas.`
      );
    } catch (error) {
      console.error(`[Cron intereses] Error en empresa ${empresa_id}:`, error.message);
      resultados.push({ empresa_id, error: error.message });
    }
  }

  return { fecha_corte: fechaCorte, empresas: resultados };
};

module.exports = { recalcularInteresesTodasEmpresas };
