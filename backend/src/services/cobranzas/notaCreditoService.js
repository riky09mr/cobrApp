// ============================================================================
// NOTA DE CRÉDITO — DESACTIVADO (funcionalidad innecesaria)
// Todo el módulo de nota de crédito fue comentado por decisión del usuario.
// La generación automática de recibos al pagar se mantiene activa.
// ============================================================================
// const { createServiceError } = require('./serviceError');
// const { toMysqlLocal } = require('./time');
//
// /**
//  * Detecta si hay sobrepago comparando el monto pagado contra el saldo de la cuota.
//  * @param {number} montoPagado - Monto total recibido del cliente
//  * @param {number} saldoCuota - Saldo pendiente de la cuota
//  * @returns {{ sobrepago: boolean, excedente: number }}
//  */
// const detectarSobrepago = (montoPagado, saldoCuota) => {
//   const monto = Number(montoPagado) || 0;
//   const saldo = Number(saldoCuota) || 0;
//   const excedente = monto - saldo;
//   return {
//     sobrepago: excedente > 0,
//     excedente: excedente > 0 ? excedente : 0,
//   };
// };

// /**
//  * Registra un saldo a favor del cliente generado por sobrepago.
//  * @param {import('mysql2/promise').PoolConnection} conn
//  * @param {object} params
//  * @param {number} params.empresaId
//  * @param {number} params.clienteId
//  * @param {number} params.reciboId
//  * @param {number} params.monto
//  * @param {number} params.usuarioId
//  * @returns {Promise<number>} id del saldo a favor creado
//  */
// const crearSaldoAFavor = async (conn, { empresaId, clienteId, reciboId, monto, usuarioId }) => {
//   const [result] = await conn.query(
//     `INSERT INTO saldos_a_favor
//        (empresa_id, cliente_id, recibo_id, monto, estado, created_by, updated_by)
//      VALUES (?, ?, ?, ?, 'DISPONIBLE', ?, ?)`,
//     [empresaId, clienteId, reciboId, Number(monto), usuarioId, usuarioId]
//   );
//   return result.insertId;
// };

