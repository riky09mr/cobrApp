/**
 * exportEstructura.js
 * Genera un archivo SQL con la estructura exacta (CREATE TABLE) de todas
 * las tablas de la base de datos, en formato:
 *
 *   -- <base>.nombre_tabla definition
 *
 *   CREATE TABLE `nombre_tabla` ( ... ) ENGINE=...;
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cobrapp',
    charset: 'utf8mb4',
  });

  const dbName = conn.config.database;

  const [tables] = await conn.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`
  );

  let output = '';
  output += '-- =====================================================================\n';
  output += `-- BASE DE DATOS: ${dbName}\n`;
  output += `-- ESTructura completa generada el ${new Date().toISOString()}\n`;
  output += `-- Cantidad de tablas: ${tables.length}\n`;
  output += '-- =====================================================================\n\n';
  output += `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n`;
  output += `USE \`${dbName}\`;\n\n`;

  for (const t of tables) {
    const tableName = t.TABLE_NAME;
    const [rows] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = rows[0]['Create Table'];
    output += `-- ${dbName}.${tableName} definition\n\n`;
    output += createSql + ';\n\n';
  }

  const outPath = path.join(__dirname, '..', '..', 'database', 'cobrapp_estructura_completa.sql');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`✅ Archivo generado: ${outPath}`);
  console.log(`   Tablas exportadas: ${tables.length}`);

  await conn.end();
})().catch((err) => {
  console.error('❌ Error al generar la estructura:', err.message);
  process.exit(1);
});
