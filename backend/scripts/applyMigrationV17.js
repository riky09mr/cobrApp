#!/usr/bin/env node
/**
 * Migración v17 — Unificación de fuentes de verdad: gestiones → visitas_cobro
 *
 * Objetivo: la tabla `gestiones` era una fuente de verdad duplicada de las
 * cobranzas. `visitas_cobro` es el modelo canónico (tiene resultado ENUM,
 * medio_pago_id, arqueo_id, nro_comprobante, foto, coordenadas, etc.).
 *
 * Esta migración (idempotente) copia a `visitas_cobro` cualquier fila de
 * `gestiones` que NO tenga ya una visita equivalente (misma asignacion_id),
 * para no perder datos históricos. Después queda a criterio del equipo
 * eliminar la tabla `gestiones` (o conservarla como legacy).
 *
 * Uso:
 *   node backend/scripts/applyMigrationV17.js
 */
require('dotenv').config();

const mysql = require('mysql2/promise');

const getConnection = async () => mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

const main = async () => {
  const conn = await getConnection();
  try {
    console.log(`v17: conectado a base '${process.env.DB_NAME}'`);
    // 1. Verificar que ambas tablas existen
    //    (LOWER() porque el .env puede tener el nombre con mayúsculas: 'cobrApp' vs 'cobrapp')
    const [tablas] = await conn.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE LOWER(table_schema) = LOWER(DATABASE())
         AND table_name IN ('gestiones', 'visitas_cobro')`
    );
    console.log('v17: tablas encontradas →', JSON.stringify(tablas));
    const nombres = tablas.map((t) => t.TABLE_NAME || t.table_name);
    if (!nombres.includes('gestiones') || !nombres.includes('visitas_cobro')) {
      console.log('v17: una de las tablas no existe — nada que hacer');
      return;
    }

    // 2. Insertar gestiones huérfanas (sin visita equivalente por asignacion_id)
    //    El resultado se conserva si la gestión ya traía 'cobrado'/'ausente'/'reagendado';
    //    en gestiones legacy quedó NULL → asumimos 'cobrado' (todas tienen monto > 0).
    const [result] = await conn.query(
      `INSERT INTO visitas_cobro
         (asignacion_id, cobrador_id, resultado, monto_cobrado,
          latitud, longitud, fecha_hora, created_at)
       SELECT
         g.asignacion_id,
         g.usuario_id,
         COALESCE(
           CASE WHEN g.resultado IN ('cobrado','ausente','reagendado') THEN g.resultado END,
           'cobrado'
         ),
         g.monto_cobrado,
         g.latitud,
         g.longitud,
         g.fecha_gestion,
         g.fecha_gestion
       FROM gestiones g
       WHERE NOT EXISTS (
         SELECT 1 FROM visitas_cobro vc WHERE vc.asignacion_id = g.asignacion_id
       )`
    );

    console.log(`migracion-v17-aplicada (visitas_cobro insertadas: ${result.affectedRows})`);
  } catch (error) {
    console.error(error.sqlMessage || error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
