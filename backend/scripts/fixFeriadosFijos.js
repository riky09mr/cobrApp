/**
 * Corrige el catálogo de feriados fijos ya generado en la base de datos
 * tras la actualización de FERIADOS_FIJOS (feriadosAnualService.js):
 *  - Agrega "Día de los Héroes de la Patria" (2/3) y "Día de la Jura de
 *    la Constitución Nacional" (22/6), que faltaban.
 *  - Corrige la fecha del feriado de Boquerón: era 29/09, es 28/09.
 *  - Renombra los feriados fijos ya existentes a su nombre completo.
 *
 * Se puede ejecutar más de una vez sin problema (usa INSERT ... ON
 * DUPLICATE KEY UPDATE, no borra ni duplica datos).
 */
require('dotenv').config();
const pool = require('../src/config/db');
const { feriadosPlantilla } = require('../src/services/cobranzas/feriadosAnualService');

async function upsertPlantilla(empresaId, anio) {
  let n = 0;
  for (const item of feriadosPlantilla(anio)) {
    const [result] = await pool.query(
      `INSERT INTO empresas_feriados
         (empresa_id, fecha, descripcion, origen, fecha_original, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)
       ON DUPLICATE KEY UPDATE
         descripcion = VALUES(descripcion),
         origen = VALUES(origen),
         fecha_original = VALUES(fecha_original),
         deleted_at = NULL,
         updated_at = NOW()`,
      [empresaId, item.fecha, item.descripcion, item.origen, item.fecha_original]
    );
    if (result.affectedRows > 0) n += 1;
  }
  return n;
}

async function main() {
  // 1) Corrige la fecha del feriado de Boquerón (estaba en 29/09, es 28/09).
  //    Si no se corrige la fecha primero, el sync de abajo insertaría una
  //    fila nueva en 28/09 y dejaría la vieja de 29/09 huérfana.
  const [boqueron] = await pool.query(
    `UPDATE empresas_feriados
     SET fecha = DATE_SUB(fecha, INTERVAL 1 DAY),
         fecha_original = DATE_SUB(fecha_original, INTERVAL 1 DAY),
         updated_at = NOW()
     WHERE origen = 'MANUAL' AND deleted_at IS NULL
       AND MONTH(fecha) = 9 AND DAY(fecha) = 29`
  );
  console.log(`Boquerón: ${boqueron.affectedRows} fila(s) corregida(s) de 29/09 a 28/09.`);

  // 2) Backfill: agrega los feriados fijos faltantes (Héroes de la Patria,
  //    Jura de la Constitución) y refresca los nombres de los ya
  //    existentes, para cada empresa/año que ya tenga feriados generados.
  const [pares] = await pool.query(
    `SELECT DISTINCT empresa_id, YEAR(fecha) AS anio
     FROM empresas_feriados
     WHERE origen IN ('MANUAL', 'jueves_santo', 'viernes_santo') AND deleted_at IS NULL
     ORDER BY empresa_id, anio`
  );

  for (const { empresa_id, anio } of pares) {
    const n = await upsertPlantilla(empresa_id, anio);
    console.log(`empresa ${empresa_id} / ${anio} -> ${n} fila(s) insertada(s)/actualizada(s)`);
  }

  console.log('fix-feriados-fijos-completado');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { upsertPlantilla };
