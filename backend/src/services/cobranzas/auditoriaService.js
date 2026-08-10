const pool = require('../../config/db');

/**
 * Registra una entrada en la bitácora transversal `auditoria`.
 *
 * Diseñado para usarse tanto con una conexión propia de transacción
 * (participa en el commit/rollback) como con el pool global
 * (fire-and-forget: no rompe el flujo principal si falla).
 *
 * @param {Object} options
 * @param {import('mysql2/promise').PoolConnection} [options.conn] Conexión de transacción. Si se omite, usa el pool.
 * @param {number}  [options.empresaId] Contexto multiempresa.
 * @param {number}  [options.usuarioId] Usuario que ejecutó la acción.
 * @param {string}  [options.ip]        IP de origen (req.ip o x-forwarded-for).
 * @param {string}  options.accion      INSERT|UPDATE|DELETE|ANULAR|APERTURAR|CERRAR|LOGIN|LOGOUT|ASIGNAR|DESASIGNAR|EMITIR
 * @param {string}  options.tabla       Tabla afectada (ej: 'cuotas', 'visitas_cobro', 'arqueos_caja').
 * @param {number|string} [options.registroId] PK del registro afectado.
 * @param {Object}  [options.antes]     Estado previo (se serializa a JSON).
 * @param {Object}  [options.despues]   Estado posterior (se serializa a JSON).
 * @param {string}  [options.observaciones] Texto libre.
 * @returns {Promise<number>} id de la fila insertada.
 */
const registrarAuditoria = async ({
  conn,
  empresaId,
  usuarioId,
  ip,
  accion,
  tabla,
  registroId,
  antes,
  despues,
  observaciones,
}) => {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO auditoria
       (empresa_id, usuario_id, ip_origen, accion, tabla_afectada,
        registro_id, datos_antes, datos_despues, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId ?? null,
      usuarioId ?? null,
      ip ?? null,
      accion,
      tabla,
      registroId ?? null,
      antes ? JSON.stringify(antes) : null,
      despues ? JSON.stringify(despues) : null,
      observaciones ?? null,
    ]
  );
  return result.insertId;
};

/**
 * Versión tolerante a fallos: nunca lanza.
 * Útil para hooks donde la auditoría no debe interrumpir el flujo.
 */
const registrarAuditoriaSegura = async (options) => {
  try {
    await registrarAuditoria(options);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[auditoria] no se pudo registrar:', error.message);
  }
};

module.exports = { registrarAuditoria, registrarAuditoriaSegura };