// /**
//  * Anula un recibo de cobranza de forma manual.
//  * Revierte la cuota a PENDIENTE, marca la visita como anulada,
//  * revierte el movimiento de caja y actualiza los saldos.
//  *
//  * @param {import('mysql2/promise').PoolConnection} conn
//  * @param {object} params
//  * @param {number} params.reciboId - ID del recibo a anular
//  * @param {string} params.motivo - Motivo de la anulación (requerido por DNIT)
//  * @param {number} params.usuarioId - Usuario que realiza la anulación
//  * @param {boolean} params.generarNotaCredito - Si se debe generar NC fiscal
//  * @returns {Promise<object>} { reciboId, numeroRecibo, notaCreditoId }
//  */
// const anularRecibo = async (conn, {
//   reciboId,
//   motivo,
//   usuarioId,
//   generarNotaCredito = false,
// }) => {
//   // 1. Obtener el recibo con toda la información necesaria
//   const [[recibo]] = await conn.query(
//     `SELECT
//        r.id,
//        r.empresa_id,
//        r.caja_id,
//        r.caja_apertura_id,
//        r.cobrador_id,
//        r.cliente_id,
//        r.visita_cobro_id,
//        r.numero_recibo,
//        r.total_recibo,
//        r.estado,
//        r.monto_sobrepago,
//        r.saldo_a_favor,
//        r.timbrado_id,
//        r.establecimiento_id,
//        r.punto_expedicion_id,
//        r.numerador_id,
//        r.fecha_emision,
//        vc.asignacion_id,
//        vc.monto_cobrado,
//        vc.anulada AS visita_anulada
//      FROM recibos r
//      LEFT JOIN visitas_cobro vc ON vc.id = r.visita_cobro_id
//      WHERE r.id = ?
//      FOR UPDATE`,
//     [reciboId]
//   );
//
//   if (!recibo) {
//     throw createServiceError(404, 'Recibo no encontrado');
//   }
//
//   if (recibo.estado !== 'EMITIDO') {
//     throw createServiceError(409, `El recibo ya está ${recibo.estado.toLowerCase()}`);
//   }
//
//   if (!recibo.visita_cobro_id) {
//     throw createServiceError(409, 'El recibo no tiene una visita de cobro asociada');
//   }
//
//   // 2. Obtener la cuota asociada a la visita
//   const [[asignacion]] = await conn.query(
//     `SELECT a.cuota_id, a.id AS asignacion_id
//      FROM visitas_cobro vc
//      INNER JOIN asignaciones a ON a.id = vc.asignacion_id
//      WHERE vc.id = ?`,
//     [recibo.visita_cobro_id]
//   );
//
//   if (!asignacion) {
//     throw createServiceError(404, 'No se encontró la asignación asociada al recibo');
//   }
//
//   const [[cuota]] = await conn.query(
//     `SELECT q.id, q.monto_cuota, q.saldo_cuota, q.estado, q.fecha_pago
//      FROM cuotas q
//      WHERE q.id = ?`,
//     [asignacion.cuota_id]
//   );
//
//   if (!cuota) {
//     throw createServiceError(404, 'Cuota no encontrada');
//   }
//
//   // 3. Revertir la cuota a PENDIENTE con su saldo original
//   await conn.query(
//     `UPDATE cuotas
//      SET estado = 'PENDIENTE',
//          saldo_cuota = ?,
//          fecha_pago = NULL,
//          updated_at = NOW()
//      WHERE id = ?`,
//     [cuota.monto_cuota, cuota.id]
//   );
//
//   // 4. Marcar la visita como anulada
//   await conn.query(
//     `UPDATE visitas_cobro
//      SET anulada = 1
//      WHERE id = ?`,
//     [recibo.visita_cobro_id]
//   );
//
//   // 5. Si la asignación estaba COMPLETADO, volverla a PENDIENTE
//   await conn.query(
//     `UPDATE asignaciones
//      SET estado = 'PENDIENTE'
//      WHERE id = ? AND estado = 'COMPLETADO'`,
//     [recibo.visita_cobro_id ? asignacion.asignacion_id : null]
//   );
//
//   // 6. Anular el recibo
//   const fechaAnulacion = toMysqlLocal(new Date());
//   await conn.query(
//     `UPDATE recibos
//      SET estado = 'ANULADO',
//          motivo_anulacion = ?,
//          fecha_anulacion = ?,
//          updated_at = NOW(),
//          updated_by = ?
//      WHERE id = ?`,
//     [motivo, fechaAnulacion, usuarioId, reciboId]
//   );
//
//   // 7. Revertir el movimiento de caja (COBRANZA -> ANULACION con RESTA)
//   const importe = Number(recibo.total_recibo);
//   const [[movimientoOriginal]] = await conn.query(
//     `SELECT saldo_anterior, saldo_posterior
//      FROM caja_movimientos
//      WHERE recibo_id = ? AND tipo_movimiento = 'COBRANZA'
//      ORDER BY id DESC
//      LIMIT 1`,
//     [reciboId]
//   );
//
//   const saldoAnterior = movimientoOriginal
//     ? Number(movimientoOriginal.saldo_posterior)
//     : Number(recibo.total_recibo);
//   const saldoPosterior = movimientoOriginal
//     ? Number(movimientoOriginal.saldo_anterior)
//     : 0;
//
//   await conn.query(
//     `INSERT INTO caja_movimientos
//        (empresa_id, caja_id, caja_apertura_id, recibo_id, tipo_movimiento, sentido_saldo,
//         importe, saldo_anterior, saldo_posterior, descripcion, referencia_tabla, referencia_id,
//         fecha_hora_movimiento, created_by, updated_by)
//      VALUES (?, ?, ?, ?, 'ANULACION', 'RESTA', ?, ?, ?, ?, 'recibos', ?, ?, ?, ?)`,
//     [
//       recibo.empresa_id,
//       recibo.caja_id,
//       recibo.caja_apertura_id,
//       reciboId,
//       importe,
//       saldoAnterior,
//       saldoPosterior,
//       `Anulación recibo ${recibo.numero_recibo}: ${motivo}`,
//       reciboId,
//       fechaAnulacion,
//       usuarioId,
//       usuarioId,
//     ]
//   );
//
//   // 8. Actualizar saldos de caja
//   await conn.query(
//     `UPDATE caja_aperturas
//      SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
//      WHERE id = ?`,
//     [saldoPosterior, usuarioId, recibo.caja_apertura_id]
//   );
//
//   await conn.query(
//     `UPDATE cajas
//      SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
//      WHERE id = ?`,
//     [saldoPosterior, usuarioId, recibo.caja_id]
//   );
//
//   // 9. Si hay saldo a favor asociado, anularlo también
//   if (Number(recibo.saldo_a_favor) > 0) {
//     await conn.query(
//       `UPDATE saldos_a_favor
//        SET estado = 'ANULADO', updated_at = NOW(), updated_by = ?
//        WHERE recibo_id = ? AND estado = 'DISPONIBLE'`,
//       [usuarioId, reciboId]
//     );
//   }
//
//   // 10. Si se solicita generar nota de crédito
//   let notaCreditoId = null;
//   if (generarNotaCredito) {
//     notaCreditoId = await generarNotaCreditoFiscal(conn, {
//       recibo,
//       motivo,
//       usuarioId,
//     });
//   }
//
//   return {
//     reciboId,
//     numeroRecibo: recibo.numero_recibo,
//     notaCreditoId,
//   };
// };

