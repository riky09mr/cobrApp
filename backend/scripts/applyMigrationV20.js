#!/usr/bin/env node
/**
 * Migración v20 — Tabla `push_tokens` para notificaciones push (Expo)
 *
 * Crea la tabla que guarda los tokens de notificación push de cada
 * dispositivo, para poder enviar alertas de cobranzas vencidas o
 * próximas a vencer.
 *
 * Idempotente: usa CREATE TABLE IF NOT EXISTS.
 *
 * Uso:
 *   node backend/scripts/applyMigrationV20.js
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
    const sqlPath = path.join(__dirname, '../../database/migracion_v20_push_tokens.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await conn.query(sql);
    console.log('migracion-v20-aplicada (tabla push_tokens creada)');
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
