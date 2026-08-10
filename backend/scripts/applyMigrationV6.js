#!/usr/bin/env node
/**
 * Aplica la migración v6 (horarios de cobrador): crea las tablas
 * horarios_cobrador y excepciones_horario, y agrega la columna
 * duracion_minutos a descansos_cobrador si no existe.
 * Idempotente: se puede ejecutar más de una vez sin problema.
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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS horarios_cobrador (
        id           BIGINT       NOT NULL AUTO_INCREMENT,
        cobrador_id  BIGINT       NOT NULL,
        empresa_id   BIGINT       NOT NULL,
        dia_semana   TINYINT      NOT NULL COMMENT '0=Dom 1=Lun 2=Mar 3=Mie 4=Jue 5=Vie 6=Sab',
        hora_inicio  TIME         NOT NULL,
        hora_fin     TIME         NOT NULL,
        activo       TINYINT(1)   DEFAULT 1,
        created_by   BIGINT       NULL COMMENT 'Supervisor que creó el horario',
        created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        UNIQUE KEY uq_horario_dia (cobrador_id, dia_semana),
        CONSTRAINT fk_hc_cobrador  FOREIGN KEY (cobrador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_hc_empresa   FOREIGN KEY (empresa_id)  REFERENCES empresas(id) ON DELETE CASCADE,
        CONSTRAINT fk_hc_creado_by FOREIGN KEY (created_by)  REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_hc_empresa (empresa_id),
        INDEX idx_hc_cobrador (cobrador_id)
      ) COMMENT 'Horario laboral semanal de cada cobrador, configurado por el supervisor';
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS excepciones_horario (
        id           BIGINT       NOT NULL AUTO_INCREMENT,
        cobrador_id  BIGINT       NOT NULL,
        empresa_id   BIGINT       NOT NULL,
        fecha        DATE         NOT NULL COMMENT 'Fecha de la excepción',
        tipo         ENUM('LIBRE','HORARIO_ESPECIAL') NOT NULL DEFAULT 'LIBRE',
        hora_inicio  TIME         NULL COMMENT 'Solo para HORARIO_ESPECIAL',
        hora_fin     TIME         NULL COMMENT 'Solo para HORARIO_ESPECIAL',
        motivo       VARCHAR(255) NULL,
        created_by   BIGINT       NULL,
        created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        UNIQUE KEY uq_excepcion_fecha (cobrador_id, fecha),
        CONSTRAINT fk_exc_cobrador  FOREIGN KEY (cobrador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_exc_empresa   FOREIGN KEY (empresa_id)  REFERENCES empresas(id) ON DELETE CASCADE,
        CONSTRAINT fk_exc_creado_by FOREIGN KEY (created_by)  REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_exc_cobrador_fecha (cobrador_id, fecha)
      ) COMMENT 'Excepciones al horario habitual (días libres o con horario especial)';
    `);

    await ensureColumn(
      conn,
      'descansos_cobrador',
      'duracion_minutos',
      "duracion_minutos INT NULL COMMENT 'Duración en minutos del descanso (calculada al finalizar)' AFTER hora_fin_real"
    );

    console.log('migracion-v6-aplicada');
  } catch (error) {
    console.error(error.sqlMessage || error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
};

if (require.main === module) main();

module.exports = { main };
