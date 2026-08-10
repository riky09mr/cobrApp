#!/usr/bin/env node
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

const hasColumn = async (conn, tableName, columnName) => {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
};

const ensureColumn = async (conn, tableName, columnName, ddl) => {
  if (!(await hasColumn(conn, tableName, columnName))) {
    await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
};

const main = async () => {
  const conn = await getConnection();
  try {
    await ensureColumn(
      conn,
      'empresas_feriados',
      'fecha_original',
      "fecha_original DATE NULL COMMENT 'Fecha original del feriado (referencia para el reset anual)' AFTER fecha"
    );

    // Backfill: la fecha original de las filas existentes es su fecha.
    await conn.query(
      'UPDATE empresas_feriados SET fecha_original = fecha WHERE fecha_original IS NULL'
    );

    // Los traslados ya no se generan: se tratan como feriados fijos editables.
    await conn.query(
      `UPDATE empresas_feriados
       SET origen = 'MANUAL'
       WHERE origen IN ('traslado_heroes', 'traslado_paz_chaco', 'traslado_fundacion_asuncion')`
    );

    console.log('migracion-v15-aplicada');
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
