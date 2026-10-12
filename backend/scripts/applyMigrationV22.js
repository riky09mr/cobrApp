#!/usr/bin/env node
/**
 * Migración v22 — Permiso medios_pago:ver para COBRADOR
 *
 * Otorga al rol COBRADOR el permiso de lectura de medios de pago
 * (medios_pago:ver). Sin este permiso, la app móvil no puede cargar
 * la lista de métodos de pago al confirmar un cobro.
 *
 * Idempotente: usa INSERT IGNORE.
 *
 * Uso:
 *   node backend/scripts/applyMigrationV22.js
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
    const sqlPath = path.join(__dirname, '../../database/migracion_v22_medios_pago_cobrador.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await conn.query(sql);
    console.log('migracion-v22-aplicada (permiso medios_pago:ver otorgado a COBRADOR)');
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
