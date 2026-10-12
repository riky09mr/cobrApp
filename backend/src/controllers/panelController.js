const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { registrarAuditoriaSegura } = require('../services/cobranzas/auditoriaService');
const { getCajaContextForCobro } = require('../services/cobranzas/cajaService');
const { maybeCreateRecibo } = require('../services/cobranzas/reciboService');
// const { detectarSobrepago, crearSaldoAFavor } = require('../services/cobranzas/notaCreditoService');

const getIpCliente = (req) => req.ip || req.headers['x-forwarded-for'] || null;

const getDashboardSummary = async (req, res, next) => {
  try {
    const { rol, id: userId, empresaId } = req.user;


    if (rol === 'COBRADOR') {
      const [[asignTotales]]     = await pool.query('SELECT COUNT(*) AS total FROM asignaciones WHERE usuario_id = ?', [userId]);
      const [[asignPendientes]]  = await pool.query("SELECT COUNT(*) AS total FROM asignaciones WHERE usuario_id = ? AND estado = 'PENDIENTE'", [userId]);
      const [[asignCompletadas]] = await pool.query("SELECT COUNT(*) AS total FROM asignaciones WHERE usuario_id = ? AND estado = 'COMPLETADO'", [userId]);
      const [[cuotasVencidas]]   = await pool.query(
        `SELECT COUNT(*) AS total FROM asignaciones a
         INNER JOIN cuotas q ON q.id = a.cuota_id
         WHERE a.usuario_id = ? AND q.estado = 'VENCIDA'`, [userId]
      );
      const [[montoCobrado]] = await pool.query(
        `SELECT COALESCE(SUM(monto_cobrado), 0) AS total
         FROM visitas_cobro
         WHERE cobrador_id = ? AND resultado = 'cobrado'`, [userId]
      );

      return res.json({
        data: {
          rol,
          asignacionesTotales:    asignTotales.total,
          asignacionesPendientes: asignPendientes.total,
          asignacionesCompletadas: asignCompletadas.total,
          cuotasVencidas:  cuotasVencidas.total,
          montoCobrado:    Number(montoCobrado.total),
        },
      });
    }

    if (rol === 'SUPERVISOR') {
      const [[cobradores]] = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         WHERE u.empresa_id = ? AND r.nombre = 'COBRADOR' AND u.estado = 1`, [empresaId]
      );
      const [[clientes]] = await pool.query(
        'SELECT COUNT(*) AS total FROM clientes_empresas WHERE empresa_id = ? AND estado = 1', [empresaId]
      );
      const [[asignTotales]]     = await pool.query('SELECT COUNT(*) AS total FROM asignaciones WHERE supervisor_id = ?', [userId]);
      const [[asignPendientes]]  = await pool.query("SELECT COUNT(*) AS total FROM asignaciones WHERE supervisor_id = ? AND estado = 'PENDIENTE'", [userId]);
      const [[asignCompletadas]] = await pool.query("SELECT COUNT(*) AS total FROM asignaciones WHERE supervisor_id = ? AND estado = 'COMPLETADO'", [userId]);
      const [[montoCobrado]] = await pool.query(
        `SELECT COALESCE(SUM(vc.monto_cobrado), 0) AS total
         FROM visitas_cobro vc
         INNER JOIN asignaciones a ON a.id = vc.asignacion_id
         WHERE a.supervisor_id = ? AND vc.resultado = 'cobrado'`, [userId]
      );

      return res.json({
        data: {
          rol,
          cobradores:              cobradores.total,
          clientes:                clientes.total,
          asignacionesTotales:     asignTotales.total,
          asignacionesPendientes:  asignPendientes.total,
          asignacionesCompletadas: asignCompletadas.total,
          montoCobrado:            Number(montoCobrado.total),
        },
      });
    }

    const [[empresas]]        = await pool.query('SELECT COUNT(*) AS total FROM empresas WHERE estado = TRUE');
    const [[clientes]]        = await pool.query('SELECT COUNT(*) AS total FROM clientes_empresas WHERE estado = TRUE');
    const [[usuarios]]        = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = TRUE');
    const [[cuotasPendientes]] = await pool.query("SELECT COUNT(*) AS total FROM cuotas WHERE estado = 'PENDIENTE'");
    const [[cuotasVencidas]]   = await pool.query("SELECT COUNT(*) AS total FROM cuotas WHERE estado = 'VENCIDA'");
    const [[cuotasPagadas]]    = await pool.query("SELECT COUNT(*) AS total FROM cuotas WHERE estado = 'PAGADO'");
    const [[montoCobrado]]     = await pool.query("SELECT COALESCE(SUM(monto_cobrado), 0) AS total FROM visitas_cobro WHERE resultado = 'cobrado'");

    return res.json({
      data: {
        rol,
        empresas:         empresas.total,
        clientes:         clientes.total,
        usuarios:         usuarios.total,
        cuotasPendientes: cuotasPendientes.total,
        cuotasVencidas:   cuotasVencidas.total,
        cuotasPagadas:    cuotasPagadas.total,
        montoCobrado:     Number(montoCobrado.total),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getEmpresas = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    let query = `SELECT id, razon_social, ruc, telefono, email, direccion, logo_url, estado, created_at
       FROM empresas`;
    const params = [];

    if (usuarioActual.rol !== 'ADMIN') {
      query += ' WHERE id = ?';
      params.push(usuarioActual.empresaId);
    }

    query += ' ORDER BY id DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const getClientes = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    const params = [];

    let query = `
      SELECT c.id, c.cedula, c.nombre, c.apellido, c.telefono, c.email,
             ce.estado, ce.direccion, ce.latitud, ce.longitud, e.razon_social AS empresa
      FROM clientes c
      INNER JOIN clientes_empresas ce ON ce.cliente_id = c.id
      INNER JOIN empresas e ON e.id = ce.empresa_id
      WHERE ce.estado = 1`;

    if (usuarioActual.rol !== 'ADMIN') {
      query += ' AND ce.empresa_id = ?';
      params.push(usuarioActual.empresaId);
    }

    query += ' ORDER BY c.id DESC LIMIT 200';

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const getCobranzas = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    let query;
    const params = [];

    const SELECT_COLS = `
      SELECT q.id, q.numero_cuota, q.fecha_vencimiento, q.monto_cuota, q.saldo_cuota,
             q.estado, q.fecha_pago,
             cr.id AS credito_id, cr.numero_credito, cr.descripcion,
             cr.monto_total, cr.cantidad_cuotas,
             cl.id AS cliente_id, cl.cedula,
             CONCAT(COALESCE(cl.nombre, ''), ' ', COALESCE(cl.apellido, '')) AS cliente`;

    if (usuarioActual.rol === 'COBRADOR') {
      // Solo cuotas asignadas a este cobrador con asignaci n pendiente
      query = `${SELECT_COLS},
             a.fecha_limite AS fecha_limite_asignacion, a.id AS asignacion_id,
             NULL AS cobrador_asignado_id, NULL AS cobrador_asignado
      FROM asignaciones a
      INNER JOIN cuotas q ON q.id = a.cuota_id
      INNER JOIN creditos cr ON cr.id = q.credito_id
      INNER JOIN clientes cl ON cl.id = cr.cliente_id
      INNER JOIN clientes_empresas ce ON ce.cliente_id = cl.id AND ce.empresa_id = cr.empresa_id
      WHERE a.usuario_id = ? AND a.estado = 'PENDIENTE'
      ORDER BY cl.nombre ASC, q.fecha_vencimiento ASC
      LIMIT 500`;
      params.push(usuarioActual.id);
    } else {
      query = `${SELECT_COLS},
             (SELECT a2.id FROM asignaciones a2 WHERE a2.cuota_id = q.id AND a2.estado = 'PENDIENTE' ORDER BY a2.id DESC LIMIT 1) AS asignacion_id,
             (SELECT a2.fecha_limite FROM asignaciones a2 WHERE a2.cuota_id = q.id AND a2.estado = 'PENDIENTE' ORDER BY a2.id DESC LIMIT 1) AS fecha_limite_asignacion,
             (SELECT a2.usuario_id FROM asignaciones a2 WHERE a2.cuota_id = q.id AND a2.estado = 'PENDIENTE' ORDER BY a2.id DESC LIMIT 1) AS cobrador_asignado_id,
             (SELECT CONCAT(u2.nombre, ' ', COALESCE(u2.apellido,'')) FROM asignaciones a2 INNER JOIN usuarios u2 ON u2.id = a2.usuario_id WHERE a2.cuota_id = q.id AND a2.estado = 'PENDIENTE' ORDER BY a2.id DESC LIMIT 1) AS cobrador_asignado
      FROM cuotas q
      INNER JOIN creditos cr ON cr.id = q.credito_id
      INNER JOIN clientes cl ON cl.id = cr.cliente_id
      INNER JOIN clientes_empresas ce ON ce.cliente_id = cl.id AND ce.empresa_id = cr.empresa_id
      WHERE 1=1`;
      if (usuarioActual.rol !== 'ADMIN') {
        query += ' AND cr.empresa_id = ?';
        params.push(usuarioActual.empresaId);
      }
      query += ' ORDER BY cl.nombre ASC, q.fecha_vencimiento ASC LIMIT 500';
    }

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const toMysqlLocalPanel = (d) =>
  new Date(d || Date.now())
    .toLocaleString('sv-SE', { timeZone: 'America/Asuncion' })
    .replace('T', ' ');

// PATCH /api/panel/cobranzas/:id/cobrar
// Body opcional: { medio_pago_id, monto_cobrado, nro_comprobante }
const registrarCobro = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { medio_pago_id, monto_cobrado, nro_comprobante } = req.body ?? {};
    const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' }).split(' ')[0];

    const [[cuota]] = await conn.query(
      `SELECT q.id, q.estado, q.monto_cuota, q.saldo_cuota, cr.empresa_id
       FROM cuotas q
       INNER JOIN creditos cr ON cr.id = q.credito_id
       WHERE q.id = ?`,
      [id]
    );

    if (!cuota) { conn.release(); return res.status(404).json({ message: 'Cuota no encontrada' }); }

    const usuarioActual = req.user;
    if (usuarioActual.rol === 'ADMIN') {
      conn.release(); return res.status(403).json({ message: 'El administrador no puede registrar cobros' });
    }
    if (cuota.empresa_id !== usuarioActual.empresaId) {
      conn.release(); return res.status(403).json({ message: 'Sin permisos' });
    }

    if (cuota.estado === 'PAGADO') {
      conn.release(); return res.status(400).json({ message: 'La cuota ya esta pagada' });
    }

    // Validar medio de pago si fue enviado
    if (medio_pago_id) {
      const [[mp]] = await conn.query(
        `SELECT id, requiere_comprobante FROM medios_pago WHERE id = ? AND activo = TRUE`,
        [medio_pago_id]
      );
      if (!mp) { conn.release(); return res.status(400).json({ message: 'Medio de pago invalido o inactivo' }); }
      if (mp.requiere_comprobante && !nro_comprobante) {
        conn.release(); return res.status(400).json({ message: 'El numero de comprobante es requerido para este medio de pago' });
      }
    }

    // Buscar asignacion pendiente para la cuota
    const [[asignacion]] = await conn.query(
      `SELECT a.id, a.cuota_id, a.estado, q.numero_cuota,
              cr.id AS credito_id, cr.numero_credito,
              cr.empresa_id, cr.cliente_id
       FROM asignaciones a
       INNER JOIN cuotas q ON q.id = a.cuota_id
       INNER JOIN creditos cr ON cr.id = q.credito_id
       WHERE a.cuota_id = ? AND a.estado = 'PENDIENTE'
       ORDER BY a.id DESC LIMIT 1`,
      [id]
    );

    await conn.beginTransaction();

    // 1. Marcar cuota PAGADO
    await conn.query(
      "UPDATE cuotas SET estado = 'PAGADO', saldo_cuota = 0, fecha_pago = ?, updated_at = NOW() WHERE id = ?",
      [hoy, id]
    );

    // 2. Si hay asignacion, marcarla COMPLETADO
    if (asignacion) {
      await conn.query(
        `UPDATE asignaciones SET estado = 'COMPLETADO' WHERE id = ?`,
        [asignacion.id]
      );
    }

    // 3. Registrar visita_cobro si hay asignacion y medio de pago
    let visitaId = null;
    let montoFinal = 0;
    let sobrepagoInfo = { sobrepago: false, excedente: 0 };
    if (asignacion && medio_pago_id) {
      montoFinal = Number(monto_cobrado) || Number(cuota.saldo_cuota ?? cuota.monto_cuota);
      // Detectar sobrepago: si el cliente paga más del saldo de la cuota (DESACTIVADO)
      // sobrepagoInfo = detectarSobrepago(montoFinal, cuota.saldo_cuota ?? cuota.monto_cuota);
      const [visitaResult] = await conn.query(
        `INSERT INTO visitas_cobro
           (asignacion_id, cobrador_id, resultado, monto_cobrado,
            medio_pago_id, nro_comprobante, arqueo_id, fecha_hora)
         VALUES (?, ?, 'cobrado', ?, ?, ?, NULL, ?)`,
        [asignacion.id, usuarioActual.id, montoFinal, medio_pago_id, nro_comprobante || null, toMysqlLocalPanel()]
      );
      visitaId = visitaResult.insertId;
      // (Escritura dual en gestiones eliminada — fuente de verdad única: visitas_cobro)
    }

    // 4. Generar comprobante de pago (recibo de cobranza) si la caja es v12
    let recibo = null;
    if (visitaId) {
      try {
        const cajaContext = await getCajaContextForCobro(conn, { cobradorId: usuarioActual.id });
        recibo = await maybeCreateRecibo(conn, {
          cajaContext,
          visitaId,
          asignacion,
          cobradorId: usuarioActual.id,
          monto: montoFinal,
          fechaHora: new Date(),
          // montoSobrepago: sobrepagoInfo.excedente,
          // saldoAFavor: sobrepagoInfo.excedente,
        });
      } catch (reciboError) {
        // Si no hay caja v12 configurada, se registra el cobro sin comprobante.
        // Si el error es de validación de timbrado, se propaga para no emitir
        // cobros sin comprobante fiscal válido.
        if (reciboError.statusCode === 409) {
          throw reciboError;
        }
      }
    }

    // 5. Si hay sobrepago, registrar saldo a favor del cliente (DESACTIVADO)
    // if (sobrepagoInfo.sobrepago && recibo && recibo.reciboId) {
    //   await crearSaldoAFavor(conn, {
    //     empresaId: asignacion.empresa_id,
    //     clienteId: asignacion.cliente_id,
    //     reciboId: recibo.reciboId,
    //     monto: sobrepagoInfo.excedente,
    //     usuarioId: usuarioActual.id,
    //   });
    // }

    await conn.commit();

    // Auditoría: cobro registrado desde el panel
    if (visitaId) {
      await registrarAuditoriaSegura({
        empresaId: usuarioActual.empresaId,
        usuarioId: usuarioActual.id,
        ip: getIpCliente(req),
        accion: 'INSERT',
        tabla: 'visitas_cobro',
        registroId: visitaId,
        despues: {
          asignacion_id: asignacion.id,
          cuota_id: id,
          monto: montoFinal,
          medio_pago_id: medio_pago_id ?? null,
        },
        observaciones: 'Cobro registrado desde el panel',
      });
    }

    return res.json({
      message: 'Cobro registrado',
      visitaId,
      recibo: recibo || null,
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};
const getUsuarios = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    const BASE = `SELECT u.id, u.nombre, u.apellido, u.cedula, u.email, u.telefono, u.estado,
              e.razon_social AS empresa, r.nombre AS rol
       FROM usuarios u
       INNER JOIN empresas e ON e.id = u.empresa_id
       INNER JOIN roles r ON r.id = u.rol_id`;
    let query;
    const params = [];

    if (usuarioActual.rol === 'COBRADOR') {
      // Solo ve su propio usuario
      query = `${BASE} WHERE u.id = ?`;
      params.push(usuarioActual.id);
    } else if (usuarioActual.rol !== 'ADMIN') {
      query = `${BASE} WHERE u.empresa_id = ? ORDER BY u.id DESC LIMIT 100`;
      params.push(usuarioActual.empresaId);
    } else {
      query = `${BASE} ORDER BY u.id DESC LIMIT 100`;
    }

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const getCobradores = async (req, res, next) => {
  try {
    const { empresaId, rol } = req.user;
    const empId = rol === 'ADMIN' ? (req.query.empresa_id || empresaId) : empresaId;
    const params = [empId];
    let query = `SELECT u.id, u.nombre, u.apellido
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE r.nombre = 'COBRADOR' AND u.estado = 1 AND u.empresa_id = ?`;
    query += ' ORDER BY u.nombre ASC';

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/panel/cobradores/:id/asignaciones
// Devuelve todas las asignaciones (clientes + cuotas + zonas)
// de un cobrador específico, para que ADMIN/SUPERVISOR pueda
// ver qué tiene asignado cada cobrador.
// ─────────────────────────────────────────────────────────────
const getAsignacionesCobrador = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { empresaId, rol } = req.user;

    // Validar que el cobrador existe y es rol COBRADOR
    const [[cobrador]] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.empresa_id
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ? AND r.nombre = 'COBRADOR'`,
      [id]
    );
    if (!cobrador) {
      return res.status(404).json({ message: 'Cobrador no encontrado' });
    }
    if (rol !== 'ADMIN' && cobrador.empresa_id !== empresaId) {
      return res.status(403).json({ message: 'Sin permisos para ver este cobrador' });
    }

    const params = [id];
    let whereEmpresa = '';
    if (rol !== 'ADMIN') {
      whereEmpresa = ' AND cr.empresa_id = ?';
      params.push(empresaId);
    }

    const [rows] = await pool.query(
      `SELECT
         a.id              AS asignacion_id,
         a.fecha_asignacion,
         a.fecha_limite,
         a.estado          AS asignacion_estado,
         q.id              AS cuota_id,
         q.numero_cuota,
         q.fecha_vencimiento,
         q.monto_cuota,
         q.saldo_cuota,
         q.estado          AS cuota_estado,
         q.fecha_pago,
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
         z.id              AS zona_id,
         z.nombre          AS zona_nombre,
         z.color           AS zona_color,
         (SELECT vc.resultado
          FROM visitas_cobro vc
          WHERE vc.asignacion_id = a.id
          ORDER BY vc.fecha_hora DESC LIMIT 1) AS ultimo_resultado,
         (SELECT vc.fecha_hora
          FROM visitas_cobro vc
          WHERE vc.asignacion_id = a.id
          ORDER BY vc.fecha_hora DESC LIMIT 1) AS ultima_visita
       FROM asignaciones a
       INNER JOIN cuotas q              ON q.id  = a.cuota_id
       INNER JOIN creditos cr           ON cr.id = q.credito_id
       INNER JOIN clientes cl           ON cl.id = cr.cliente_id
       INNER JOIN clientes_empresas ce  ON ce.cliente_id = cl.id
                                       AND ce.empresa_id = cr.empresa_id
       LEFT JOIN zonas z                ON z.id  = ce.zona_id
       WHERE a.usuario_id = ?${whereEmpresa}
       ORDER BY a.estado ASC, q.fecha_vencimiento ASC, cl.nombre ASC
       LIMIT 1000`,
      params
    );

    // Resumen por cobrador
    const resumen = {
      total_asignaciones: rows.length,
      pendientes: rows.filter((r) => r.asignacion_estado === 'PENDIENTE').length,
      completadas: rows.filter((r) => r.asignacion_estado === 'COMPLETADO').length,
      cuotas_pagadas: rows.filter((r) => r.cuota_estado === 'PAGADO').length,
      monto_pendiente: rows
        .filter((r) => r.cuota_estado !== 'PAGADO')
        .reduce((acc, r) => acc + Number(r.saldo_cuota || 0), 0),
      monto_cobrado: rows
        .filter((r) => r.cuota_estado === 'PAGADO')
        .reduce((acc, r) => acc + Number(r.monto_cuota || 0), 0),
      zonas: [...new Set(rows.map((r) => r.zona_nombre).filter(Boolean))],
    };

    return res.json({ data: rows, resumen, cobrador: { id: cobrador.id, nombre: cobrador.nombre, apellido: cobrador.apellido } });
  } catch (error) {
    return next(error);
  }
};

