const pool = require('../config/db');

// Helpers de hora local Paraguay (America/Asuncion)
const localDatetime = () =>
  new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' }).replace('T', ' ');
const localDate = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

/**
 * Busca cobradores que NO tomaron su descanso obligatorio de almuerzo hoy
 * y lo activa automáticamente.
 *
 * Se ejecuta vía node-cron a la hora hora_fin_auto de cada tipo obligatorio
 * (generalmente 14:30 America/Asuncion).
 */
const activarAlmuerzosAutomaticos = async () => {
  const conn = await pool.getConnection();
  try {
    const hoy = localDate();
    const ahora = localDatetime();

    // Tipos de descanso obligatorios con hora_fin_auto configurada
    const [tipos] = await conn.query(
      `SELECT id, empresa_id, nombre, hora_fin_auto
       FROM tipos_descanso
       WHERE es_obligatorio = 1 AND activo = 1 AND hora_fin_auto IS NOT NULL`
    );

    let activados = 0;

    for (const tipo of tipos) {
      // Cobradores activos de esta empresa (usuarios con rol COBRADOR y estado=1)
      const [cobradores] = await conn.query(
        `SELECT u.id
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         WHERE u.empresa_id = ? AND r.nombre = 'COBRADOR' AND u.estado = 1`,
        [tipo.empresa_id]
      );

      for (const cobrador of cobradores) {
        // Verificar si ya tiene un descanso de este tipo hoy
        const [[yaExiste]] = await conn.query(
          `SELECT id FROM descansos_cobrador
           WHERE cobrador_id = ? AND tipo_descanso_id = ? AND fecha = ?`,
          [cobrador.id, tipo.id, hoy]
        );

        if (yaExiste) continue;

        // No tomó el descanso → activarlo automáticamente
        await conn.query(
          `INSERT INTO descansos_cobrador
             (tipo_descanso_id, cobrador_id, fecha, hora_inicio_real, activado_auto)
           VALUES (?, ?, ?, ?, 1)`,
          [tipo.id, cobrador.id, hoy, ahora]
        );
        activados++;
      }
    }

    console.log(`[Cron almuerzo] ${activados} descansos automáticos activados.`);
    return activados;
  } catch (error) {
    console.error('[Cron almuerzo] Error:', error.message);
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = { activarAlmuerzosAutomaticos };
