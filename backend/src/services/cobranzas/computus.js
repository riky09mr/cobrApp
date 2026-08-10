/**
 * computus.js — Cálculo de feriados móviles de Paraguay.
 *
 * - Pascua (Domingo de Resurrección) por el algoritmo gregoriano de
 *   Meeus / Jones / Butcher ("Anonymous Gregorian Algorithm"), el mismo
 *   método que usa la Iglesia Católica para fijar la Pascua.
 * - Semana Santa: Jueves Santo (Pascua - 3) y Viernes Santo (Pascua - 2),
 *   inamovibles (no se trasladan).
 * - Traslados según Ley 6631/2020: los feriados que caen martes se corren
 *   al lunes anterior; miércoles o jueves al lunes siguiente. Los que caen
 *   lunes, viernes, sábado o domingo se quedan en su fecha.
 */

/**
 * Convierte una fecha a 'YYYY-MM-DD' (hora local, medianoche).
 * @param {Date} date
 * @returns {string}
 */
const toISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Suma dias naturales a una fecha local.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Parsea 'YYYY-MM-DD' a Date local (medianoche).
 * @param {string} str
 * @returns {Date}
 */
const parseDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Domingo de Resurrección (Pascua) del año gregoriano indicado.
 * Algoritmo de Meeus / Jones / Butcher (Anonymous Gregorian Algorithm).
 *
 * @param {number} year
 * @returns {string} 'YYYY-MM-DD'
 */
const easterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISODate(new Date(year, month - 1, day));
};

/**
 * Fechas de la Semana Santa para un año.
 * @param {number} year
 * @returns {{ jueves_santo: string, viernes_santo: string, sabado_santo: string, domingo_resurreccion: string }}
 */
const holyWeek = (year) => {
  const pascua = parseDate(easterSunday(year));
  return {
    jueves_santo: toISODate(addDays(pascua, -3)),
    viernes_santo: toISODate(addDays(pascua, -2)),
    sabado_santo: toISODate(addDays(pascua, -1)),
    domingo_resurreccion: toISODate(pascua),
  };
};

/**
 * Aplica el traslado de feriados de la Ley 6631/2020:
 * - Martes (2) → lunes anterior (-1).
 * - Miércoles (3) o jueves (4) → lunes siguiente (+7 - dia + 1).
 * - Lunes (1), viernes (5), sábado (6), domingo (0) → sin cambio.
 *
 * @param {string} fechaStr 'YYYY-MM-DD'
 * @returns {string} Fecha efectiva de descanso 'YYYY-MM-DD'
 */
const aplicarTraslado = (fechaStr) => {
  const d = parseDate(fechaStr);
  const dia = d.getDay();
  if (dia === 2) return toISODate(addDays(d, -1)); // martes → lunes anterior
  if (dia === 3 || dia === 4) return toISODate(addDays(d, 7 - dia + 1)); // miércoles/jueves → lunes siguiente
  return fechaStr; // lunes, viernes, sábado, domingo se mantienen
};

/**
 * Feriados móviles de Paraguay para un año:
 * - Jueves Santo y Viernes Santo (según la Pascua, inamovibles).
 * - Traslados de Día de los Héroes (1/3), Paz del Chaco (12/6) y
 *   Fundación de Asunción (15/8) según Ley 6631/2020.
 *
 * @param {number} year
 * @returns {Array<{ origen: string, fecha: string, descripcion: string }>}
 */
const feriadosMoviblesParaguay = (year) => {
  const semana = holyWeek(year);
  const fijosTrasladables = [
    { origen: 'traslado_heroes', fecha: `${year}-03-01`, descripcion: 'Día de los Héroes (trasladado)' },
    { origen: 'traslado_paz_chaco', fecha: `${year}-06-12`, descripcion: 'Día de la Paz del Chaco (trasladado)' },
    { origen: 'traslado_fundacion_asuncion', fecha: `${year}-08-15`, descripcion: 'Fundación de Asunción (trasladado)' },
  ];

  return [
    { origen: 'jueves_santo', fecha: semana.jueves_santo, descripcion: 'Jueves Santo (Semana Santa)' },
    { origen: 'viernes_santo', fecha: semana.viernes_santo, descripcion: 'Viernes Santo (Semana Santa)' },
    ...fijosTrasladables.map(({ origen, fecha, descripcion }) => ({
      origen,
      fecha: aplicarTraslado(fecha),
      descripcion,
    })),
  ];
};

module.exports = {
  toISODate,
  addDays,
  parseDate,
  easterSunday,
  holyWeek,
  aplicarTraslado,
  feriadosMoviblesParaguay,
};
