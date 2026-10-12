// const pool = require('../config/db');
// const { anularRecibo, generarNotaCreditoPorSobrepago } = require('../services/cobranzas/notaCreditoService');
// const { registrarAuditoriaSegura } = require('../services/cobranzas/auditoriaService');
//
// const getIpCliente = (req) => req.ip || req.headers['x-forwarded-for'] || null;
//
// /**
//  * GET /api/recibos
//  * Lista los recibos de cobranza con filtros opcionales.
//  * Filtros: fechaDesde, fechaHasta, estado, cliente (búsqueda), cobradorId, empresaId
//  */
// const listarRecibos = async (req, res, next) => {
//   try {
//     const {
//       fechaDesde,
//       fechaHasta,
//       estado,
//       busqueda,
//       cobradorId,
//       empresaId,
//       pagina = 1,
//       porPagina = 20,
//     } = req.query;
//
//     const where = [];
//     const params = [];
//
//     // Filtro por empresa (si el usuario no es ADMIN global)
//     if (req.user.rol !== 'ADMIN' && req.user.empresaId) {
//       where.push('r.empresa_id = ?');
//       params.push(req.user.empresaId);
//     } else if (empresaId) {
//       where.push('r.empresa_id = ?');
//       params.push(Number(empresaId));
//     }
//
//     if (fechaDesde) {
//       where.push('r.fecha_emision >= ?');
//       params.push(`${fechaDesde} 00:00:00`);
//     }
//     if (fechaHasta) {
//       where.push('r.fecha_emision <= ?');
//       params.push(`${fechaHasta} 23:59:59`);
//     }
//     if (estado) {
//       where.push('r.estado = ?');
//       params.push(estado);
//     }
//     if (cobradorId) {
//       where.push('r.cobrador_id = ?');
//       params.push(Number(cobradorId));
//     }
//     if (busqueda) {
//       where.push('(cl.nombre LIKE ? OR cl.apellido LIKE ? OR cl.cedula LIKE ? OR r.numero_recibo LIKE ?)');
//       const like = `%${busqueda}%`;
//       params.push(like, like, like, like);
//     }
//
//     const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
//
//     // Total para paginación
//     const [[{ total }]] = await pool.query(
//       `SELECT COUNT(*) AS total
//        FROM recibos r
//        INNER JOIN clientes cl ON cl.id = r.cliente_id
//        ${whereSql}`,
//       params
//     );
//
//     const offset = (Number(pagina) - 1) * Number(porPagina);
//
//     const [recibos] = await pool.query(
//       `SELECT
//          r.id,
//          r.numero_recibo,
//          r.estado,
//          r.fecha_emision,
//          r.total_recibo,
//          r.moneda,
//          r.aplico_nota_credito,
//          r.monto_sobrepago,
//          r.saldo_a_favor,
//          r.nota_credito_id,
//          r.motivo_anulacion,
//          r.fecha_anulacion,
//          r.tipo_emision,
//          r.cdc,
//          cl.nombre AS cliente_nombre,
//          cl.apellido AS cliente_apellido,
//          cl.cedula AS cliente_cedula,
//          u.nombre AS cobrador_nombre,
//          u.apellido AS cobrador_apellido,
//          mp.nombre AS medio_pago_nombre,
//          vc.monto_cobrado,
//          vc.nro_comprobante,
//          q.numero_cuota,
//          q.monto_cuota,
//          cr.numero_credito,
//          e.razon_social AS empresa_nombre
//        FROM recibos r
//        INNER JOIN clientes cl ON cl.id = r.cliente_id
//        LEFT JOIN usuarios u ON u.id = r.cobrador_id
//        LEFT JOIN visitas_cobro vc ON vc.id = r.visita_cobro_id
//        LEFT JOIN medios_pago mp ON mp.id = vc.medio_pago_id
//        LEFT JOIN asignaciones a ON a.id = vc.asignacion_id
//        LEFT JOIN cuotas q ON q.id = a.cuota_id
//        LEFT JOIN creditos cr ON cr.id = q.credito_id
//        LEFT JOIN empresas e ON e.id = r.empresa_id
//        ${whereSql}
//        ORDER BY r.fecha_emision DESC, r.id DESC
//        LIMIT ? OFFSET ?`,
//       [...params, Number(porPagina), offset]
//     );
//
//     return res.json({
//       data: recibos,
//       total,
//       pagina: Number(pagina),
//       porPagina: Number(porPagina),
//     });
//   } catch (error) {
//     return next(error);
//   }
// };

