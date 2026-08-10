const REQUIRED_V12_TABLES = [
  'cajas',
  'caja_aperturas',
  'timbrados',
  'establecimientos',
  'puntos_expedicion',
  'numeradores',
  'recibos',
  'recibo_detalles',
  'caja_movimientos',
];

const getExistingTables = async (conn, tableNames = REQUIRED_V12_TABLES) => {
  const placeholders = tableNames.map(() => '?').join(', ');
  const [rows] = await conn.query(
    `SELECT table_name AS table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN (${placeholders})`,
    tableNames
  );
  return new Set(rows.map((row) => row.table_name));
};

const hasAllTables = (existingTables, tableNames = REQUIRED_V12_TABLES) =>
  tableNames.every((tableName) => existingTables.has(tableName));

module.exports = {
  REQUIRED_V12_TABLES,
  getExistingTables,
  hasAllTables,
};