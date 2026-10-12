const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { getCajaContextForCobro } = require('../services/cobranzas/cajaService');
const { maybeCreateRecibo } = require('../services/cobranzas/reciboService');
const { toMysqlLocal, toDateLocal, todayLocal } = require('../services/cobranzas/time');
const { createServiceError } = require('../services/cobranzas/serviceError');
const { registrarAuditoriaSegura } = require('../services/cobranzas/auditoriaService');
// const { detectarSobrepago, crearSaldoAFavor } = require('../services/cobranzas/notaCreditoService');

const getIpCliente = (req) => req.ip || req.headers['x-forwarded-for'] || null;

// ─────────────────────────────────────────────────────────────
// GET /api/cobrador/agenda?fecha=YYYY-MM-DD
// Devuelve las asignaciones pendientes del cobrador para el día
// indicado (por defecto hoy). Incluye lat/lng para el mapa.
// ─────────────────────────────────────────────────────────────
const getAgenda = async (req, res, next) => {
  try {
    const { id: cobradorId } = req.user;
    const fecha = req.query.fecha || todayLocal();
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({ message: 'fecha debe tener formato YYYY-MM-DD' });
    }

    const [rows] = await pool.query(
      `SELECT
         a.id              AS asignacion_id,
         a.fecha_limite,
         a.estado          AS asignacion_estado,
         q.id              AS cuota_id,
         q.numero_cuota,
         q.fecha_vencimiento,
         q.monto_cuota,
         q.saldo_cuota,
         q.estado          AS cuota_estado,
         cr.id             AS credito_id,
         cr.numero_credito,
         cr.descripcion,
         cl.id             AS cliente_id,
         cl.cedula,
         cl.nombre,
         cl.apellido,
         cl.telefono,
         ce.direccion,
         ce.latitud,
         ce.longitud,
         -- última visita registrada para esta asignación (si existe)
         (SELECT vc.resultado
          FROM visitas_cobro vc
          WHERE vc.asignacion_id = a.id
          ORDER BY vc.fecha_hora DESC LIMIT 1) AS ultimo_resultado,
         (SELECT vc.nueva_hora
          FROM visitas_cobro vc
          WHERE vc.asignacion_id = a.id AND vc.resultado = 'reagendado'
            AND DATE(vc.fecha_hora) = ?
          ORDER BY vc.fecha_hora DESC LIMIT 1) AS reagendado_hora
       FROM asignaciones a
       INNER JOIN cuotas q              ON q.id  = a.cuota_id
       INNER JOIN creditos cr           ON cr.id = q.credito_id
       INNER JOIN clientes cl           ON cl.id = cr.cliente_id
       INNER JOIN clientes_empresas ce  ON ce.cliente_id = cl.id
                                       AND ce.empresa_id = cr.empresa_id
       WHERE a.usuario_id = ?
         AND a.estado     = 'PENDIENTE'
         AND q.estado    != 'PAGADO'
         -- Se listan TODAS las asignaciones pendientes del cobrador
         -- (vencidas, de hoy y próximas), sin filtrar por fecha_limite,
         -- porque fecha_limite puede ser NULL y la app ya agrupa
         -- en secciones VENCIDAS / HOY / PRÓXIMAS.
         AND (
           DATE(a.fecha_limite) = ?
           OR a.fecha_limite IS NULL
           OR DATE(a.fecha_limite) <= ?
         )
       ORDER BY q.fecha_vencimiento ASC, cl.nombre ASC
       LIMIT 500`,
      [fecha, cobradorId, fecha, fecha]
    );

    return res.json({ data: rows, fecha });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/cobrador/creditos/:creditoId/cuotas-pendientes
// Devuelve las cuotas pendientes (estado != 'PAGADO') de un crédito
// que están asignadas al cobrador, ordenadas por número de cuota.
// Se usa para que el cobrador pueda pagar varias cuotas a la vez.
// ─────────────────────────────────────────────────────────────
const getCuotasPendientesCredito = async (req, res, next) => {
  try {
    const { id: cobradorId } = req.user;
    const creditoId = Number(req.params.creditoId);

    if (!creditoId || Number.isNaN(creditoId)) {
      return res.status(400).json({ message: 'creditoId inválido' });
    }

    const [rows] = await pool.query(
      `SELECT
         a.id              AS asignacion_id,
         a.estado          AS asignacion_estado,
         q.id              AS cuota_id,
         q.numero_cuota,
         q.fecha_vencimiento,
         q.monto_cuota,
         q.saldo_cuota,
         q.estado          AS cuota_estado,
         cr.id             AS credito_id,
         cr.numero_credito,
         cr.descripcion,
         cl.id             AS cliente_id,
         cl.nombre,
         cl.apellido
       FROM asignaciones a
       INNER JOIN cuotas q              ON q.id  = a.cuota_id
       INNER JOIN creditos cr           ON cr.id = q.credito_id
       INNER JOIN clientes cl           ON cl.id = cr.cliente_id
       WHERE a.usuario_id = ?
         AND a.estado     = 'PENDIENTE'
         AND q.estado    != 'PAGADO'
         AND q.credito_id = ?
       ORDER BY q.numero_cuota ASC`,
      [cobradorId, creditoId]
    );

    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cobrador/cobros
// Registra un cobro exitoso y marca cuota + asignación.
// Body: { asignacionId | asignacionIds, monto, medioPagoId, nroComprobante?, latitud, longitud, fechaHora }
//   - asignacionId:  (compatibilidad) una sola asignación.
//   - asignacionIds: (multi-cuota) array de asignaciones a cobrar.
//                    Todas deben pertenecer al cobrador, estar PENDIENTE
//                    y corresponder al MISMO crédito.
// ─────────────────────────────────────────────────────────────
const registrarCobro = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id: cobradorId } = req.user;
    const {
      asignacionId,
      asignacionIds,
      monto,
      medioPagoId,
      nroComprobante,
      latitud,
      longitud,
      fechaHora,
    } = req.body;

    // Normalizar a lista de asignaciones
    let ids = [];
    if (Array.isArray(asignacionIds) && asignacionIds.length > 0) {
      ids = [...new Set(asignacionIds.map(Number).filter(Boolean))];
    } else if (asignacionId) {
      ids = [Number(asignacionId)];
    }

    if (ids.length === 0 || !monto || !medioPagoId) {
      return res.status(400).json({ message: 'asignacionId(s), monto y medioPagoId son requeridos' });
    }

    // Verificar que el cobrador tiene una caja abierta del día de hoy.
    // Si la caja abierta es de un día anterior, se bloquea el cobro para
    // obligar al cobrador a cerrarla y abrir una nueva, de modo que cada
    // jornada de recaudación quede en una caja separada.
    const hoyLocal = todayLocal();
    const [[cajaAbierta]] = await conn.query(
      `SELECT id, fecha_apertura FROM arqueos_caja
       WHERE cobrador_id = ? AND estado = 'ABIERTO' LIMIT 1`,
      [cobradorId]
    );
    if (!cajaAbierta) {
      return res.status(409).json({ message: 'Debes abrir tu caja antes de registrar cobros' });
    }
    const fechaApertura = toDateLocal(cajaAbierta.fecha_apertura);
    if (fechaApertura !== hoyLocal) {
      return res.status(409).json({
        message: 'Tu caja abierta es de un día anterior. Debes cerrarla y abrir una nueva caja para hoy antes de registrar cobros.',
        arqueo_id: cajaAbierta.id,
        fecha_apertura: cajaAbierta.fecha_apertura,
      });
    }

    // Verificar medio de pago y si requiere número de comprobante
    const [[medioPago]] = await conn.query(
      `SELECT id, requiere_comprobante FROM medios_pago WHERE id = ? AND activo = TRUE`,
      [medioPagoId]
    );
    if (!medioPago) {
      return res.status(400).json({ message: 'Medio de pago no válido o inactivo' });
    }
    if (medioPago.requiere_comprobante && !nroComprobante) {
      return res.status(400).json({ message: 'El número de comprobante es requerido para este medio de pago' });
    }

    // Verificar que todas las asignaciones pertenecen al cobrador y están pendientes
    const placeholders = ids.map(() => '?').join(',');
    const [asignaciones] = await conn.query(
      `SELECT a.id, a.cuota_id, a.estado, q.monto_cuota, q.saldo_cuota,
              q.numero_cuota, q.credito_id, cr.id AS credito_id, cr.numero_credito,
              cr.empresa_id, cr.cliente_id
       FROM asignaciones a
       INNER JOIN cuotas q ON q.id = a.cuota_id
       INNER JOIN creditos cr ON cr.id = q.credito_id
       WHERE a.id IN (${placeholders}) AND a.usuario_id = ?`,
      [...ids, cobradorId]
    );

    if (asignaciones.length !== ids.length) {
      return res.status(404).json({ message: 'Una o más asignaciones no fueron encontradas' });
    }

    // Ninguna asignación puede estar COMPLETADO
    const completada = asignaciones.find((a) => a.estado === 'COMPLETADO');
    if (completada) {
      return res.status(409).json({ message: `La asignación de la cuota N. ${completada.numero_cuota} ya fue completada` });
    }

    // Todas las cuotas deben pertenecer al MISMO crédito
    const creditoId = asignaciones[0].credito_id;
    const distintoCredito = asignaciones.find((a) => a.credito_id !== creditoId);
    if (distintoCredito) {
      return res.status(400).json({ message: 'Las cuotas seleccionadas deben pertenecer al mismo crédito' });
    }

    // Validar que no se paguen más cuotas de las pendientes del crédito
    const [pendientes] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM asignaciones a
       INNER JOIN cuotas q ON q.id = a.cuota_id
       WHERE a.usuario_id = ?
         AND a.estado = 'PENDIENTE'
         AND q.estado != 'PAGADO'
         AND q.credito_id = ?`,
      [cobradorId, creditoId]
    );
    if (ids.length > Number(pendientes[0].total)) {
      return res.status(400).json({
        message: `No puedes pagar más cuotas de las pendientes (${pendientes[0].total} disponibles)`,
      });
    }

    await conn.beginTransaction();

    // Detectar sobrepago: si el cliente paga más del saldo de la cuota (DESACTIVADO)
    const montoPagado = Number(monto);
    const sobrepagoInfo = { sobrepago: false, excedente: 0 };

    // 1. Insertar una visita_cobro por cada cuota
    const visitasIds = [];
    for (const asignacion of asignaciones) {
      const [result] = await conn.query(
        `INSERT INTO visitas_cobro
           (asignacion_id, cobrador_id, resultado, monto_cobrado,
            medio_pago_id, nro_comprobante, arqueo_id, latitud, longitud, fecha_hora)
         VALUES (?, ?, 'cobrado', ?, ?, ?, ?, ?, ?, ?)`,
        [
          asignacion.id,
          cobradorId,
          asignacion.saldo_cuota,
          medioPagoId,
          nroComprobante || null,
          cajaAbierta.id,
          latitud || null,
          longitud || null,
          toMysqlLocal(fechaHora),
        ]
      );
      visitasIds.push(result.insertId);
    }

    // 2. Actualizar cuotas a PAGADO y registrar fecha_pago
    const fechaPago = toDateLocal(fechaHora);
    for (const asignacion of asignaciones) {
      await conn.query(
        `UPDATE cuotas
         SET estado = 'PAGADO', fecha_pago = ?, saldo_cuota = 0, updated_at = NOW()
         WHERE id = ?`,
        [fechaPago, asignacion.cuota_id]
      );
    }

    // 3. Actualizar asignaciones a COMPLETADO
    for (const asignacion of asignaciones) {
      await conn.query(
        `UPDATE asignaciones SET estado = 'COMPLETADO' WHERE id = ?`,
        [asignacion.id]
      );
    }

    // 4. Generar comprobante de pago (recibo de cobranza) si la caja es v12
    //    Un solo recibo con un detalle por cuota, vinculado a la primera visita.
    let recibo = null;
    try {
      const cajaContext = await getCajaContextForCobro(conn, { cobradorId });
      recibo = await maybeCreateRecibo(conn, {
        cajaContext,
        visitaId: visitasIds[0],
        asignaciones,
        cobradorId,
        monto: montoPagado,
        fechaHora,
      });
      // Vincular las demás visitas al mismo recibo
      if (recibo && recibo.reciboId && visitasIds.length > 1) {
        for (let i = 1; i < visitasIds.length; i++) {
          await conn.query(
            `UPDATE visitas_cobro SET recibo_id = ? WHERE id = ?`,
            [recibo.reciboId, visitasIds[i]]
          );
        }
      }
    } catch (reciboError) {
      // Si no hay caja v12 configurada, se registra el cobro sin comprobante.
      // Si el error es de validación de timbrado, se propaga para no emitir
      // cobros sin comprobante fiscal válido.
      if (reciboError.statusCode === 409) {
        throw reciboError;
      }
    }

    await conn.commit();

    // Auditoría: cobro registrado desde la app móvil
    await registrarAuditoriaSegura({
      empresaId: req.user.empresaId,
      usuarioId: cobradorId,
      ip: getIpCliente(req),
      accion: 'INSERT',
      tabla: 'visitas_cobro',
      registroId: visitasIds[0],
      despues: {
        asignacion_ids: ids,
        cuota_ids: asignaciones.map((a) => a.cuota_id),
        monto: montoPagado,
        medio_pago_id: medioPagoId,
        arqueo_id: cajaAbierta.id,
      },
      observaciones: `Cobro registrado desde la app móvil (${asignaciones.length} cuota(s))`,
    });

    return res.status(201).json({
      message: 'Cobro registrado exitosamente',
      visitaId: visitasIds[0],
      visitasIds,
      recibo: recibo || null,
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cobrador/visitas
// Registra visita con resultado 'ausente' o 'reagendado'.
// Body: { asignacionId, resultado, latitud, longitud, comentario, fechaHora, nuevaHora }
// ─────────────────────────────────────────────────────────────
const registrarVisita = async (req, res, next) => {
  try {
    const { id: cobradorId } = req.user;
    const { asignacionId, resultado, latitud, longitud, comentario, fechaHora, nuevaHora } = req.body;

    if (!asignacionId || !resultado) {
      return res.status(400).json({ message: 'asignacionId y resultado son requeridos' });
    }
    if (!['ausente', 'reagendado'].includes(resultado)) {
      return res.status(400).json({ message: "resultado debe ser 'ausente' o 'reagendado'" });
    }
    if (resultado === 'reagendado' && !nuevaHora) {
      return res.status(400).json({ message: 'nuevaHora es requerida para resultado reagendado' });
    }

    // Verificar que la asignación pertenece al cobrador
    const [[asignacion]] = await pool.query(
      `SELECT id, estado FROM asignaciones WHERE id = ? AND usuario_id = ?`,
      [asignacionId, cobradorId]
    );

    if (!asignacion) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    const [result] = await pool.query(
      `INSERT INTO visitas_cobro
         (asignacion_id, cobrador_id, resultado, latitud, longitud, comentario, nueva_hora, fecha_hora)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asignacionId,
        cobradorId,
        resultado,
        latitud || null,
        longitud || null,
        comentario || null,
        nuevaHora || null,
        toMysqlLocal(fechaHora),
      ]
    );

    // Auditoría: visita con resultado ausente/reagendado
    await registrarAuditoriaSegura({
      empresaId: req.user.empresaId,
      usuarioId: cobradorId,
      ip: getIpCliente(req),
      accion: 'INSERT',
      tabla: 'visitas_cobro',
      registroId: result.insertId,
      despues: { asignacion_id: asignacionId, resultado, nueva_hora: nuevaHora || null },
      observaciones: resultado === 'reagendado' ? 'Visita reagendada' : 'Cliente ausente',
    });

    return res.status(201).json({ message: 'Visita registrada', visitaId: result.insertId });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cobrador/visitas/:id/foto