// /**
//  * POST /api/recibos/:id/nota-credito
//  * Genera una nota de crédito manual por sobrepago.
//  * El recibo NO se anula; solo se registra el sobrepago y se genera la NC.
//  */
// const generarNotaCreditoManual = async (req, res, next) => {
//   const conn = await pool.getConnection();
//   try {
//     const { id } = req.params;
//     const { monto_real_cobrado, motivo } = req.body;
//     const usuarioId = req.user.id;
//
//     if (!monto_real_cobrado || Number(monto_real_cobrado) <= 0) {
//       return res.status(400).json({ message: 'El monto real cobrado es obligatorio y debe ser mayor a 0' });
//     }
//     if (!motivo || !motivo.trim()) {
//       return res.status(400).json({ message: 'El motivo de la nota de crédito es obligatorio' });
//     }
//
//     await conn.beginTransaction();
//
//     const resultado = await generarNotaCreditoPorSobrepago(conn, {
//       reciboId: Number(id),
//       montoRealCobrado: Number(monto_real_cobrado),
//       motivo: motivo.trim(),
//       usuarioId,
//     });
//
//     await registrarAuditoriaSegura(conn, {
//       usuarioId,
//       empresaId: req.user.empresaId,
//       accion: 'GENERAR_NOTA_CREDITO',
//       entidad: 'facturas_nota_credito',
//       entidadId: resultado.notaCreditoId,
//       detalle: `Nota de crédito ${resultado.numeroNC} generada por sobrepago de ${resultado.montoSobrepago} Gs. en recibo ${id}`,
//       ip: getIpCliente(req),
//     });
//
//     await conn.commit();
//
//     return res.json({
//       message: 'Nota de crédito generada correctamente',
//       notaCreditoId: resultado.notaCreditoId,
//       numeroNC: resultado.numeroNC,
//       montoSobrepago: resultado.montoSobrepago,
//     });
//   } catch (error) {
//     await conn.rollback();
//     return next(error);
//   } finally {
//     conn.release();
//   }
// };
//
// /**
//  * POST /api/recibos/:id/anular
//  * Anula manualmente un recibo de cobranza.
//  * Revierte la cuota a PENDIENTE, marca la visita como anulada,
//  * revierte la caja y opcionalmente genera nota de crédito.
//  */
// const anularReciboController = async (req, res, next) => {
//   const conn = await pool.getConnection();
//   try {
//     const { id } = req.params;
//     const { motivo, generar_nota_credito } = req.body;
//     const usuarioId = req.user.id;
//
//     if (!motivo || !motivo.trim()) {
//       return res.status(400).json({ message: 'El motivo de anulación es obligatorio' });
//     }
//
//     await conn.beginTransaction();
//
//     const resultado = await anularRecibo(conn, {
//       reciboId: Number(id),
//       motivo: motivo.trim(),
//       usuarioId,
//       generarNotaCredito: Boolean(generar_nota_credito),
//     });
//
//     await registrarAuditoriaSegura(conn, {
//       usuarioId,
//       empresaId: req.user.empresaId,
//       accion: 'ANULAR_RECIBO',
//       entidad: 'recibos',
//       entidadId: resultado.reciboId,
//       detalle: `Recibo ${resultado.numeroRecibo} anulado manualmente. Motivo: ${motivo.trim()}`,
//       ip: getIpCliente(req),
//     });
//
//     await conn.commit();
//
//     return res.json({
//       message: 'Recibo anulado correctamente',
//       reciboId: resultado.reciboId,
//       numeroRecibo: resultado.numeroRecibo,
//       notaCreditoId: resultado.notaCreditoId,
//     });
//   } catch (error) {
//     await conn.rollback();
//     return next(error);
//   } finally {
//     conn.release();
//   }
// };

// /**
//  * GET /api/recibos/:id
//  * Obtiene el detalle de un recibo (para consulta/anulación).
//  */
// const getRecibo = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//
//     const [[recibo]] = await pool.query(
//       `SELECT
//          r.id,
//          r.numero_recibo,
//          r.estado,
//          r.fecha_emision,
//          r.total_recibo,
//          r.moneda,
//          r.motivo_anulacion,
//          r.fecha_anulacion,
//          r.aplico_nota_credito,
//          r.monto_sobrepago,
//          r.saldo_a_favor,
//          r.nota_credito_id,
//          r.tipo_emision,
//          r.cdc,
//          cl.nombre AS cliente_nombre,
//          cl.apellido AS cliente_apellido,
//          cl.cedula AS cliente_cedula,
//          u.nombre AS cobrador_nombre,
//          u.apellido AS cobrador_apellido,
//          vc.id AS visita_cobro_id,
//          vc.monto_cobrado,
//          vc.anulada AS visita_anulada,
//          q.numero_cuota,
//          q.monto_cuota,
//          q.estado AS cuota_estado,
//          cr.numero_credito
//        FROM recibos r
//        INNER JOIN clientes cl ON cl.id = r.cliente_id
//        LEFT JOIN usuarios u ON u.id = r.cobrador_id
//        LEFT JOIN visitas_cobro vc ON vc.id = r.visita_cobro_id
//        LEFT JOIN asignaciones a ON a.id = vc.asignacion_id
//        LEFT JOIN cuotas q ON q.id = a.cuota_id
//        LEFT JOIN creditos cr ON cr.id = q.credito_id
//        WHERE r.id = ?`,
//       [Number(id)]
//     );
//
//     if (!recibo) {
//       return res.status(404).json({ message: 'Recibo no encontrado' });
//     }
//
//     return res.json(recibo);
//   } catch (error) {
//     return next(error);
//   }
// };
//
// module.exports = {
//   anularReciboController,
//   getRecibo,
//   listarRecibos,
//   generarNotaCreditoManual,
// };
