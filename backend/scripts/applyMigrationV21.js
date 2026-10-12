#!/usr/bin/env node
/**
 * Migración v21 — Sistema de Permisos por Vista
 *
 * Crea las tablas `permisos`, `rol_permisos` y `usuario_permisos`,
 * y siembra el catálogo de permisos y los permisos por defecto de
 * cada rol (SUPERVISOR y COBRADOR; ADMIN se maneja en código).
 *
 * Idempotente: usa CREATE TABLE IF NOT EXISTS e INSERT IGNORE.
 *
 * Uso:
 *   node backend/scripts/applyMigrationV21.js
 */
require('dotenv').config();

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
    const sqlPath = path.join(__dirname, '../../database/migracion_v21_permisos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await conn.query(sql);
    console.log('migracion-v21-aplicada (tablas de permisos creadas y sembradas)');
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