// Sube la foto de evidencia y actualiza visita_cobro.foto_path
// ─────────────────────────────────────────────────────────────
const subirFotoVisita = async (req, res, next) => {
  try {
    const { id: cobradorId } = req.user;
    const { id: visitaId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No se recibió ningún archivo' });
    }

    // Verificar que la visita pertenece al cobrador
    const [[visita]] = await pool.query(
      `SELECT id, foto_path FROM visitas_cobro WHERE id = ? AND cobrador_id = ?`,
      [visitaId, cobradorId]
    );

    if (!visita) {
      // Eliminar el archivo ya subido si la visita no existe
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: 'Visita no encontrada' });
    }

    // Si ya tenía foto, eliminar la anterior
    if (visita.foto_path) {
      const old = path.join(__dirname, '../../uploads', visita.foto_path);
      fs.unlink(old, () => {});
    }

    // Ruta relativa para guardar en DB (relativa a /uploads/)
    const fotoRelativa = path.relative(
      path.join(__dirname, '../../uploads'),
      req.file.path
    ).replace(/\\/g, '/');

    await pool.query(
      `UPDATE visitas_cobro SET foto_path = ? WHERE id = ?`,
      [fotoRelativa, visitaId]
    );

    // Auditoría: subida de foto de evidencia (no se guarda el archivo, solo la acción)
    await registrarAuditoriaSegura({
      empresaId: req.user.empresaId,
      usuarioId: cobradorId,
      ip: getIpCliente(req),
      accion: visita.foto_path ? 'UPDATE' : 'INSERT',
      tabla: 'visitas_cobro',
      registroId: parseInt(visitaId, 10),
      antes: visita.foto_path ? { foto_path: visita.foto_path } : null,
      despues: { foto_path: fotoRelativa },
      observaciones: 'Cargó un archivo de evidencia (foto de visita)',
    });

    return res.json({ message: 'Foto subida exitosamente', foto_path: fotoRelativa });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/cobrador/cobros?fecha=YYYY-MM-DD
