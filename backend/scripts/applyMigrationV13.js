#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const migrationPath = path.resolve(__dirname, '../../database/migracion_v13_intereses_config_empresa.sql');

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

const getColumnType = async (conn, tableName, columnName) => {
  const [rows] = await conn.query(
    `SELECT column_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows[0]?.column_type?.toLowerCase() || null;
};

const hasIndex = async (conn, tableName, indexName) => {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
};

const hasForeignKey = async (conn, tableName, constraintName) => {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = ?
       AND constraint_type = 'FOREIGN KEY'
     LIMIT 1`,
    [tableName, constraintName]
  );
  return rows.length > 0;
};

const ensureColumn = async (conn, tableName, columnName, ddl) => {
  if (!(await hasColumn(conn, tableName, columnName))) {
    await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
};

const ensureIndex = async (conn, tableName, indexName, ddl) => {
  if (!(await hasIndex(conn, tableName, indexName))) {
    await conn.query(`ALTER TABLE ${tableName} ADD ${ddl}`);
  }
};

const ensureForeignKey = async (conn, tableName, constraintName, ddl) => {
  if (!(await hasForeignKey(conn, tableName, constraintName))) {
    await conn.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${ddl}`);
  }
};

const ensureAuditColumns = async (conn, tableName) => {
  await ensureColumn(conn, tableName, 'created_at', 'created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn(conn, tableName, 'updated_at', 'updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn(conn, tableName, 'deleted_at', 'deleted_at DATETIME NULL');
  await ensureColumn(conn, tableName, 'created_by', 'created_by BIGINT NULL');
  await ensureColumn(conn, tableName, 'updated_by', 'updated_by BIGINT NULL');

  if ((await getColumnType(conn, tableName, 'created_by')) !== 'bigint') {
    await conn.query(`ALTER TABLE ${tableName} MODIFY COLUMN created_by BIGINT NULL`);
  }
  if ((await getColumnType(conn, tableName, 'updated_by')) !== 'bigint') {
    await conn.query(`ALTER TABLE ${tableName} MODIFY COLUMN updated_by BIGINT NULL`);
  }
};

const sanitizeMigrationSql = (sql) => sql
  .replace(/START TRANSACTION;[\r\n]*/i, '')
  .replace(/COMMIT;[\r\n]*/i, '')
  .replace(/ALTER TABLE empresas[\s\S]*?;\s*ALTER TABLE usuarios[\s\S]*?;\s*/i, '')
  .replace(/ALTER TABLE cuotas[\s\S]*?;\s*/i, '')
  .replace(/empresa_id\s+INT NOT NULL/g, 'empresa_id                BIGINT NOT NULL')
  .replace(/empresa_id\s+INT NULL/g, 'empresa_id                BIGINT NULL')
  .replace(/created_by\s+INT NULL/g, 'created_by                BIGINT NULL')
  .replace(/updated_by\s+INT NULL/g, 'updated_by                BIGINT NULL');

const ensureCuotasIntereses = async (conn) => {
  await ensureColumn(conn, 'cuotas', 'interes_acumulado', 'interes_acumulado DECIMAL(12,2) NOT NULL DEFAULT 0.00');
  await ensureColumn(conn, 'cuotas', 'dias_retraso', 'dias_retraso INT NOT NULL DEFAULT 0');
};

const main = async () => {
  const conn = await getConnection();
  try {
    const rawSql = fs.readFileSync(migrationPath, 'utf8');
    const sanitizedSql = sanitizeMigrationSql(rawSql);
    await conn.query(sanitizedSql);

    // Campos de intereses sobre cuotas legacy (MySQL no soporta
    // ADD COLUMN IF NOT EXISTS: se aplican con helpers idempotentes)
    await ensureCuotasIntereses(conn);

    console.log('migracion-v13-aplicada');
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
