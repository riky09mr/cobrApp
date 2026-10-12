const pool = require('../config/db');
const { toMysqlLocal, toDateLocal, todayLocal } = require('../services/cobranzas/time');
const { registrarAuditoriaSegura } = require('../services/cobranzas/auditoriaService');
const {
  abrirCajaV12IfConfigured,
  registrarGastoV12IfPresent,
  cerrarCajaV12IfPresent,
} = require('../services/cobranzas/cajaLifecycleService');

const getIpCliente = (req) => req.ip || req.headers['x-forwarded-for'] || null;

// ─────────────────────────────────────────────────────────────
// POST /api/cobrador/caja/abrir
// Abre una nueva caja para el cobrador.
// No puede haber otra caja ABIERTA al mismo tiempo.
// ─────────────────────────────────────────────────────────────
const abrirCaja = async (req, res, next) => {
  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    const { id: cobradorId, empresaId } = req.user;
    const { saldo_inicial = 0, latitud, longitud } = req.body;

    const [[cajaAbierta]] = await conn.query(
      `SELECT id FROM arqueos_caja WHERE cobrador_id = ? AND estado = 'ABIERTO' LIMIT 1`,
      [cobradorId]
    );
    if (cajaAbierta) {
      return res.status(409).json({
        message: 'Ya tienes una caja abierta. Debes cerrarla antes de abrir una nueva.',
        arqueo_id: cajaAbierta.id,
      });
    }

    await conn.beginTransaction();
    transactionStarted = true;

    const [result] = await conn.query(
      `INSERT INTO arqueos_caja (empresa_id, cobrador_id, fecha_apertura, saldo_inicial, estado)
       VALUES (?, ?, ?, ?, 'ABIERTO')`,
      [empresaId, cobradorId, toMysqlLocal(), Number(saldo_inicial)]
    );

    const cajaV12 = await abrirCajaV12IfConfigured(conn, {
      cobradorId,
      empresaId,
      saldoInicial: saldo_inicial,
      ip: req.ip,
      latitud,
      longitud,
    });

    await conn.commit();

    // Auditoría: apertura de caja (fire-and-forget, fuera de la transacción)
    await registrarAuditoriaSegura({
      empresaId,
      usuarioId: cobradorId,
      ip: getIpCliente(req),
      accion: 'APERTURAR',
      tabla: 'arqueos_caja',
      registroId: result.insertId,
      despues: { saldo_inicial: Number(saldo_inicial), estado: 'ABIERTO' },
      observaciones: 'Apertura de caja',
    });

    return res.status(201).json({
      message: 'Caja abierta exitosamente',
      arqueo_id: result.insertId,
      caja_id: cajaV12?.cajaId || null,
      caja_apertura_id: cajaV12?.cajaAperturaId || null,
    });
  } catch (error) {
    if (transactionStarted) {
      await conn.rollback();
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/cobrador/caja/activa
// Retorna la caja abierta del cobrador con el resumen al momento.
// ─────────────────────────────────────────────────────────────
const getCajaActiva = async (req, res, next) => {
  try {
    const { id: cobradorId } = req.user;

    const [[arqueo]] = await pool.query(
      `SELECT id, fecha_apertura, saldo_inicial, estado
       FROM arqueos_caja
       WHERE cobrador_id = ? AND estado = 'ABIERTO'
       LIMIT 1`,
      [cobradorId]
    );
    if (!arqueo) return res.json({ data: null });

    // Solo cobros vinculados a esta caja
    // Efectivo = medios sin requiere_comprobante; Otros = con requiere_comprobante
    const [[totales]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN mp.requiere_comprobante = FALSE THEN vc.monto_cobrado ELSE 0 END), 0) AS total_efectivo,
         COALESCE(SUM(CASE WHEN mp.requiere_comprobante = TRUE  THEN vc.monto_cobrado ELSE 0 END), 0) AS total_otros,
         COUNT(vc.id) AS cantidad_cobros
       FROM visitas_cobro vc
       INNER JOIN medios_pago mp ON mp.id = vc.medio_pago_id
       WHERE vc.arqueo_id = ? AND vc.resultado = 'cobrado'`,
      [arqueo.id]
    );

    const [[gastos]] = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastos FROM movimientos_caja WHERE arqueo_id = ?`,
      [arqueo.id]
    );

    const saldo_esperado =
      Number(arqueo.saldo_inicial) +
      Number(totales.total_efectivo) -
      Number(gastos.total_gastos);

    // Indica si la caja abierta es de un día anterior (para alertar al cobrador
    // de que debe cerrarla y abrir una nueva antes de seguir cobrando).
    const es_de_otro_dia = toDateLocal(arqueo.fecha_apertura) !== todayLocal();

    return res.json({
      data: {
        ...arqueo,
        total_efectivo:  Number(totales.total_efectivo),
        total_otros:     Number(totales.total_otros),
        cantidad_cobros: Number(totales.cantidad_cobros),
        total_gastos:    Number(gastos.total_gastos),
        saldo_esperado,
        es_de_otro_dia,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cobrador/caja/cerrar
// El cobrador declara cuánto efectivo cuenta y cierra la caja.
// Body: { saldo_contado, observacion? }
// ─────────────────────────────────────────────────────────────
const cerrarCaja = async (req, res, next) => {
  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    const { id: cobradorId, empresaId } = req.user;
    const { saldo_contado, observacion } = req.body;

    if (saldo_contado === undefined || saldo_contado === null) {
      return res.status(400).json({ message: 'saldo_contado es requerido' });
    }

    const [[arqueo]] = await conn.query(
      `SELECT id, saldo_inicial FROM arqueos_caja
       WHERE cobrador_id = ? AND estado = 'ABIERTO' LIMIT 1`,
      [cobradorId]
    );
    if (!arqueo) return res.status(404).json({ message: 'No tienes una caja abierta' });

    // saldo_esperado = saldo_inicial + cobros en efectivo − gastos
    const [[totales]] = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN mp.requiere_comprobante = FALSE THEN vc.monto_cobrado ELSE 0 END), 0) AS total_efectivo
       FROM visitas_cobro vc
       INNER JOIN medios_pago mp ON mp.id = vc.medio_pago_id
       WHERE vc.arqueo_id = ? AND vc.resultado = 'cobrado'`,
      [arqueo.id]
    );

    const [[gastos]] = await conn.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastos FROM movimientos_caja WHERE arqueo_id = ?`,
      [arqueo.id]
    );

    const saldo_esperado =
      Number(arqueo.saldo_inicial) +
      Number(totales.total_efectivo) -
      Number(gastos.total_gastos);

    const diferencia = Number(saldo_contado) - saldo_esperado;

    await conn.beginTransaction();
    transactionStarted = true;

    await conn.query(
      `UPDATE arqueos_caja
       SET estado = 'CERRADO', fecha_cierre = ?, saldo_esperado = ?,
           saldo_contado = ?, diferencia = ?, observacion = ?
       WHERE id = ?`,
      [toMysqlLocal(), saldo_esperado, Number(saldo_contado), diferencia, observacion || null, arqueo.id]
    );

    const cierreV12 = await cerrarCajaV12IfPresent(conn, {
      cobradorId,
      saldoContado: saldo_contado,
      observacion,
      empresaId,
    });

    await conn.commit();

    // Auditoría: cierre de caja
    await registrarAuditoriaSegura({
      empresaId,
      usuarioId: cobradorId,
      ip: getIpCliente(req),
      accion: 'CERRAR',
      tabla: 'arqueos_caja',
      registroId: arqueo.id,
      antes: { estado: 'ABIERTO' },
      despues: {
        estado: 'CERRADO',
        saldo_esperado,
        saldo_contado: Number(saldo_contado),
        diferencia,
      },
      observaciones: observacion || 'Cierre de caja',
    });

    return res.json({
      message: 'Caja cerrada exitosamente',
      arqueo_id:      arqueo.id,
      saldo_esperado,
      saldo_contado:  Number(saldo_contado),
      diferencia,
      cierre_caja_id: cierreV12?.cierreId || null,
      caja_apertura_id: cierreV12?.cajaAperturaId || null,
    });
  } catch (error) {
    if (transactionStarted) {
      await conn.rollback();
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/cobrador/caja/:id/gastos
// Registra un gasto durante la jornada (combustible, etc.)
// Body: { concepto, monto }
// ─────────────────────────────────────────────────────────────
const registrarGasto = async (req, res, next) => {
  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    const { id: cobradorId, empresaId } = req.user;
    const { id: arqueoId } = req.params;
    const { concepto, monto } = req.body;

    if (!concepto || !monto) {
      return res.status(400).json({ message: 'concepto y monto son requeridos' });
    }

    const [[arqueo]] = await conn.query(
      `SELECT id FROM arqueos_caja WHERE id = ? AND cobrador_id = ? AND estado = 'ABIERTO'`,
      [arqueoId, cobradorId]
    );
    if (!arqueo) return res.status(404).json({ message: 'Caja no encontrada o ya cerrada' });

    await conn.beginTransaction();
    transactionStarted = true;

    const [result] = await conn.query(
      `INSERT INTO movimientos_caja (arqueo_id, concepto, monto, fecha_hora) VALUES (?, ?, ?, ?)`,
      [arqueoId, concepto, Number(monto), toMysqlLocal()]
    );

    const movimientoV12 = await registrarGastoV12IfPresent(conn, {
      cobradorId,
      concepto,
      monto,
      empresaId,
    });

    await conn.commit();

    return res.status(201).json({
      message: 'Gasto registrado',
      id: result.insertId,
      caja_movimiento_id: movimientoV12?.movimientoId || null,
    });
  } catch (error) {
    if (transactionStarted) {
      await conn.rollback();
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/arqueos
// Supervisor/Admin: listar arqueos de la empresa con filtros opcionales.
// Query params: cobradorId, fecha (YYYY-MM-DD), estado (ABIERTO|CERRADO)
// ─────────────────────────────────────────────────────────────
const getArqueos = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const { cobradorId, fecha, estado } = req.query;

    const params = [];
    let where = 'WHERE 1=1';

    if (rol !== 'ADMIN') {
      where += ' AND ac.empresa_id = ?';
      params.push(empresaId);
    }
    if (cobradorId) { where += ' AND ac.cobrador_id = ?'; params.push(cobradorId); }
    if (fecha)      { where += ' AND DATE(ac.fecha_apertura) = ?'; params.push(fecha); }
    if (estado)     { where += ' AND ac.estado = ?'; params.push(estado); }

    const [rows] = await pool.query(
      `SELECT
         ac.id, ac.fecha_apertura, ac.fecha_cierre,
         ac.saldo_inicial, ac.saldo_esperado, ac.saldo_contado,
         ac.diferencia, ac.estado, ac.observacion,
         CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) AS cobrador
       FROM arqueos_caja ac
       INNER JOIN usuarios u ON u.id = ac.cobrador_id
       ${where}
       ORDER BY ac.fecha_apertura DESC
       LIMIT 200`,
      params
    );
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/arqueos/:id
// Detalle completo: arqueo + cobros + gastos + rendición (si existe)
// Accesible por el propio cobrador, su supervisor y admin.
// ─────────────────────────────────────────────────────────────
const getArqueoDetalle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rol, empresaId, id: userId } = req.user;

    const [[arqueo]] = await pool.query(
      `SELECT ac.*, CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) AS cobrador
       FROM arqueos_caja ac
       INNER JOIN usuarios u ON u.id = ac.cobrador_id
       WHERE ac.id = ?`,
      [id]
    );
    if (!arqueo) return res.status(404).json({ message: 'Arqueo no encontrado' });

    if (rol === 'COBRADOR' && arqueo.cobrador_id !== userId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }
    if (rol === 'SUPERVISOR' && arqueo.empresa_id !== empresaId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    // Cobros del arqueo (con fallback al campo string legacy)
    const [cobros] = await pool.query(
      `SELECT
         vc.id, vc.monto_cobrado, vc.nro_comprobante, vc.fecha_hora,
         COALESCE(mp.nombre, vc.medio_pago, 'N/A') AS medio_pago,
         COALESCE(mp.requiere_comprobante, FALSE)   AS requiere_comprobante,
         cl.nombre AS cliente, cl.apellido AS cliente_apellido,
         q.numero_cuota, cr.numero_credito
       FROM visitas_cobro vc
       LEFT JOIN medios_pago mp ON mp.id = vc.medio_pago_id
       INNER JOIN asignaciones a  ON a.id  = vc.asignacion_id
       INNER JOIN cuotas q        ON q.id  = a.cuota_id
       INNER JOIN creditos cr     ON cr.id = q.credito_id
       INNER JOIN clientes cl     ON cl.id = cr.cliente_id
       WHERE vc.arqueo_id = ? AND vc.resultado = 'cobrado'
       ORDER BY vc.fecha_hora`,
      [id]
    );

    const [gastos] = await pool.query(
      `SELECT id, concepto, monto, fecha_hora
       FROM movimientos_caja WHERE arqueo_id = ? ORDER BY fecha_hora`,
      [id]
    );

    const [[rendicion]] = await pool.query(
      `SELECT r.*, CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) AS supervisor
       FROM rendiciones r
       INNER JOIN usuarios u ON u.id = r.supervisor_id
       WHERE r.arqueo_id = ? LIMIT 1`,
      [id]
    );

    return res.json({ data: { arqueo, cobros, gastos, rendicion: rendicion || null } });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/arqueos/:id/rendicion
// Supervisor confirma recepción del dinero.
// Body: { monto_recibido, observacion? }
// ─────────────────────────────────────────────────────────────
const confirmarRendicion = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { id: supervisorId, rol, empresaId } = req.user;
    const { monto_recibido, observacion } = req.body;

    if (monto_recibido === undefined || monto_recibido === null) {
      return res.status(400).json({ message: 'monto_recibido es requerido' });
    }

    const [[arqueo]] = await conn.query(
      `SELECT id, empresa_id, saldo_esperado, estado FROM arqueos_caja WHERE id = ?`,
      [id]
    );
    if (!arqueo) return res.status(404).json({ message: 'Arqueo no encontrado' });
    if (rol !== 'ADMIN' && arqueo.empresa_id !== empresaId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }
    if (arqueo.estado !== 'CERRADO') {
      return res.status(409).json({ message: 'El arqueo debe estar cerrado antes de la rendición' });
    }

    const [[rendExistente]] = await conn.query(
      `SELECT id FROM rendiciones WHERE arqueo_id = ?`,
      [id]
    );
    if (rendExistente) {
      return res.status(409).json({ message: 'Este arqueo ya tiene una rendición registrada' });
    }

    const diferencia = Number(monto_recibido) - Number(arqueo.saldo_esperado);
    let estado;
    if (Math.abs(diferencia) < 0.01) estado = 'CUADRADO';
    else if (diferencia > 0)         estado = 'SOBRANTE';
    else                             estado = 'FALTANTE';

    const [result] = await conn.query(
      `INSERT INTO rendiciones (arqueo_id, supervisor_id, monto_recibido, estado, observacion)
       VALUES (?, ?, ?, ?, ?)`,
      [id, supervisorId, Number(monto_recibido), estado, observacion || null]
    );

    // Auditoría: rendición confirmada
    await registrarAuditoriaSegura({
      empresaId: arqueo.empresa_id,
      usuarioId: supervisorId,
      ip: getIpCliente(req),
      accion: 'INSERT',
      tabla: 'rendiciones',
      registroId: result.insertId,
      despues: {
        arqueo_id: id,
        monto_recibido: Number(monto_recibido),
        estado,
        diferencia,
      },
      observaciones: 'Rendición de arqueo',
    });

    return res.status(201).json({
      message: 'Rendición confirmada',
      id: result.insertId,
      estado,
      diferencia,
    });
  } catch (error) {
    return next(error);
  } finally {
    conn.release();
  }
};

module.exports = {
  abrirCaja, getCajaActiva, cerrarCaja, registrarGasto,
  getArqueos, getArqueoDetalle, confirmarRendicion,
};
