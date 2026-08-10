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

const ensureIndex = async (conn, tableName, indexName, ddl) => {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  if (rows.length === 0) {
    await conn.query(`ALTER TABLE ${tableName} ADD INDEX ${ddl}`);
  }
};

const main = async () => {
  const conn = await getConnection();
  try {
    // --- Columnas nuevas (idempotente) ---
    await ensureColumn(conn, 'auditoria', 'empresa_id', 'empresa_id BIGINT NULL AFTER id');
    await ensureColumn(conn, 'auditoria', 'ip_origen', "ip_origen VARCHAR(45) NULL AFTER usuario_id");
    await ensureColumn(
      conn, 'auditoria', 'accion',
      "accion VARCHAR(20) NOT NULL DEFAULT 'INSERT' COMMENT 'INSERT|UPDATE|DELETE|ANULAR|APERTURAR|CERRAR|LOGIN|LOGOUT|ASIGNAR|DESASIGNAR|EMITIR' AFTER registro_id"
    );
    await ensureColumn(conn, 'auditoria', 'tabla_afectada', 'tabla_afectada VARCHAR(100) NULL AFTER accion');
    await ensureColumn(conn, 'auditoria', 'registro_id', 'registro_id BIGINT NULL AFTER tabla_afectada');
    await ensureColumn(conn, 'auditoria', 'datos_antes', 'datos_antes JSON NULL AFTER detalle');
    await ensureColumn(conn, 'auditoria', 'datos_despues', 'datos_despues JSON NULL AFTER datos_antes');
    await ensureColumn(conn, 'auditoria', 'observaciones', 'observaciones TEXT NULL AFTER datos_despues');
    await ensureColumn(
      conn, 'auditoria', 'fecha_hora_evento',
      'fecha_hora_evento DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER observaciones'
    );
    await ensureColumn(conn, 'auditoria', 'deleted_at', 'deleted_at DATETIME NULL AFTER fecha_hora_evento');
    await ensureColumn(conn, 'auditoria', 'created_by', 'created_by BIGINT NULL AFTER deleted_at');
    await ensureColumn(conn, 'auditoria', 'updated_by', 'updated_by BIGINT NULL AFTER created_by');

    // --- Índices (idempotente) ---
    await ensureIndex(
      conn, 'auditoria', 'idx_auditoria_empresa_fecha',
      'idx_auditoria_empresa_fecha (empresa_id, fecha_hora_evento)'
    );
    await ensureIndex(
      conn, 'auditoria', 'idx_auditoria_tabla_registro',
      'idx_auditoria_tabla_registro (tabla_afectada, registro_id)'
    );
    await ensureIndex(
      conn, 'auditoria', 'idx_auditoria_usuario_fecha',
      'idx_auditoria_usuario_fecha (usuario_id, fecha_hora_evento)'
    );

    console.log('migracion-v16-aplicada');
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