// /**
//  * Genera una nota de crédito fiscal para el recibo anulado.
//  * Requiere un numerador de tipo NOTA_CREDITO configurado.
//  *
//  * @param {import('mysql2/promise').PoolConnection} conn
//  * @param {object} params
//  * @param {object} params.recibo - Datos del recibo a anular
//  * @param {string} params.motivo - Motivo de la anulación
//  * @param {number} params.usuarioId
//  * @returns {Promise<number>} id de la nota de crédito
//  */
// const generarNotaCreditoFiscal = async (conn, { recibo, motivo, usuarioId }) => {
//   // Buscar numerador de NOTA_CREDITO para la empresa/punto
//   const [[numerador]] = await conn.query(
//     `SELECT
//        id,
//        numero_desde,
//        numero_hasta,
//        ultimo_numero_asignado,
//        serie
//      FROM numeradores
//      WHERE empresa_id = ?
//        AND timbrado_id = ?
//        AND establecimiento_id = ?
//        AND punto_expedicion_id = ?
//        AND tipo_documento = 'NOTA_CREDITO'
//        AND activo = 1
//        AND bloqueado = 0
//        AND deleted_at IS NULL
//      ORDER BY id DESC
//      LIMIT 1
//      FOR UPDATE`,
//     [
//       recibo.empresa_id,
//       recibo.timbrado_id,
//       recibo.establecimiento_id,
//       recibo.punto_expedicion_id,
//     ]
//   );
//
//   if (!numerador) {
//     throw createServiceError(
//       409,
//       'No existe numerador de NOTA_CREDITO configurado para este punto de expedición'
//     );
//   }
//
//   const ultimoAsignado = Number(numerador.ultimo_numero_asignado || 0);
//   const numeroDesde = Number(numerador.numero_desde || 1);
//   const numeroHasta = Number(numerador.numero_hasta || 99999999);
//   const siguienteNumero = Math.max(ultimoAsignado + 1, numeroDesde);
//
//   if (siguienteNumero > numeroHasta) {
//     throw createServiceError(409, 'El numerador de NOTA_CREDITO alcanzó su límite autorizado');
//   }
//
//   await conn.query(
//     `UPDATE numeradores
//      SET ultimo_numero_asignado = ?, updated_at = NOW()
//      WHERE id = ?`,
//     [siguienteNumero, numerador.id]
//   );
//
//   const numeroNC = `${String(recibo.establecimiento_id).padStart(3, '0')}-${String(recibo.punto_expedicion_id).padStart(3, '0')}-${String(siguienteNumero).padStart(8, '0')}`;
//
//   const [ncResult] = await conn.query(
//     `INSERT INTO facturas_nota_credito
//        (empresa_id, timbrado_id, factura_id, recibo_id, numero_secuencial, numero_nc,
//         monto_anulado, motivo, fecha_emision, created_at)
//      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NOW())`,
//     [
//       recibo.empresa_id,
//       recibo.timbrado_id,
//       recibo.id,
//       siguienteNumero,
//       numeroNC,
//       Number(recibo.total_recibo),
//       motivo,
//       toMysqlLocal(new Date()),
//     ]
//   );
//
//   const notaCreditoId = ncResult.insertId;
//
//   // Vincular la NC al recibo
//   await conn.query(
//     `UPDATE recibos
//      SET nota_credito_id = ?, aplico_nota_credito = 1, updated_at = NOW(), updated_by = ?
//      WHERE id = ?`,
//     [notaCreditoId, usuarioId, recibo.id]
//   );
//
//   return notaCreditoId;
// };