const getRoles = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, descripcion FROM roles ORDER BY id ASC'
    );

    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const getGestiones = async (req, res, next) => {
  try {
    const { rol, id: userId, empresaId } = req.user;
    const { cobradorId, fechaDesde, fechaHasta, resultado } = req.query;

    const params = [];
    let where = 'WHERE 1=1';

    if (rol === 'ADMIN') {
      if (cobradorId) { where += ' AND vc.cobrador_id = ?'; params.push(cobradorId); }
    } else {
      // SUPERVISOR y COBRADOR solo ven su empresa
      where += ' AND cr.empresa_id = ?';
      params.push(empresaId);
      if (rol === 'COBRADOR') {
        where += ' AND vc.cobrador_id = ?';
        params.push(userId);
      } else if (cobradorId) {
        where += ' AND vc.cobrador_id = ?';
        params.push(cobradorId);
      }
    }

    if (fechaDesde) { where += ' AND DATE(vc.fecha_hora) >= ?'; params.push(fechaDesde); }
    if (fechaHasta) { where += ' AND DATE(vc.fecha_hora) <= ?'; params.push(fechaHasta); }
    if (resultado) { where += ' AND vc.resultado = ?'; params.push(resultado); }

    const [rows] = await pool.query(
      `SELECT
         vc.id,
         vc.resultado,
         vc.monto_cobrado,
         vc.medio_pago,
         vc.comentario,
         vc.nueva_hora,
         vc.latitud,
         vc.longitud,
         vc.fecha_hora,
         vc.foto_path,
         vc.recibo_id,
         CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) AS cobrador,
         cl.nombre AS cliente_nombre,
         cl.apellido AS cliente_apellido,
         cl.cedula,
         q.numero_cuota,
         q.monto_cuota,
         cr.numero_credito
       FROM visitas_cobro vc
       INNER JOIN asignaciones a    ON a.id  = vc.asignacion_id
       INNER JOIN cuotas q          ON q.id  = a.cuota_id
       INNER JOIN creditos cr       ON cr.id = q.credito_id
       INNER JOIN clientes cl       ON cl.id = cr.cliente_id
       INNER JOIN usuarios u        ON u.id  = vc.cobrador_id
       ${where}
       ORDER BY vc.fecha_hora DESC
       LIMIT 500`,
      params
    );

    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const updateFechaVencimiento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_vencimiento } = req.body;

    if (!fecha_vencimiento || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_vencimiento)) {
      return res.status(400).json({ message: 'fecha_vencimiento inv lida (YYYY-MM-DD)' });
    }

    const [[cuota]] = await pool.query(
      `SELECT q.id, q.estado, q.fecha_vencimiento, cr.empresa_id
       FROM cuotas q
       INNER JOIN creditos cr ON cr.id = q.credito_id
       WHERE q.id = ?`,
      [id]
    );

    if (!cuota) return res.status(404).json({ message: 'Cuota no encontrada' });

    const usuarioActual = req.user;
    if (usuarioActual.rol !== 'ADMIN' && cuota.empresa_id !== usuarioActual.empresaId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }
    if (cuota.estado === 'PAGADO') {
      return res.status(400).json({ message: 'No se puede modificar una cuota ya pagada' });
    }

    // Recalcula el estado seg n la nueva fecha
    const hoy = new Date().toISOString().split('T')[0];
    const nuevoEstado = fecha_vencimiento < hoy ? 'VENCIDA' : 'PENDIENTE';

    await pool.query(
      'UPDATE cuotas SET fecha_vencimiento = ?, estado = ? WHERE id = ?',
      [fecha_vencimiento, nuevoEstado, id]
    );

    // Auditoría: cambio de fecha de vencimiento
    await registrarAuditoriaSegura({
      empresaId: cuota.empresa_id,
      usuarioId: usuarioActual.id,
      ip: getIpCliente(req),
      accion: 'UPDATE',
      tabla: 'cuotas',
      registroId: id,
      antes: { fecha_vencimiento: cuota.fecha_vencimiento, estado: cuota.estado },
      despues: { fecha_vencimiento, estado: nuevoEstado },
      observaciones: 'Cambio de fecha de vencimiento',
    });

    return res.json({ message: 'Fecha actualizada', estado: nuevoEstado });
  } catch (error) {
    return next(error);
  }
};

