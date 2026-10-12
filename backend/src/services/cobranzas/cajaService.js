const { createServiceError } = require('./serviceError');
const { getExistingTables, hasAllTables } = require('./schemaSupport');

const getCajaContextForCobro = async (conn, { cobradorId }) => {
  const existingTables = await getExistingTables(conn);

  if (hasAllTables(existingTables)) {
    const [[cajaV12]] = await conn.query(
      `SELECT
         ca.id                     AS caja_apertura_id,
         ca.caja_id                AS caja_id,
         ca.saldo_inicial          AS saldo_inicial,
         ca.saldo_actual           AS apertura_saldo_actual,
         ca.fecha_operacion,
         ca.estado                 AS apertura_estado,
         c.empresa_id              AS empresa_id,
         c.nombre                  AS caja_nombre,
         c.estado                  AS caja_estado,
         c.saldo_actual            AS caja_saldo_actual,
         pe.id                     AS punto_expedicion_id,
         pe.codigo                 AS punto_codigo,
         pe.establecimiento_id,
         e.codigo                  AS establecimiento_codigo,
         t.id                      AS timbrado_id,
         t.numero_timbrado,
         t.fecha_inicio,
         t.fecha_fin,
         t.estado                  AS timbrado_estado,
         t.es_electronico
       FROM caja_aperturas ca
       INNER JOIN cajas c              ON c.id = ca.caja_id
       INNER JOIN puntos_expedicion pe ON pe.id = c.punto_expedicion_id
       INNER JOIN establecimientos e   ON e.id = pe.establecimiento_id
       INNER JOIN timbrados t          ON t.id = pe.timbrado_id
       WHERE ca.cobrador_id = ?
         AND ca.estado = 'ABIERTA'
         AND ca.deleted_at IS NULL
         AND c.deleted_at IS NULL
         AND pe.deleted_at IS NULL
         AND e.deleted_at IS NULL
         AND t.deleted_at IS NULL
       ORDER BY ca.id DESC
       LIMIT 1`,
      [cobradorId]
    );

    if (cajaV12) {
      if (cajaV12.caja_estado !== 'ACTIVA') {
        throw createServiceError(409, 'La caja asignada no está activa');
      }

      return {
        mode: 'v12',
        legacyArqueoId: null,
        ...cajaV12,
      };
    }
  }

  const [[cajaLegacy]] = await conn.query(
    `SELECT id FROM arqueos_caja WHERE cobrador_id = ? AND estado = 'ABIERTO' LIMIT 1`,
    [cobradorId]
  );

  if (!cajaLegacy) {
    throw createServiceError(409, 'Debes abrir tu caja antes de registrar cobros');
  }

  return {
    mode: 'legacy',
    legacyArqueoId: cajaLegacy.id,
    caja_apertura_id: null,
    caja_id: null,
    punto_expedicion_id: null,
    establecimiento_id: null,
    timbrado_id: null,
  };
};

module.exports = {
  getCajaContextForCobro,
};