// /**
//  * Genera una nota de crédito por sobrepago SIN anular el recibo.
//  * Se usa cuando el cliente pagó de más (transferencia/POS) pero el
//  * recibo se emitió por el monto de la cuota. El sobrepago se detecta
//  * manualmente comparando el monto real cobrado contra el total del recibo.
//  *
//  * @param {import('mysql2/promise').PoolConnection} conn
//  * @param {object} params
//  * @param {number} params.reciboId - ID del recibo
//  * @param {number} params.montoRealCobrado - Monto real que el cliente pagó (banco/POS)
//  * @param {string} params.motivo - Motivo de la nota de crédito
//  * @param {number} params.usuarioId
//  * @returns {Promise<object>} { notaCreditoId, numeroNC, montoSobrepago }
//  */
// const generarNotaCreditoPorSobrepago = async (conn, {
//   reciboId,
//   montoRealCobrado,
//   motivo,
//   usuarioId,
// }) => {
//   // 1. Obtener el recibo con FOR UPDATE
//   const [[recibo]] = await conn.query(
//     `SELECT
//        id, empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id,
//        numerador_id, numero_recibo, total_recibo, estado, cliente_id,
//        cobrador_id, caja_id, caja_apertura_id, visita_cobro_id
//      FROM recibos
//      WHERE id = ?
//      FOR UPDATE`,
//     [reciboId]
//   );
//
//   if (!recibo) {
//     throw createServiceError(404, 'Recibo no encontrado');
//   }
//
//   if (recibo.estado !== 'EMITIDO') {
//     throw createServiceError(409, `El recibo está en estado ${recibo.estado}, no se puede generar nota de crédito`);
//   }
//
//   if (Number(recibo.aplico_nota_credito) === 1) {
//     throw createServiceError(409, 'Este recibo ya tiene una nota de crédito aplicada');
//   }
//
//   // 2. Calcular el sobrepago
//   const montoReal = Number(montoRealCobrado) || 0;
//   const totalRecibo = Number(recibo.total_recibo) || 0;
//   const sobrepago = montoReal - totalRecibo;
//
//   if (sobrepago <= 0) {
//     throw createServiceError(400, `El monto real cobrado (${montoReal}) no supera el total del recibo (${totalRecibo}). No hay sobrepago.`);
//   }
//
//   // 3. Buscar numerador de NOTA_CREDITO
//   const [[numerador]] = await conn.query(
//     `SELECT
//        id, numero_desde, numero_hasta, ultimo_numero_asignado, serie
//      FROM numeradores
//      WHERE empresa_id = ?
//        AND timbrado_id = ?
//        AND establecimiento_id = ?
//        AND punto_expedicion_id = ?
//        AND tipo_documento = 'NOTA_CREDITO'
//        AND activo = 1
//        AND bloqueado = 0
//        AND deleted_at IS NULL
//      ORDER BY id DESC
//      LIMIT 1
//      FOR UPDATE`,
//     [
//       recibo.empresa_id,
//       recibo.timbrado_id,
//       recibo.establecimiento_id,
//       recibo.punto_expedicion_id,
//     ]
//   );
//
//   if (!numerador) {
//     throw createServiceError(
//       409,
//       'No existe numerador de NOTA_CREDITO configurado para este punto de expedición'
//     );
//   }
//
//   const ultimoAsignado = Number(numerador.ultimo_numero_asignado || 0);
//   const numeroDesde = Number(numerador.numero_desde || 1);
//   const numeroHasta = Number(numerador.numero_hasta || 99999999);
//   const siguienteNumero = Math.max(ultimoAsignado + 1, numeroDesde);
//
//   if (siguienteNumero > numeroHasta) {
//     throw createServiceError(409, 'El numerador de NOTA_CREDITO alcanzó su límite autorizado');
//   }
//
//   await conn.query(
//     `UPDATE numeradores
//      SET ultimo_numero_asignado = ?, updated_at = NOW()
//      WHERE id = ?`,
//     [siguienteNumero, numerador.id]
//   );
//
//   const numeroNC = `${String(recibo.establecimiento_id).padStart(3, '0')}-${String(recibo.punto_expedicion_id).padStart(3, '0')}-${String(siguienteNumero).padStart(8, '0')}`;
//
//   // 4. Insertar la nota de crédito
//   const [ncResult] = await conn.query(
//     `INSERT INTO facturas_nota_credito
//        (empresa_id, timbrado_id, factura_id, recibo_id, numero_secuencial, numero_nc,
//         monto_anulado, monto_sobrepago, saldo_a_favor, motivo, fecha_emision, created_at)
//      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
//     [
//       recibo.empresa_id,
//       recibo.timbrado_id,
//       reciboId,
//       siguienteNumero,
//       numeroNC,
//       sobrepago,
//       sobrepago,
//       sobrepago,
//       motivo,
//       toMysqlLocal(new Date()),
//     ]
//   );
//
//   const notaCreditoId = ncResult.insertId;
//
//   // 5. Vincular la NC al recibo y actualizar sobrepago/saldo a favor
//   await conn.query(
//     `UPDATE recibos
//      SET nota_credito_id = ?,
//          aplico_nota_credito = 1,
//          monto_sobrepago = ?,
//          saldo_a_favor = ?,
//          updated_at = NOW(),
//          updated_by = ?
//      WHERE id = ?`,
//     [notaCreditoId, sobrepago, sobrepago, usuarioId, reciboId]
//   );
//
//   // 6. Crear saldo a favor para el cliente
//   await crearSaldoAFavor(conn, {
//     empresaId: recibo.empresa_id,
//     clienteId: recibo.cliente_id,
//     reciboId,
//     monto: sobrepago,
//     usuarioId,
//   });
//
//   return {
//     notaCreditoId,
//     numeroNC,
//     montoSobrepago: sobrepago,
//   };
// };
//
// module.exports = {
//   detectarSobrepago,
//   crearSaldoAFavor,
//   anularRecibo,
//   generarNotaCreditoFiscal,
//   generarNotaCreditoPorSobrepago,
// };
