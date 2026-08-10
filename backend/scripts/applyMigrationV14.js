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
    // MySQL 8 no soporta ADD COLUMN IF NOT EXISTS: se aplica con helper.
    await ensureColumn(
      conn,
      'empresas_feriados',
      'origen',
      "origen VARCHAR(50) NOT NULL DEFAULT 'MANUAL' COMMENT 'Origen del feriado: MANUAL, jueves_santo, viernes_santo, traslado_heroes, traslado_paz_chaco, traslado_fundacion_asuncion'"
    );

    // Marcar los feriados moviles 2026 ya cargados con su origen.
    await conn.query(
      `UPDATE empresas_feriados
       SET origen = 'jueves_santo'
       WHERE fecha = '2026-04-02' AND deleted_at IS NULL`
    );
    await conn.query(
      `UPDATE empresas_feriados
       SET origen = 'viernes_santo'
       WHERE fecha = '2026-04-03' AND deleted_at IS NULL`
    );

    console.log('migracion-v14-aplicada');
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
