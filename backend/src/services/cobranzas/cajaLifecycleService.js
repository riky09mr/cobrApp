const { createServiceError } = require('./serviceError');
const { getExistingTables, hasAllTables } = require('./schemaSupport');
const { toMysqlLocal, toDateLocal } = require('./time');

const V12_CAJA_TABLES = ['cajas', 'caja_aperturas', 'caja_movimientos', 'cierres_caja'];

const hasV12CajaTables = async (conn) => {
  const existingTables = await getExistingTables(conn, V12_CAJA_TABLES);
  return hasAllTables(existingTables, V12_CAJA_TABLES);
};

const getCajaAsignada = async (conn, { cobradorId }) => {
  const [[caja]] = await conn.query(
    `SELECT
       c.id,
       c.empresa_id,
       c.punto_expedicion_id,
       c.nombre,
       c.estado,
       c.saldo_actual
     FROM cajas c
     WHERE c.cobrador_asignado_id = ?
       AND c.estado = 'ACTIVA'
       AND c.deleted_at IS NULL
     ORDER BY c.id DESC
     LIMIT 1
     FOR UPDATE`,
    [cobradorId]
  );

  return caja || null;
};

const getAperturaV12Abierta = async (conn, { cobradorId }) => {
  const [[apertura]] = await conn.query(
    `SELECT
       ca.id,
       ca.empresa_id,
       ca.caja_id,
       ca.cobrador_id,
       ca.fecha_operacion,
       ca.fecha_hora_apertura,
       ca.saldo_inicial,
       ca.saldo_actual,
       c.nombre AS caja_nombre
     FROM caja_aperturas ca
     INNER JOIN cajas c ON c.id = ca.caja_id
     WHERE ca.cobrador_id = ?
       AND ca.estado = 'ABIERTA'
       AND ca.deleted_at IS NULL
       AND c.deleted_at IS NULL
     ORDER BY ca.id DESC
     LIMIT 1
     FOR UPDATE`,
    [cobradorId]
  );

  return apertura || null;
};

