const { createServiceError } = require('./serviceError');

const getNextReciboNumber = async (conn, cajaContext) => {
  if (cajaContext.mode !== 'v12') {
    return null;
  }

  const [[numerador]] = await conn.query(
    `SELECT
       id,
       numero_desde,
       numero_hasta,
       ultimo_numero_asignado,
       activo,
       bloqueado,
       serie
     FROM numeradores
     WHERE empresa_id = ?
       AND timbrado_id = ?
       AND establecimiento_id = ?
       AND punto_expedicion_id = ?
       AND tipo_documento = 'RECIBO_COBRANZA'
       AND activo = 1
       AND bloqueado = 0
       AND deleted_at IS NULL
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [
      cajaContext.empresa_id,
      cajaContext.timbrado_id,
      cajaContext.establecimiento_id,
      cajaContext.punto_expedicion_id,
    ]
  );

  if (!numerador) {
    throw createServiceError(409, 'No existe Numerador activo para la caja y el punto de expedición');
  }

  const ultimoAsignado = Number(numerador.ultimo_numero_asignado || 0);
  const numeroDesde = Number(numerador.numero_desde || 1);
  const numeroHasta = Number(numerador.numero_hasta || 99999999);
  const siguienteNumero = Math.max(ultimoAsignado + 1, numeroDesde);

  if (siguienteNumero > numeroHasta) {
    throw createServiceError(409, 'El numerador activo alcanzó su límite autorizado');
  }

  await conn.query(
    `UPDATE numeradores
     SET ultimo_numero_asignado = ?, updated_at = NOW()
     WHERE id = ?`,
    [siguienteNumero, numerador.id]
  );

  return {
    numeradorId: numerador.id,
    serie: numerador.serie,
    numeroSecuencia: siguienteNumero,
    numeroRecibo: `${String(cajaContext.establecimiento_codigo).padStart(3, '0')}-${String(cajaContext.punto_codigo).padStart(3, '0')}-${String(siguienteNumero).padStart(8, '0')}`,
  };
};

module.exports = {
  getNextReciboNumber,
};