// POST /api/panel/cobranzas/:id/asignar
// Body: { cobrador_id, fecha_limite? }
// Asigna (o reasigna) una cuota puntual a un cobrador específico,
// para cuotas que quedaron sin cobrador (cliente nuevo, zona sin asignar, etc).
const asignarCobranza = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { cobrador_id, fecha_limite } = req.body ?? {};
    const usuarioActual = req.user;

    if (!cobrador_id) {
      conn.release(); return res.status(400).json({ message: 'cobrador_id es obligatorio' });
    }
    if (fecha_limite && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_limite)) {
      conn.release(); return res.status(400).json({ message: 'fecha_limite inválida (YYYY-MM-DD)' });
    }
    if (usuarioActual.rol !== 'SUPERVISOR' && usuarioActual.rol !== 'ADMIN') {
      conn.release(); return res.status(403).json({ message: 'Solo el supervisor o administrador puede asignar cobranzas' });
    }

    // 1. Verificar la cuota
    const [[cuota]] = await conn.query(
      `SELECT q.id, q.estado, cr.empresa_id
       FROM cuotas q
       INNER JOIN creditos cr ON cr.id = q.credito_id
       WHERE q.id = ?`,
      [id]
    );
    if (!cuota) { conn.release(); return res.status(404).json({ message: 'Cuota no encontrada' }); }
    if (cuota.estado === 'PAGADO') {
      conn.release(); return res.status(400).json({ message: 'No se puede asignar una cuota ya pagada' });
    }
    if (usuarioActual.rol !== 'ADMIN' && cuota.empresa_id !== usuarioActual.empresaId) {
      conn.release(); return res.status(403).json({ message: 'Sin permisos' });
    }

    // 2. Verificar el cobrador destino
    const [[cobrador]] = await conn.query(
      `SELECT u.id, u.empresa_id
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ? AND r.nombre = 'COBRADOR' AND u.estado = 1`,
      [cobrador_id]
    );
    if (!cobrador) {
      conn.release(); return res.status(404).json({ message: 'Cobrador no encontrado o inactivo' });
    }
    if (usuarioActual.rol !== 'ADMIN' && cobrador.empresa_id !== cuota.empresa_id) {
      conn.release(); return res.status(403).json({ message: 'El cobrador debe pertenecer a la misma empresa' });
    }

    await conn.beginTransaction();

    // 3. Revisar asignación PENDIENTE existente de la cuota
    const [[asignacionActual]] = await conn.query(
      `SELECT id, usuario_id FROM asignaciones
       WHERE cuota_id = ? AND estado = 'PENDIENTE'
       ORDER BY id DESC LIMIT 1`,
      [id]
    );

    let asignacionId;
    if (asignacionActual) {
      if (Number(asignacionActual.usuario_id) === Number(cobrador_id)) {
        // Ya está asignada al mismo cobrador: solo actualizar fecha límite si vino
        if (fecha_limite) {
          await conn.query(
            'UPDATE asignaciones SET fecha_limite = ? WHERE id = ?',
            [fecha_limite, asignacionActual.id]
          );
        }
        asignacionId = asignacionActual.id;
      } else {
        // Reasignar a otro cobrador
        await conn.query(
          `UPDATE asignaciones
           SET usuario_id = ?, supervisor_id = ?, fecha_asignacion = NOW(), fecha_limite = ?
           WHERE id = ?`,
          [cobrador_id, usuarioActual.id, fecha_limite || null, asignacionActual.id]
        );
        asignacionId = asignacionActual.id;
      }
    } else {
      const [result] = await conn.query(
        'INSERT INTO asignaciones (cuota_id, usuario_id, supervisor_id, fecha_limite) VALUES (?, ?, ?, ?)',
        [id, cobrador_id, usuarioActual.id, fecha_limite || null]
      );
      asignacionId = result.insertId;
    }

    await conn.commit();

    // Auditoría (mismo patrón que el resto del controlador)
    await registrarAuditoriaSegura({
      empresaId: cuota.empresa_id,
      usuarioId: usuarioActual.id,
      ip: getIpCliente(req),
      accion: asignacionActual ? 'UPDATE' : 'CREATE',
      tabla: 'asignaciones',
      registroId: asignacionId,
      antes: asignacionActual ? { usuario_id: asignacionActual.usuario_id } : null,
      despues: { cuota_id: id, usuario_id: cobrador_id, fecha_limite: fecha_limite || null },
      observaciones: 'Asignación puntual de cobranza',
    });

    return res.json({ message: 'Cobranza asignada', asignacion_id: asignacionId });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};