const abrirCajaV12IfConfigured = async (conn, {
  cobradorId,
  empresaId,
  saldoInicial,
  ip,
  latitud,
  longitud,
}) => {
  if (!(await hasV12CajaTables(conn))) {
    return null;
  }

  const aperturaExistente = await getAperturaV12Abierta(conn, { cobradorId });
  if (aperturaExistente) {
    throw createServiceError(409, 'Ya tienes una caja V12 abierta. Debes cerrarla antes de abrir una nueva.');
  }

  const caja = await getCajaAsignada(conn, { cobradorId });
  if (!caja) {
    return null;
  }

  const fechaHoraApertura = toMysqlLocal();
  const fechaOperacion = toDateLocal();
  const montoInicial = Number(saldoInicial || 0);

  const [aperturaResult] = await conn.query(
    `INSERT INTO caja_aperturas
       (empresa_id, caja_id, cobrador_id, fecha_operacion, fecha_hora_apertura,
        saldo_inicial, saldo_actual, estado, ip_apertura,
        gps_apertura_latitud, gps_apertura_longitud, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ABIERTA', ?, ?, ?, ?, ?)`,
    [
      empresaId,
      caja.id,
      cobradorId,
      fechaOperacion,
      fechaHoraApertura,
      montoInicial,
      montoInicial,
      ip || null,
      latitud || null,
      longitud || null,
      cobradorId,
      cobradorId,
    ]
  );

  const aperturaId = aperturaResult.insertId;

  await conn.query(
    `INSERT INTO caja_movimientos
       (empresa_id, caja_id, caja_apertura_id, tipo_movimiento, sentido_saldo,
        importe, saldo_anterior, saldo_posterior, descripcion, referencia_tabla,
        referencia_id, fecha_hora_movimiento, created_by, updated_by)
     VALUES (?, ?, ?, 'INGRESO', 'SUMA', ?, 0, ?, ?, 'caja_aperturas', ?, ?, ?, ?)`,
    [
      empresaId,
      caja.id,
      aperturaId,
      montoInicial,
      montoInicial,
      'Apertura de caja',
      aperturaId,
      fechaHoraApertura,
      cobradorId,
      cobradorId,
    ]
  );

  await conn.query(
    `UPDATE cajas
     SET saldo_actual = ?, fecha_apertura_actual = ?, fecha_cierre_actual = NULL, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [montoInicial, fechaHoraApertura, cobradorId, caja.id]
  );

  return {
    cajaId: caja.id,
    cajaAperturaId: aperturaId,
  };
};

const registrarGastoV12IfPresent = async (conn, {
  cobradorId,
  concepto,
  monto,
  empresaId,
}) => {
  if (!(await hasV12CajaTables(conn))) {
    return null;
  }

  const apertura = await getAperturaV12Abierta(conn, { cobradorId });
  if (!apertura) {
    return null;
  }

  const importe = Number(monto);
  const saldoAnterior = Number(apertura.saldo_actual || 0);
  const saldoPosterior = saldoAnterior - importe;
  const fechaHora = toMysqlLocal();

  const [result] = await conn.query(
    `INSERT INTO caja_movimientos
       (empresa_id, caja_id, caja_apertura_id, tipo_movimiento, sentido_saldo,
        importe, saldo_anterior, saldo_posterior, descripcion, referencia_tabla,
        referencia_id, fecha_hora_movimiento, created_by, updated_by)
     VALUES (?, ?, ?, 'EGRESO', 'RESTA', ?, ?, ?, ?, 'movimientos_caja', NULL, ?, ?, ?)`,
    [
      empresaId,
      apertura.caja_id,
      apertura.id,
      importe,
      saldoAnterior,
      saldoPosterior,
      concepto,
      fechaHora,
      cobradorId,
      cobradorId,
    ]
  );

  await conn.query(
    `UPDATE caja_aperturas
     SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [saldoPosterior, cobradorId, apertura.id]
  );

  await conn.query(
    `UPDATE cajas
     SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [saldoPosterior, cobradorId, apertura.caja_id]
  );

  return {
    movimientoId: result.insertId,
    cajaAperturaId: apertura.id,
    cajaId: apertura.caja_id,
  };
};

const cerrarCajaV12IfPresent = async (conn, {
  cobradorId,
  saldoContado,
  observacion,
  empresaId,
}) => {
  if (!(await hasV12CajaTables(conn))) {
    return null;
  }

  const apertura = await getAperturaV12Abierta(conn, { cobradorId });
  if (!apertura) {
    return null;
  }

  const [[resumen]] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN sentido_saldo = 'SUMA'
          AND NOT (tipo_movimiento = 'INGRESO' AND referencia_tabla = 'caja_aperturas' AND referencia_id = ?)
         THEN importe ELSE 0 END), 0) AS total_ingresos,
       COALESCE(SUM(CASE
         WHEN sentido_saldo = 'RESTA' AND tipo_movimiento <> 'CIERRE'
         THEN importe ELSE 0 END), 0) AS total_egresos
     FROM caja_movimientos
     WHERE caja_apertura_id = ?`,
    [apertura.id, apertura.id]
  );

  const saldoInicial = Number(apertura.saldo_inicial || 0);
  const totalIngresos = Number(resumen.total_ingresos || 0);
  const totalEgresos = Number(resumen.total_egresos || 0);
  const saldoEsperado = saldoInicial + totalIngresos - totalEgresos;
  const saldoDeclarado = Number(saldoContado);
  const diferencia = saldoDeclarado - saldoEsperado;
  const fechaHoraCierre = toMysqlLocal();

  const [[cierreExistente]] = await conn.query(
    `SELECT id FROM cierres_caja WHERE caja_apertura_id = ? LIMIT 1`,
    [apertura.id]
  );
  if (cierreExistente) {
    throw createServiceError(409, 'La apertura V12 ya tiene un cierre registrado');
  }

  const [cierreResult] = await conn.query(
    `INSERT INTO cierres_caja
       (empresa_id, caja_id, caja_apertura_id, cobrador_id, fecha_hora_cierre,
        saldo_inicial, total_ingresos, total_egresos, saldo_esperado, saldo_declarado,
        diferencia, observaciones, ip_cierre, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      empresaId,
      apertura.caja_id,
      apertura.id,
      cobradorId,
      fechaHoraCierre,
      saldoInicial,
      totalIngresos,
      totalEgresos,
      saldoEsperado,
      saldoDeclarado,
      diferencia,
      observacion || null,
      cobradorId,
      cobradorId,
    ]
  );

  await conn.query(
    `INSERT INTO caja_movimientos
       (empresa_id, caja_id, caja_apertura_id, cierre_caja_id, tipo_movimiento, sentido_saldo,
        importe, saldo_anterior, saldo_posterior, descripcion, referencia_tabla,
        referencia_id, fecha_hora_movimiento, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'CIERRE', 'RESTA', ?, ?, 0, ?, 'cierres_caja', ?, ?, ?, ?)`,
    [
      empresaId,
      apertura.caja_id,
      apertura.id,
      cierreResult.insertId,
      saldoEsperado,
      saldoEsperado,
      'Cierre de caja',
      cierreResult.insertId,
      fechaHoraCierre,
      cobradorId,
      cobradorId,
    ]
  );

  await conn.query(
    `UPDATE caja_aperturas
     SET estado = 'CERRADA', saldo_actual = 0, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [cobradorId, apertura.id]
  );

  await conn.query(
    `UPDATE cajas
     SET saldo_actual = 0, fecha_cierre_actual = ?, fecha_apertura_actual = NULL, updated_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [fechaHoraCierre, cobradorId, apertura.caja_id]
  );

  return {
    cajaId: apertura.caja_id,
    cajaAperturaId: apertura.id,
    cierreId: cierreResult.insertId,
    saldoEsperado,
    saldoContado: saldoDeclarado,
    diferencia,
  };
};

module.exports = {
  abrirCajaV12IfConfigured,
  registrarGastoV12IfPresent,
  cerrarCajaV12IfPresent,
};