#!/usr/bin/env node
/**
 * Migración v18 — Eliminación de la tabla `gestiones`
 *
 * Precondición: la migración v17 confirmó que todas las filas de `gestiones`
 * ya tienen su equivalente en `visitas_cobro` (0 huérfanas). El DROP de la
 * tabla no implica pérdida de datos: `visitas_cobro` es la fuente de verdad.
 *
 * Idempotente: si la tabla no existe, no hace nada.
 *
 * Uso:
 *   node backend/scripts/applyMigrationV18.js
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
    const [tablas] = await conn.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE LOWER(table_schema) = LOWER(DATABASE())
         AND table_name = 'gestiones'`
    );

    if (tablas.length === 0) {
      console.log('v18: la tabla gestiones ya no existe — nada que hacer');
      return;
    }

    // Verificación previa: ninguna gestión sin equivalente en visitas_cobro
    const [huerfanas] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM gestiones g
       WHERE NOT EXISTS (
         SELECT 1 FROM visitas_cobro vc WHERE vc.asignacion_id = g.asignacion_id
       )`
    );
    const totalHuerfanas = Number(huerfanas[0].total);
    if (totalHuerfanas > 0) {
      throw new Error(
        `v18: ABORTADO — hay ${totalHuerfanas} filas en gestiones sin equivalente en visitas_cobro. ` +
        `Ejecute primero applyMigrationV17.js`
      );
    }

    await conn.query('DROP TABLE IF EXISTS `gestiones`');
    console.log('migracion-v18-aplicada (tabla gestiones eliminada)');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