// ── Configuración de facturas (emisor + timbrado DNIT) ─────────

const resolveEmpresaIdFactura = (req) => {
  const usuarioActual = req.user;
  const paramId = req.params.empresaId ? Number(req.params.empresaId) : null;
  if (paramId) {
    if (usuarioActual.rol !== 'ADMIN' && paramId !== usuarioActual.empresaId) {
      throw Object.assign(new Error('Sin permisos'), { statusCode: 403 });
    }
    return paramId;
  }
  return usuarioActual.empresaId;
};

/**
 * GET /api/facturas-config[/:empresaId]
 * Devuelve los datos del emisor y el timbrado activo de la empresa.
 */
const getFacturaConfig = async (req, res, next) => {
  try {
    const empresaId = resolveEmpresaIdFactura(req);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

    const [[emisor]] = await pool.query(
      `SELECT id, empresa_id, razon_social, ruc, ruc_dv, direccion, actividad_economica
       FROM facturas_emisor WHERE empresa_id = ?`,
      [empresaId]
    );

    const [[timbrado]] = await pool.query(
      `SELECT id, empresa_id, numero_timbrado, establecimiento, punto_emision,
              DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
              DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
              numero_desde, numero_hasta, numero_actual, es_electronica, activo
       FROM facturas_timbrado
       WHERE empresa_id = ? AND activo = 1
       ORDER BY id DESC LIMIT 1`,
      [empresaId]
    );

    return res.json({ data: { emisor: emisor || null, timbrado: timbrado || null } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

/**
 * PUT /api/facturas-config/:empresaId
 * Actualiza el emisor (upsert 1:1) y el timbrado de la empresa.
 * Si el numero_timbrado enviado difiere del activo, se desactiva el
 * anterior (queda en el historial) y se crea uno nuevo. Si es el mismo,
 * solo se actualizan sus parametros (no se reinicia numero_actual).
 */
const updateFacturaConfig = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const empresaId = resolveEmpresaIdFactura(req);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

    const { emisor, timbrado } = req.body || {};

    await conn.beginTransaction();

    if (emisor) {
      await conn.query(
        `INSERT INTO facturas_emisor (empresa_id, razon_social, ruc, ruc_dv, direccion, actividad_economica)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           razon_social = VALUES(razon_social),
           ruc = VALUES(ruc),
           ruc_dv = VALUES(ruc_dv),
           direccion = VALUES(direccion),
           actividad_economica = VALUES(actividad_economica),
           updated_at = NOW()`,
        [
          empresaId,
          emisor.razon_social ?? null,
          emisor.ruc ?? null,
          emisor.ruc_dv ?? null,
          emisor.direccion ?? null,
          emisor.actividad_economica ?? null,
        ]
      );
    }

    if (timbrado && timbrado.numero_timbrado) {
      const establecimiento = String(timbrado.establecimiento || '001').padStart(3, '0').slice(-3);
      const puntoEmision = String(timbrado.punto_emision || '001').padStart(3, '0').slice(-3);
      const numeroDesde = Number(timbrado.numero_desde) || 1;
      const numeroHasta = Number(timbrado.numero_hasta) || 9999999;
      const esElectronica = timbrado.es_electronica ? 1 : 0;
      const fechaInicio = timbrado.fecha_inicio || null;
      const fechaVencimiento = timbrado.fecha_vencimiento || null;
      const numeroTimbrado = String(timbrado.numero_timbrado).trim();

      const [[actual]] = await conn.query(
        `SELECT id, numero_timbrado FROM facturas_timbrado
         WHERE empresa_id = ? AND activo = 1 ORDER BY id DESC LIMIT 1`,
        [empresaId]
      );

      if (actual && actual.numero_timbrado === numeroTimbrado) {
        await conn.query(
          `UPDATE facturas_timbrado
           SET establecimiento = ?, punto_emision = ?, fecha_inicio = ?, fecha_vencimiento = ?,
               numero_desde = ?, numero_hasta = ?, es_electronica = ?, updated_at = NOW()
           WHERE id = ?`,
          [establecimiento, puntoEmision, fechaInicio, fechaVencimiento, numeroDesde, numeroHasta, esElectronica, actual.id]
        );
      } else {
        if (actual) {
          await conn.query('UPDATE facturas_timbrado SET activo = 0, updated_at = NOW() WHERE id = ?', [actual.id]);
        }
        await conn.query(
          `INSERT INTO facturas_timbrado
             (empresa_id, numero_timbrado, establecimiento, punto_emision, fecha_inicio, fecha_vencimiento,
              numero_desde, numero_hasta, numero_actual, es_electronica, activo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            empresaId, numeroTimbrado, establecimiento, puntoEmision, fechaInicio, fechaVencimiento,
            numeroDesde, numeroHasta, numeroDesde, esElectronica,
          ]
        );
      }
    }

    await conn.commit();
    return res.json({ message: 'Configuración de factura actualizada' });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El número de timbrado ya está registrado' });
    }
    return next(error);
  } finally {
    conn.release();
  }
};

/**
 * GET /api/facturas-timbrado/:empresaId/historial
 * Devuelve todos los timbrados (activos e inactivos) de la empresa.
 */
const getTimbradoHistorial = async (req, res, next) => {
  try {
    const empresaId = resolveEmpresaIdFactura(req);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

    const [rows] = await pool.query(
      `SELECT id, empresa_id, numero_timbrado, establecimiento, punto_emision,
              DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
              DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
              numero_desde, numero_hasta, numero_actual, es_electronica, activo
       FROM facturas_timbrado
       WHERE empresa_id = ?
       ORDER BY id DESC`,
      [empresaId]
    );

    return res.json({ data: rows });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

/**
 * GET /api/cobrador/cobros/:id/comprobante
 * Genera el PDF del comprobante de pago (recibo de cobranza) asociado a una visita de cobro.
 * Es un comprobante simple de cobranza (no fiscal): muestra datos del cliente, cuota,
 * monto, fecha, hora, medio de pago y cobrador.
 */
const generarComprobante = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioActual = req.user;

    const [[cobro]] = await pool.query(
      `SELECT
         vc.id               AS visita_id,
         vc.fecha_hora,
         vc.monto_cobrado,
         vc.nro_comprobante,
         u.empresa_id,
         mp.nombre           AS medio_pago_nombre,
         cl.nombre           AS cliente_nombre,
         cl.apellido         AS cliente_apellido,
         cl.cedula           AS cliente_cedula,
         cl.telefono         AS cliente_telefono,
         ce.direccion        AS cliente_direccion,
         q.numero_cuota,
         cr.numero_credito,
         u.nombre            AS cobrador_nombre,
         u.apellido          AS cobrador_apellido,
         e.razon_social      AS empresa_nombre,
         e.ruc               AS empresa_ruc,
         e.direccion         AS empresa_direccion,
         e.telefono          AS empresa_telefono,
         r.numero_recibo     AS numero_recibo,
         r.aplico_nota_credito,
         r.estado            AS recibo_estado,
         r.monto_sobrepago,
         r.saldo_a_favor
       FROM visitas_cobro vc
       INNER JOIN asignaciones a ON a.id = vc.asignacion_id
       INNER JOIN cuotas q       ON q.id  = a.cuota_id
       INNER JOIN creditos cr    ON cr.id = q.credito_id
       INNER JOIN clientes cl    ON cl.id = cr.cliente_id
       LEFT JOIN usuarios u      ON u.id  = vc.cobrador_id
       LEFT JOIN empresas e      ON e.id  = u.empresa_id
       LEFT JOIN clientes_empresas ce ON ce.cliente_id = cl.id AND ce.empresa_id = u.empresa_id
       LEFT JOIN medios_pago mp  ON mp.id = vc.medio_pago_id
       LEFT JOIN recibos r       ON r.visita_cobro_id = vc.id
       WHERE vc.id = ? AND vc.resultado = 'cobrado'`,
      [id]
    );

    if (!cobro) {
      return res.status(404).json({ message: 'Comprobante no encontrado para esta visita' });
    }

    // Verificar permisos: el cobrador solo ve sus propios comprobantes
    if (usuarioActual.rol === 'COBRADOR' && cobro.empresa_id !== usuarioActual.empresaId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    // ── Generar PDF (ticket térmico 80mm) ──
    const doc = new PDFDocument({ size: [226, 800], margin: 12 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="comprobante_${cobro.visita_id}.pdf"`);
      res.send(pdfBuffer);
    });

    const fechaHora = cobro.fecha_hora ? new Date(cobro.fecha_hora) : null;
    const fechaStr = fechaHora ? fechaHora.toLocaleDateString('es-PY') : '';
    const horaStr = fechaHora ? fechaHora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '';
    const montoNum = Number(cobro.monto_cobrado || 0);
    // Solo mostrar decimales si el monto no es un número entero (evita ",00")
    const montoStr = Number.isInteger(montoNum)
      ? montoNum.toLocaleString('es-PY')
      : montoNum.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const line = () => doc.text('------------------------------------', { align: 'center' });

    // ── Encabezado: empresa ──
    if (cobro.empresa_nombre) {
      doc.fontSize(11).font('Helvetica-Bold').text(cobro.empresa_nombre, { align: 'center' });
    }
    if (cobro.empresa_ruc) {
      doc.fontSize(7).font('Helvetica').text(`RUC: ${cobro.empresa_ruc}`, { align: 'center' });
    }
    if (cobro.empresa_direccion) {
      doc.fontSize(7).font('Helvetica').text(cobro.empresa_direccion, { align: 'center' });
    }
    if (cobro.empresa_telefono) {
      doc.fontSize(7).font('Helvetica').text(`Tel: ${cobro.empresa_telefono}`, { align: 'center' });
    }
    doc.moveDown(0.4);
    line();
    doc.moveDown(0.4);

    // ── Título del comprobante ──
    doc.fontSize(13).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
    doc.fontSize(8).font('Helvetica').text('Recibo de cobranza', { align: 'center' });
    if (cobro.numero_recibo) {
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica-Bold').text(`Nro. Recibo: ${cobro.numero_recibo}`, { align: 'center' });
    }
    // Indicador de nota de crédito aplicada
    if (Number(cobro.aplico_nota_credito) === 1) {
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#CC0000')
        .text('*** NOTA DE CRÉDITO APLICADA ***', { align: 'center' });
      if (Number(cobro.monto_sobrepago) > 0) {
        doc.fontSize(8).font('Helvetica').fillColor('#CC0000')
          .text(`Sobrepago: ${Number(cobro.monto_sobrepago).toLocaleString('es-PY')} Gs.`, { align: 'center' });
      }
      if (Number(cobro.saldo_a_favor) > 0) {
        doc.fontSize(8).font('Helvetica').fillColor('#CC0000')
          .text(`Saldo a favor: ${Number(cobro.saldo_a_favor).toLocaleString('es-PY')} Gs.`, { align: 'center' });
      }
      doc.fillColor('#000000');
    }
    // Indicador de recibo anulado
    if (cobro.recibo_estado === 'ANULADO') {
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#CC0000')
        .text('*** ANULADO ***', { align: 'center' });
      doc.fillColor('#000000');
    }
    doc.moveDown(0.3);
    line();
    doc.moveDown(0.3);

    // ── Datos del cobro ──
    doc.fontSize(8).font('Helvetica');
    doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`);
    doc.text(`Medio de Pago: ${cobro.medio_pago_nombre || 'N/D'}`);
    if (cobro.nro_comprobante) doc.text(`Nro. Comprobante: ${cobro.nro_comprobante}`);
    doc.moveDown(0.3);
    line();
    doc.moveDown(0.3);

    // ── Datos del cliente ──
    doc.fontSize(8).font('Helvetica-Bold').text('CLIENTE', { align: 'center' });
    doc.font('Helvetica');
    doc.text(`${cobro.cliente_nombre || ''} ${cobro.cliente_apellido || ''}`);
    if (cobro.cliente_cedula) doc.text(`C.I.: ${cobro.cliente_cedula}`);
    if (cobro.cliente_direccion) doc.text(`${cobro.cliente_direccion}`);
    if (cobro.cliente_telefono) doc.text(`Tel: ${cobro.cliente_telefono}`);
    doc.moveDown(0.3);
    line();
    doc.moveDown(0.3);

    // ── Datos de la cuota ──
    doc.fontSize(8).font('Helvetica-Bold').text('CUOTA', { align: 'center' });
    doc.font('Helvetica');
    if (cobro.numero_credito) doc.text(`Crédito Nro: ${cobro.numero_credito}`);
    if (cobro.numero_cuota) doc.text(`Cuota Nro: ${cobro.numero_cuota}`);
    doc.moveDown(0.3);
    line();
    doc.moveDown(0.3);

    // ── Total ──
    doc.fontSize(12).font('Helvetica-Bold').text(
      `TOTAL: ${montoStr} Gs.`,
      { align: 'center' }
    );
    doc.moveDown(0.5);
    line();
    doc.moveDown(0.3);

    // ── Cobrador y firma ──
    doc.fontSize(8).font('Helvetica').text(
      `Cobrador: ${cobro.cobrador_nombre || ''} ${cobro.cobrador_apellido || ''}`.trim(),
      { align: 'center' }
    );
    doc.moveDown(1.2);
    doc.text('_____________________________', { align: 'center' });
    doc.text('Firma del Cobrador', { align: 'center' });
    doc.moveDown(0.5);
    doc.text('Gracias por su pago', { align: 'center' });

    doc.end();
  } catch (error) {
    return next(error);
  }
};

/**
 * Genera el comprobante de pago en formato A4 (para la web).
 * A diferencia de generarComprobante (ticket térmico 80mm para la app),
 * este genera un PDF tamaño A4 más presentable para entregar al cliente.
 */
const generarComprobanteA4 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioActual = req.user;

    const [[cobro]] = await pool.query(
      `SELECT
         vc.id               AS visita_id,
         vc.fecha_hora,
         vc.monto_cobrado,
         vc.nro_comprobante,
         u.empresa_id,
         mp.nombre           AS medio_pago_nombre,
         cl.nombre           AS cliente_nombre,
         cl.apellido         AS cliente_apellido,
         cl.cedula           AS cliente_cedula,
         cl.telefono         AS cliente_telefono,
         ce.direccion        AS cliente_direccion,
         q.numero_cuota,
         cr.numero_credito,
         u.nombre            AS cobrador_nombre,
         u.apellido          AS cobrador_apellido,
         e.razon_social      AS empresa_nombre,
         e.ruc               AS empresa_ruc,
         e.direccion         AS empresa_direccion,
         e.telefono          AS empresa_telefono,
         r.numero_recibo     AS numero_recibo,
         r.aplico_nota_credito,
         r.estado            AS recibo_estado,
         r.monto_sobrepago,
         r.saldo_a_favor
       FROM visitas_cobro vc
       INNER JOIN asignaciones a ON a.id = vc.asignacion_id
       INNER JOIN cuotas q       ON q.id  = a.cuota_id
       INNER JOIN creditos cr    ON cr.id = q.credito_id
       INNER JOIN clientes cl    ON cl.id = cr.cliente_id
       LEFT JOIN usuarios u      ON u.id  = vc.cobrador_id
       LEFT JOIN empresas e      ON e.id  = u.empresa_id
       LEFT JOIN clientes_empresas ce ON ce.cliente_id = cl.id AND ce.empresa_id = u.empresa_id
       LEFT JOIN medios_pago mp  ON mp.id = vc.medio_pago_id
       LEFT JOIN recibos r       ON r.visita_cobro_id = vc.id
       WHERE vc.id = ? AND vc.resultado = 'cobrado'`,
      [id]
    );

    if (!cobro) {
      return res.status(404).json({ message: 'Comprobante no encontrado para esta visita' });
    }

    // Verificar permisos: el cobrador solo ve sus propios comprobantes
    if (usuarioActual.rol === 'COBRADOR' && cobro.empresa_id !== usuarioActual.empresaId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    // ── Generar PDF (formato A4) ──
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="comprobante_${cobro.visita_id}.pdf"`);
      res.send(pdfBuffer);
    });

    const fechaHora = cobro.fecha_hora ? new Date(cobro.fecha_hora) : null;
    const fechaStr = fechaHora ? fechaHora.toLocaleDateString('es-PY') : '';
    const horaStr = fechaHora ? fechaHora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '';
    const montoNum = Number(cobro.monto_cobrado || 0);
    const montoStr = Number.isInteger(montoNum)
      ? montoNum.toLocaleString('es-PY')
      : montoNum.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Encabezado: empresa ──
    if (cobro.empresa_nombre) {
      doc.fontSize(18).font('Helvetica-Bold').text(cobro.empresa_nombre, { align: 'center' });
    }
    if (cobro.empresa_ruc) {
      doc.fontSize(10).font('Helvetica').text(`RUC: ${cobro.empresa_ruc}`, { align: 'center' });
    }
    if (cobro.empresa_direccion) {
      doc.fontSize(10).font('Helvetica').text(cobro.empresa_direccion, { align: 'center' });
    }
    if (cobro.empresa_telefono) {
      doc.fontSize(10).font('Helvetica').text(`Tel: ${cobro.empresa_telefono}`, { align: 'center' });
    }
    doc.moveDown(0.8);

    // ── Título ──
    doc.fontSize(16).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('Recibo de cobranza', { align: 'center' });
    if (cobro.numero_recibo) {
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica-Bold').text(`Nro. Recibo: ${cobro.numero_recibo}`, { align: 'center' });
    }
    // Indicador de nota de crédito aplicada
    if (Number(cobro.aplico_nota_credito) === 1) {
      doc.moveDown(0.4);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#CC0000')
        .text('*** NOTA DE CRÉDITO APLICADA ***', { align: 'center' });
      if (Number(cobro.monto_sobrepago) > 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#CC0000')
          .text(`Sobrepago: ${Number(cobro.monto_sobrepago).toLocaleString('es-PY')} Gs.`, { align: 'center' });
      }
      if (Number(cobro.saldo_a_favor) > 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#CC0000')
          .text(`Saldo a favor: ${Number(cobro.saldo_a_favor).toLocaleString('es-PY')} Gs.`, { align: 'center' });
      }
      doc.fillColor('#000000');
    }
    // Indicador de recibo anulado
    if (cobro.recibo_estado === 'ANULADO') {
      doc.moveDown(0.4);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#CC0000')
        .text('*** ANULADO ***', { align: 'center' });
      doc.fillColor('#000000');
    }
    doc.moveDown(0.8);

    // ── Línea separadora ──
    doc.moveTo(doc.page.margins.left, doc.y)
       .lineTo(doc.page.margins.left + pageWidth, doc.y)
       .lineWidth(1)
       .strokeColor('#999999')
       .stroke();
    doc.moveDown(0.8);

    // ── Datos del cobro ──
    doc.fontSize(11).font('Helvetica');
    doc.text(`Fecha: ${fechaStr}`, { continued: true });
    doc.text(`   Hora: ${horaStr}`);
    doc.text(`Medio de Pago: ${cobro.medio_pago_nombre || 'N/D'}`);
    if (cobro.nro_comprobante) doc.text(`Nro. Comprobante: ${cobro.nro_comprobante}`);
    doc.moveDown(0.8);

    // ── Datos del cliente ──
    doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL CLIENTE', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Nombre: ${cobro.cliente_nombre || ''} ${cobro.cliente_apellido || ''}`);
    if (cobro.cliente_cedula) doc.text(`C.I.: ${cobro.cliente_cedula}`);
    if (cobro.cliente_direccion) doc.text(`Dirección: ${cobro.cliente_direccion}`);
    if (cobro.cliente_telefono) doc.text(`Teléfono: ${cobro.cliente_telefono}`);
    doc.moveDown(0.8);

    // ── Datos de la cuota ──
    doc.fontSize(12).font('Helvetica-Bold').text('DATOS DE LA CUOTA', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    if (cobro.numero_credito) doc.text(`Crédito Nro: ${cobro.numero_credito}`);
    if (cobro.numero_cuota) doc.text(`Cuota Nro: ${cobro.numero_cuota}`);
    doc.moveDown(0.8);

    // ── Total ──
    doc.moveTo(doc.page.margins.left, doc.y)
       .lineTo(doc.page.margins.left + pageWidth, doc.y)
       .lineWidth(1)
       .strokeColor('#999999')
       .stroke();
    doc.moveDown(0.6);
    doc.fontSize(18).font('Helvetica-Bold').text(
      `TOTAL: ${montoStr} Gs.`,
      { align: 'center' }
    );
    doc.moveDown(0.6);
    doc.moveTo(doc.page.margins.left, doc.y)
       .lineTo(doc.page.margins.left + pageWidth, doc.y)
       .lineWidth(1)
       .strokeColor('#999999')
       .stroke();
    doc.moveDown(1);

    // ── Cobrador y firma ──
    doc.fontSize(11).font('Helvetica').text(
      `Cobrador: ${cobro.cobrador_nombre || ''} ${cobro.cobrador_apellido || ''}`.trim(),
      { align: 'center' }
    );
    doc.moveDown(1.5);
    doc.text('_____________________________', { align: 'center' });
    doc.text('Firma del Cobrador', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(10).font('Helvetica-Oblique').text('Gracias por su pago', { align: 'center' });

    doc.end();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getEmpresas,
  getClientes,
  getCobranzas,
  registrarCobro,
  updateFechaVencimiento,
  asignarCobranza,
  getGestiones,
  getUsuarios,
  getCobradores,
  getAsignacionesCobrador,
  getRoles,
  getFacturaConfig,
  updateFacturaConfig,
  getTimbradoHistorial,
  generarComprobante,
  generarComprobanteA4,
}; 