// Lista los cobros registrados por el cobrador en el día indicado
// (por defecto hoy), con datos del recibo para saber si tiene
// comprobante fiscal disponible.
// ─────────────────────────────────────────────────────────────
const getCobrosDelDia = async (req, res, next) => {
  try {
    const { id: cobradorId } = req.user;
    const fecha = req.query.fecha || todayLocal();
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({ message: 'fecha debe tener formato YYYY-MM-DD' });
    }

    const [rows] = await pool.query(
      `SELECT
         vc.id               AS visita_id,
         vc.fecha_hora,
         vc.monto_cobrado,
         vc.nro_comprobante,
         vc.medio_pago_id,
         mp.nombre           AS medio_pago_nombre,
         r.id                AS recibo_id,
         r.numero_recibo,
         cl.nombre           AS cliente_nombre,
         cl.apellido         AS cliente_apellido,
         cl.cedula           AS cliente_cedula,
         q.numero_cuota,
         cr.numero_credito
       FROM visitas_cobro vc
       INNER JOIN asignaciones a ON a.id = vc.asignacion_id
       INNER JOIN cuotas q       ON q.id  = a.cuota_id
       INNER JOIN creditos cr    ON cr.id = q.credito_id
       INNER JOIN clientes cl    ON cl.id = cr.cliente_id
       LEFT JOIN medios_pago mp  ON mp.id = vc.medio_pago_id
       LEFT JOIN recibos r       ON r.id  = vc.recibo_id
       WHERE vc.cobrador_id = ?
         AND DATE(vc.fecha_hora) = ?
         AND vc.resultado = 'cobrado'
       ORDER BY vc.fecha_hora DESC, vc.id DESC`,
      [cobradorId, fecha]
    );

    return res.json({ data: rows, fecha });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getAgenda, getCuotasPendientesCredito, registrarCobro, registrarVisita, subirFotoVisita, getCobrosDelDia };
