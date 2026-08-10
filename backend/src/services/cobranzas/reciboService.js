const { createServiceError } = require('./serviceError');
const { getNextReciboNumber } = require('./numeradorService');
const { toMysqlLocal } = require('./time');

const assertTimbradoVigente = (cajaContext, fechaOperacion) => {
  if (cajaContext.mode !== 'v12') {
    return;
  }

  const hoyLocal = new Date(
    new Date(fechaOperacion || Date.now()).toLocaleString('en-US', { timeZone: 'America/Asuncion' })
  );
  const inicio = cajaContext.fecha_inicio ? new Date(cajaContext.fecha_inicio) : null;
  const fin = cajaContext.fecha_fin ? new Date(cajaContext.fecha_fin) : null;

  if (cajaContext.timbrado_estado !== 'VIGENTE') {
    throw createServiceError(409, 'El timbrado de la caja no está vigente');
  }
  if (inicio && hoyLocal < inicio) {
    throw createServiceError(409, 'El timbrado de la caja todavía no inició su vigencia');
  }
  if (fin && hoyLocal > fin) {
    throw createServiceError(409, 'El timbrado de la caja está vencido');
  }
};

const maybeCreateRecibo = async (conn, {
  cajaContext,
  visitaId,
  asignacion,
  cobradorId,
  monto,
  fechaHora,
}) => {
  if (cajaContext.mode !== 'v12') {
    return null;
  }

  assertTimbradoVigente(cajaContext, fechaHora);

  const numeracion = await getNextReciboNumber(conn, cajaContext);
  const fechaEmision = toMysqlLocal(fechaHora);
  const importe = Number(monto);
  const saldoAnterior = Number(
    cajaContext.apertura_saldo_actual
      ?? cajaContext.caja_saldo_actual
      ?? cajaContext.saldo_inicial
      ?? 0
  );
  const saldoPosterior = saldoAnterior + importe;
  const concepto = `Cobro cuota N. ${asignacion.numero_cuota} - Credito ${asignacion.numero_credito || asignacion.credito_id}`;

  const [reciboResult] = await conn.query(
    `INSERT INTO recibos
       (empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id,
        caja_id, caja_apertura_id, cobrador_id, cliente_id, numerador_id,
        visita_cobro_id, numero_secuencia, numero_recibo, estado,
        fecha_emision, moneda, total_recibo, tipo_emision, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITIDO', ?, 'PYG', ?, 'IMPRESO', ?, ?)`,
    [
      asignacion.empresa_id,
      cajaContext.timbrado_id,
      cajaContext.establecimiento_id,
      cajaContext.punto_expedicion_id,
      cajaContext.caja_id,
      cajaContext.caja_apertura_id,
      cobradorId,
      asignacion.cliente_id,
      numeracion.numeradorId,
      visitaId,
      numeracion.numeroSecuencia,
      numeracion.numeroRecibo,
      fechaEmision,
      importe,
      cobradorId,
      cobradorId,
    ]
  );

  const reciboId = reciboResult.insertId;

  await conn.query(
    `INSERT INTO recibo_detalles
       (recibo_id, cuota_id, credito_id, concepto, cantidad, monto_unitario, monto_total, orden_detalle, created_by, updated_by)
     VALUES (?, ?, ?, ?, 1, ?, ?, 1, ?, ?)`,
    [
      reciboId,
      asignacion.cuota_id,
      asignacion.credito_id,
      concepto,
      importe,
      importe,
      cobradorId,
      cobradorId,
    ]
  );

  await conn.query(
    `INSERT INTO caja_movimientos
       (empresa_id, caja_id, caja_apertura_id, recibo_id, tipo_movimiento, sentido_saldo,
        importe, saldo_anterior, saldo_posterior, descripcion, referencia_tabla, referencia_id,
        fecha_hora_movimiento, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'COBRANZA', 'SUMA', ?, ?, ?, ?, 'visitas_cobro', ?, ?, ?, ?)`,
    [
      asignacion.empresa_id,
      cajaContext.caja_id,
      cajaContext.caja_apertura_id,
      reciboId,
      importe,
      saldoAnterior,
      saldoPosterior,
      concepto,
      visitaId,
      fechaEmision,
      cobradorId,
      cobradorId,
    ]
  );

  await conn.query(
    `UPDATE caja_aperturas
     SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [saldoPosterior, cobradorId, cajaContext.caja_apertura_id]
  );

  await conn.query(
    `UPDATE cajas
     SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [saldoPosterior, cobradorId, cajaContext.caja_id]
  );

  await conn.query(
    `UPDATE visitas_cobro
     SET recibo_id = ?
     WHERE id = ?`,
    [reciboId, visitaId]
  );

  return {
    reciboId,
    numeroRecibo: numeracion.numeroRecibo,
  };
};

module.exports = {
  maybeCreateRecibo,
};