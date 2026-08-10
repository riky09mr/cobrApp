const pool = require('../../config/db');
const { holyWeek } = require('./computus');

/**
 * Fecha de "hoy" en zona horaria de Paraguay (America/Asuncion).
 */
const todayLocal = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

/**
 * Feriados fijos de Paraguay (descripciones del seed V13).
 * Se cargan cada año en su fecha original; el admin puede editar
 * la fecha de un año puntual. Al iniciar un nuevo año vuelven a su
 * fecha original automáticamente.
 */
const FERIADOS_FIJOS = [
  { descripcion: 'Año Nuevo', mes: 1, dia: 1 },
  { descripcion: 'Día de los Héroes de la Patria', mes: 3, dia: 2 },
  { descripcion: 'Día de los Trabajadores', mes: 5, dia: 1 },
  { descripcion: 'Día de la Independencia Nacional', mes: 5, dia: 14 },
  { descripcion: 'Día de la Independencia y Día de la Madre', mes: 5, dia: 15 },
  { descripcion: 'Día de la Paz del Chaco', mes: 6, dia: 12 },
  { descripcion: 'Día de la Jura de la Constitución Nacional', mes: 6, dia: 22 },
  { descripcion: 'Día de la Fundación de Asunción', mes: 8, dia: 15 },
  { descripcion: 'Día de la Batalla de Boquerón', mes: 9, dia: 28 },
  { descripcion: 'Día de la Virgen de Caacupé', mes: 12, dia: 8 },
  { descripcion: 'Navidad', mes: 12, dia: 25 },
];

const iso = (anio, mes, dia) =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/**
 * Plantilla de feriados de un año para una empresa:
 * 11 feriados fijos + Jueves Santo + Viernes Santo (Computus).
 * Cada item: { fecha, descripcion, origen, fecha_original }.
 */
const feriadosPlantilla = (anio) => {
  const semana = holyWeek(anio);
  const fijos = FERIADOS_FIJOS.map(({ descripcion, mes, dia }) => {
    const fecha = iso(anio, mes, dia);
    return { fecha, descripcion, origen: 'MANUAL', fecha_original: fecha };
  });
  const moviles = [
    {
      fecha: semana.jueves_santo,
      descripcion: 'Jueves Santo',
      origen: 'jueves_santo',
      fecha_original: semana.jueves_santo,
    },
    {
      fecha: semana.viernes_santo,
      descripcion: 'Viernes Santo',
      origen: 'viernes_santo',
      fecha_original: semana.viernes_santo,
    },
  ];
  return [...fijos, ...moviles];
};

/**
 * Sincroniza los feriados de una empresa para un año:
 * 1. Desactiva (soft delete) los feriados activos de años anteriores.
 * 2. Inserta la plantilla del año (fijos + Semana Santa), reactivando
 *    filas que ya existan para la misma fecha (ON DUPLICATE KEY).
 * Los feriados por decreto del año en curso NO se tocan.
 */
const sincronizarFeriadosAnio = async (empresaId, anio) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Años anteriores: se desactivan para que no aparezcan (el UNIQUE KEY
    // (empresa_id, fecha) obliga a mantener la fila, no borrarla).
    await conn.query(
      `UPDATE empresas_feriados
       SET deleted_at = NOW()
       WHERE empresa_id = ? AND deleted_at IS NULL AND YEAR(fecha) < ?`,
      [empresaId, anio]
    );

    for (const item of feriadosPlantilla(anio)) {
      await conn.query(
        `INSERT INTO empresas_feriados
           (empresa_id, fecha, descripcion, origen, fecha_original, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)
         ON DUPLICATE KEY UPDATE
           descripcion = VALUES(descripcion),
           origen = VALUES(origen),
           fecha_original = VALUES(fecha_original),
           deleted_at = NULL,
           updated_at = NOW()`,
        [empresaId, item.fecha, item.descripcion, item.origen, item.fecha_original]
      );
    }

    await conn.commit();
    return feriadosPlantilla(anio).length;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Sincroniza los feriados del año para todas las empresas activas.
 * Lo ejecuta el cron del 1 de enero (y el lazy check del GET).
 */
const sincronizarTodasEmpresas = async (anio) => {
  const anioFinal = anio || Number(todayLocal().slice(0, 4));
  const [empresas] = await pool.query(
    'SELECT id FROM empresas WHERE estado = TRUE ORDER BY id'
  );
  const resultados = [];
  for (const empresa of empresas) {
    const generados = await sincronizarFeriadosAnio(empresa.id, anioFinal);
    resultados.push({ empresa_id: empresa.id, generados });
  }
  return { anio: anioFinal, empresas: resultados };
};

module.exports = {
  FERIADOS_FIJOS,
  todayLocal,
  feriadosPlantilla,
  sincronizarFeriadosAnio,
  sincronizarTodasEmpresas,
};
