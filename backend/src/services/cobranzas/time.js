const toMysqlLocal = (isoOrMs) =>
  new Date(isoOrMs || Date.now())
    .toLocaleString('sv-SE', { timeZone: 'America/Asuncion' })
    .replace('T', ' ');

const toDateLocal = (isoOrMs) =>
  new Date(isoOrMs || Date.now())
    .toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

const todayLocal = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

/**
 * Normaliza un valor de fecha proveniente de query string.
 * Si ya viene en formato YYYY-MM-DD (fecha local, sin hora), se devuelve
 * tal cual — reinterpretarlo con toDateLocal() lo trataría como UTC
 * medianoche y lo correría un día hacia atrás en America/Asuncion.
 * Para cualquier otro formato (timestamp, ISO con hora, etc.) se delega
 * a toDateLocal().
 */
const normalizeDateStr = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return toDateLocal(value);
};

module.exports = {
  toMysqlLocal,
  toDateLocal,
  todayLocal,
  normalizeDateStr,
};