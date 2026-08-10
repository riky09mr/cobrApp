const pool = require('../config/db');

const normalizeCode3 = (value, fieldName) => {
  const code = String(value ?? '').replace(/\D/g, '').slice(0, 3).padStart(3, '0');
  if (!/^\d{3}$/.test(code)) {
    throw Object.assign(new Error(`${fieldName} debe tener 3 dígitos`), { statusCode: 400 });
  }
  return code;
};

const normalizeStatus = (value, allowed, fieldName) => {
  if (!allowed.includes(value)) {
    throw Object.assign(new Error(`${fieldName} inválido`), { statusCode: 400 });
  }
  return value;
};

const resolveCompanyId = (req) => {
  const { rol, empresaId } = req.user;
  const requested = req.query.empresa_id || req.body.empresa_id || req.params.empresaId;
  if (rol === 'ADMIN') {
    const companyId = Number(requested || empresaId);
    if (!companyId) {
      throw Object.assign(new Error('empresa_id es requerido'), { statusCode: 400 });
    }
    return companyId;
  }
  return Number(empresaId);
};

const assertManagerRole = (req) => {
  if (!['ADMIN', 'SUPERVISOR'].includes(req.user.rol)) {
    throw Object.assign(new Error('Sin permisos'), { statusCode: 403 });
  }
};

const ensureCobradorEmpresa = async (conn, empresaId, cobradorId) => {
  if (!cobradorId) return;
  const [[row]] = await conn.query(
    `SELECT u.id
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ? AND u.empresa_id = ? AND u.estado = 1 AND r.nombre = 'COBRADOR'
     LIMIT 1`,
    [cobradorId, empresaId]
  );
  if (!row) {
    throw Object.assign(new Error('El cobrador asignado no pertenece a la empresa o no está activo'), { statusCode: 400 });
  }
};

const ensureTimbradoEmpresa = async (conn, empresaId, timbradoId) => {
  const [[row]] = await conn.query(
    `SELECT id
     FROM timbrados
     WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [timbradoId, empresaId]
  );
  if (!row) {
    throw Object.assign(new Error('El timbrado seleccionado no pertenece a la empresa'), { statusCode: 400 });
  }
};

const ensureEstablecimientoEmpresa = async (conn, empresaId, establecimientoId, timbradoId) => {
  const [[row]] = await conn.query(
    `SELECT id, timbrado_id
     FROM establecimientos
     WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [establecimientoId, empresaId]
  );
  if (!row) {
    throw Object.assign(new Error('El establecimiento seleccionado no pertenece a la empresa'), { statusCode: 400 });
  }
  if (timbradoId && row.timbrado_id && Number(row.timbrado_id) !== Number(timbradoId)) {
    throw Object.assign(new Error('El establecimiento no corresponde al timbrado seleccionado'), { statusCode: 400 });
  }
};

const listTimbrados = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);

    const [rows] = await pool.query(
      `SELECT id, empresa_id, numero_timbrado, fecha_inicio, fecha_fin, estado, observaciones,
              es_electronico, facturas_timbrado_legacy_id, created_at, updated_at
       FROM timbrados
       WHERE empresa_id = ? AND deleted_at IS NULL
       ORDER BY id DESC`,
      [empresaId]
    );
    return res.json({ data: rows });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const createTimbrado = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const {
      numero_timbrado,
      fecha_inicio,
      fecha_fin,
      estado = 'BORRADOR',
      observaciones,
      es_electronico = false,
    } = req.body;

    if (!numero_timbrado?.trim() || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ message: 'numero_timbrado, fecha_inicio y fecha_fin son requeridos' });
    }

    const estadoNormalizado = normalizeStatus(estado, ['BORRADOR', 'VIGENTE', 'VENCIDO', 'ANULADO', 'INACTIVO'], 'estado');

    await conn.beginTransaction();
    if (estadoNormalizado === 'VIGENTE') {
      await conn.query(
        `UPDATE timbrados SET estado = 'INACTIVO', updated_at = NOW(), updated_by = ?
         WHERE empresa_id = ? AND estado = 'VIGENTE' AND deleted_at IS NULL`,
        [req.user.id, empresaId]
      );
    }

    const [result] = await conn.query(
      `INSERT INTO timbrados
         (empresa_id, numero_timbrado, fecha_inicio, fecha_fin, estado, observaciones,
          es_electronico, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        numero_timbrado.trim(),
        fecha_inicio,
        fecha_fin,
        estadoNormalizado,
        observaciones?.trim() || null,
        es_electronico ? 1 : 0,
        req.user.id,
        req.user.id,
      ]
    );
    await conn.commit();
    return res.status(201).json({ message: 'Timbrado creado', id: result.insertId });
  } catch (error) {
    await conn.rollback();
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  } finally {
    conn.release();
  }
};

const updateTimbrado = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const id = Number(req.params.id);
    const { numero_timbrado, fecha_inicio, fecha_fin, estado, observaciones, es_electronico } = req.body;

    const [[timbrado]] = await conn.query(
      `SELECT id FROM timbrados WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [id, empresaId]
    );
    if (!timbrado) return res.status(404).json({ message: 'Timbrado no encontrado' });

    await conn.beginTransaction();
    if (estado === 'VIGENTE') {
      await conn.query(
        `UPDATE timbrados SET estado = 'INACTIVO', updated_at = NOW(), updated_by = ?
         WHERE empresa_id = ? AND estado = 'VIGENTE' AND id <> ? AND deleted_at IS NULL`,
        [req.user.id, empresaId, id]
      );
    }

    const fields = [];
    const values = [];
    if (numero_timbrado !== undefined) { fields.push('numero_timbrado = ?'); values.push(numero_timbrado.trim()); }
    if (fecha_inicio !== undefined) { fields.push('fecha_inicio = ?'); values.push(fecha_inicio); }
    if (fecha_fin !== undefined) { fields.push('fecha_fin = ?'); values.push(fecha_fin); }
    if (estado !== undefined) { fields.push('estado = ?'); values.push(normalizeStatus(estado, ['BORRADOR', 'VIGENTE', 'VENCIDO', 'ANULADO', 'INACTIVO'], 'estado')); }
    if (observaciones !== undefined) { fields.push('observaciones = ?'); values.push(observaciones?.trim() || null); }
    if (es_electronico !== undefined) { fields.push('es_electronico = ?'); values.push(es_electronico ? 1 : 0); }
    fields.push('updated_by = ?'); values.push(req.user.id);

    values.push(id);
    await conn.query(`UPDATE timbrados SET ${fields.join(', ')} WHERE id = ?`, values);
    await conn.commit();
    return res.json({ message: 'Timbrado actualizado' });
  } catch (error) {
    await conn.rollback();
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  } finally {
    conn.release();
  }
};

const listEstablecimientos = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const [rows] = await pool.query(
      `SELECT id, empresa_id, timbrado_id, codigo, descripcion, activo, created_at, updated_at
       FROM establecimientos
       WHERE empresa_id = ? AND deleted_at IS NULL
       ORDER BY codigo`,
      [empresaId]
    );
    return res.json({ data: rows });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const createEstablecimiento = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const { timbrado_id, codigo, descripcion, activo = true } = req.body;
    if (!timbrado_id || codigo === undefined || !descripcion?.trim()) {
      return res.status(400).json({ message: 'timbrado_id, codigo y descripcion son requeridos' });
    }
    const code = normalizeCode3(codigo, 'codigo');
    const [result] = await pool.query(
      `INSERT INTO establecimientos (empresa_id, timbrado_id, codigo, descripcion, activo, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, timbrado_id, code, descripcion.trim(), activo ? 1 : 0, req.user.id, req.user.id]
    );
    return res.status(201).json({ message: 'Establecimiento creado', id: result.insertId });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const updateEstablecimiento = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const id = Number(req.params.id);
    const { timbrado_id, codigo, descripcion, activo } = req.body;
    const [[row]] = await pool.query(
      `SELECT id FROM establecimientos WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [id, empresaId]
    );
    if (!row) return res.status(404).json({ message: 'Establecimiento no encontrado' });

    const fields = [];
    const values = [];
    if (timbrado_id !== undefined) { fields.push('timbrado_id = ?'); values.push(timbrado_id); }
    if (codigo !== undefined) { fields.push('codigo = ?'); values.push(normalizeCode3(codigo, 'codigo')); }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); values.push(descripcion.trim()); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
    fields.push('updated_by = ?'); values.push(req.user.id);
    values.push(id);
    await pool.query(`UPDATE establecimientos SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ message: 'Establecimiento actualizado' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const listPuntosExpedicion = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const [rows] = await pool.query(
      `SELECT pe.id, pe.empresa_id, pe.timbrado_id, pe.establecimiento_id, pe.codigo, pe.descripcion, pe.activo,
              e.codigo AS establecimiento_codigo
       FROM puntos_expedicion pe
       INNER JOIN establecimientos e ON e.id = pe.establecimiento_id
       WHERE pe.empresa_id = ? AND pe.deleted_at IS NULL
       ORDER BY e.codigo, pe.codigo`,
      [empresaId]
    );
    return res.json({ data: rows });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const createPuntoExpedicion = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const { timbrado_id, establecimiento_id, codigo, descripcion, activo = true } = req.body;
    if (!timbrado_id || !establecimiento_id || codigo === undefined) {
      return res.status(400).json({ message: 'timbrado_id, establecimiento_id y codigo son requeridos' });
    }
    await ensureTimbradoEmpresa(pool, empresaId, timbrado_id);
    await ensureEstablecimientoEmpresa(pool, empresaId, establecimiento_id, timbrado_id);

    const codigoNormalizado = normalizeCode3(codigo, 'codigo');
    const [[duplicate]] = await pool.query(
      `SELECT id
       FROM puntos_expedicion
       WHERE empresa_id = ? AND establecimiento_id = ? AND codigo = ? AND deleted_at IS NULL
       LIMIT 1`,
      [empresaId, establecimiento_id, codigoNormalizado]
    );
    if (duplicate) {
      return res.status(409).json({ message: 'Ya existe un punto con ese código para el establecimiento seleccionado' });
    }

    const [result] = await pool.query(
      `INSERT INTO puntos_expedicion (empresa_id, timbrado_id, establecimiento_id, codigo, descripcion, activo, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, timbrado_id, establecimiento_id, codigoNormalizado, descripcion?.trim() || null, activo ? 1 : 0, req.user.id, req.user.id]
    );
    return res.status(201).json({ message: 'Punto de expedición creado', id: result.insertId });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un punto con ese código para el establecimiento seleccionado' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Timbrado o establecimiento inválido para la empresa seleccionada' });
    }
    return next(error);
  }
};

const updatePuntoExpedicion = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const id = Number(req.params.id);
    const { timbrado_id, establecimiento_id, codigo, descripcion, activo } = req.body;
    const [[row]] = await pool.query(
      `SELECT id, timbrado_id, establecimiento_id, codigo FROM puntos_expedicion WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [id, empresaId]
    );
    if (!row) return res.status(404).json({ message: 'Punto de expedición no encontrado' });

    const nextTimbradoId = timbrado_id !== undefined ? timbrado_id : row.timbrado_id;
    const nextEstablecimientoId = establecimiento_id !== undefined ? establecimiento_id : row.establecimiento_id;
    const nextCodigo = codigo !== undefined ? normalizeCode3(codigo, 'codigo') : row.codigo;

    await ensureTimbradoEmpresa(pool, empresaId, nextTimbradoId);
    await ensureEstablecimientoEmpresa(pool, empresaId, nextEstablecimientoId, nextTimbradoId);

    const [[duplicate]] = await pool.query(
      `SELECT id
       FROM puntos_expedicion
       WHERE empresa_id = ? AND establecimiento_id = ? AND codigo = ? AND id <> ? AND deleted_at IS NULL
       LIMIT 1`,
      [empresaId, nextEstablecimientoId, nextCodigo, id]
    );
    if (duplicate) {
      return res.status(409).json({ message: 'Ya existe un punto con ese código para el establecimiento seleccionado' });
    }

    const fields = [];
    const values = [];
    if (timbrado_id !== undefined) { fields.push('timbrado_id = ?'); values.push(timbrado_id); }
    if (establecimiento_id !== undefined) { fields.push('establecimiento_id = ?'); values.push(establecimiento_id); }
    if (codigo !== undefined) { fields.push('codigo = ?'); values.push(nextCodigo); }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); values.push(descripcion?.trim() || null); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
    fields.push('updated_by = ?'); values.push(req.user.id);
    values.push(id);
    await pool.query(`UPDATE puntos_expedicion SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ message: 'Punto de expedición actualizado' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un punto con ese código para el establecimiento seleccionado' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Timbrado o establecimiento inválido para la empresa seleccionada' });
    }
    return next(error);
  }
};

const listCajas = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const [rows] = await pool.query(
      `SELECT c.id, c.empresa_id, c.punto_expedicion_id, c.nombre, c.estado, c.cobrador_asignado_id,
              c.saldo_inicial_referencia, c.saldo_actual, c.fecha_apertura_actual, c.fecha_cierre_actual,
              pe.codigo AS punto_codigo, e.codigo AS establecimiento_codigo,
              CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS cobrador_nombre
       FROM cajas c
       INNER JOIN puntos_expedicion pe ON pe.id = c.punto_expedicion_id
       INNER JOIN establecimientos e ON e.id = pe.establecimiento_id
       LEFT JOIN usuarios u ON u.id = c.cobrador_asignado_id
       WHERE c.empresa_id = ? AND c.deleted_at IS NULL
       ORDER BY e.codigo, pe.codigo, c.nombre`,
      [empresaId]
    );
    return res.json({ data: rows });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const createCaja = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const {
      punto_expedicion_id,
      nombre,
      estado = 'ACTIVA',
      cobrador_asignado_id,
      saldo_inicial_referencia = 0,
      observaciones,
    } = req.body;

    if (!punto_expedicion_id || !nombre?.trim()) {
      return res.status(400).json({ message: 'punto_expedicion_id y nombre son requeridos' });
    }

    await ensureCobradorEmpresa(pool, empresaId, cobrador_asignado_id);

    const [[conflict]] = await pool.query(
      `SELECT id FROM cajas
       WHERE punto_expedicion_id = ? AND estado = 'ACTIVA' AND deleted_at IS NULL
       LIMIT 1`,
      [punto_expedicion_id]
    );
    if (conflict && estado === 'ACTIVA') {
      return res.status(409).json({ message: 'Ya existe una caja activa para este punto de expedición' });
    }

    const [result] = await pool.query(
      `INSERT INTO cajas
         (empresa_id, punto_expedicion_id, nombre, estado, cobrador_asignado_id,
          saldo_inicial_referencia, saldo_actual, observaciones, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        empresaId,
        punto_expedicion_id,
        nombre.trim(),
        normalizeStatus(estado, ['ACTIVA', 'BLOQUEADA', 'INACTIVA'], 'estado'),
        cobrador_asignado_id || null,
        Number(saldo_inicial_referencia || 0),
        observaciones?.trim() || null,
        req.user.id,
        req.user.id,
      ]
    );
    return res.status(201).json({ message: 'Caja creada', id: result.insertId });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const updateCaja = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const id = Number(req.params.id);
    const { punto_expedicion_id, nombre, estado, cobrador_asignado_id, saldo_inicial_referencia, observaciones } = req.body;
    const [[row]] = await pool.query(
      `SELECT id, punto_expedicion_id FROM cajas WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [id, empresaId]
    );
    if (!row) return res.status(404).json({ message: 'Caja no encontrada' });

    if (cobrador_asignado_id !== undefined) {
      await ensureCobradorEmpresa(pool, empresaId, cobrador_asignado_id);
    }

    const nextPointId = punto_expedicion_id ?? row.punto_expedicion_id;
    const nextState = estado ?? null;
    if (nextState === 'ACTIVA') {
      const [[conflict]] = await pool.query(
        `SELECT id FROM cajas
         WHERE punto_expedicion_id = ? AND estado = 'ACTIVA' AND id <> ? AND deleted_at IS NULL
         LIMIT 1`,
        [nextPointId, id]
      );
      if (conflict) {
        return res.status(409).json({ message: 'Ya existe una caja activa para este punto de expedición' });
      }
    }

    const fields = [];
    const values = [];
    if (punto_expedicion_id !== undefined) { fields.push('punto_expedicion_id = ?'); values.push(punto_expedicion_id); }
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre.trim()); }
    if (estado !== undefined) { fields.push('estado = ?'); values.push(normalizeStatus(estado, ['ACTIVA', 'BLOQUEADA', 'INACTIVA'], 'estado')); }
    if (cobrador_asignado_id !== undefined) { fields.push('cobrador_asignado_id = ?'); values.push(cobrador_asignado_id || null); }
    if (saldo_inicial_referencia !== undefined) { fields.push('saldo_inicial_referencia = ?'); values.push(Number(saldo_inicial_referencia || 0)); }
    if (observaciones !== undefined) { fields.push('observaciones = ?'); values.push(observaciones?.trim() || null); }
    fields.push('updated_by = ?'); values.push(req.user.id);
    values.push(id);
    await pool.query(`UPDATE cajas SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ message: 'Caja actualizada' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const listNumeradores = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const [rows] = await pool.query(
      `SELECT n.id, n.empresa_id, n.timbrado_id, n.establecimiento_id, n.punto_expedicion_id,
              n.tipo_documento, n.serie, n.numero_desde, n.numero_hasta, n.ultimo_numero_asignado,
              n.activo, n.bloqueado,
              e.codigo AS establecimiento_codigo, pe.codigo AS punto_codigo, t.numero_timbrado
       FROM numeradores n
       INNER JOIN establecimientos e ON e.id = n.establecimiento_id
       INNER JOIN puntos_expedicion pe ON pe.id = n.punto_expedicion_id
       INNER JOIN timbrados t ON t.id = n.timbrado_id
       WHERE n.empresa_id = ? AND n.deleted_at IS NULL
       ORDER BY e.codigo, pe.codigo, n.tipo_documento`,
      [empresaId]
    );
    return res.json({ data: rows });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const createNumerador = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const {
      timbrado_id,
      establecimiento_id,
      punto_expedicion_id,
      tipo_documento = 'RECIBO_COBRANZA',
      serie = 'A1',
      numero_desde = 1,
      numero_hasta = 9999999,
      ultimo_numero_asignado = 0,
      activo = true,
      bloqueado = false,
    } = req.body;

    if (!timbrado_id || !establecimiento_id || !punto_expedicion_id) {
      return res.status(400).json({ message: 'timbrado_id, establecimiento_id y punto_expedicion_id son requeridos' });
    }

    const [result] = await pool.query(
      `INSERT INTO numeradores
         (empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id, tipo_documento, serie,
          numero_desde, numero_hasta, ultimo_numero_asignado, activo, bloqueado, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        timbrado_id,
        establecimiento_id,
        punto_expedicion_id,
        tipo_documento,
        serie.trim() || 'A1',
        Number(numero_desde),
        Number(numero_hasta),
        Number(ultimo_numero_asignado),
        activo ? 1 : 0,
        bloqueado ? 1 : 0,
        req.user.id,
        req.user.id,
      ]
    );
    return res.status(201).json({ message: 'Numerador creado', id: result.insertId });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const updateNumerador = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const id = Number(req.params.id);
    const {
      timbrado_id,
      establecimiento_id,
      punto_expedicion_id,
      tipo_documento,
      serie,
      numero_desde,
      numero_hasta,
      ultimo_numero_asignado,
      activo,
      bloqueado,
    } = req.body;

    const [[row]] = await pool.query(
      `SELECT id FROM numeradores WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [id, empresaId]
    );
    if (!row) return res.status(404).json({ message: 'Numerador no encontrado' });

    const fields = [];
    const values = [];
    if (timbrado_id !== undefined) { fields.push('timbrado_id = ?'); values.push(timbrado_id); }
    if (establecimiento_id !== undefined) { fields.push('establecimiento_id = ?'); values.push(establecimiento_id); }
    if (punto_expedicion_id !== undefined) { fields.push('punto_expedicion_id = ?'); values.push(punto_expedicion_id); }
    if (tipo_documento !== undefined) { fields.push('tipo_documento = ?'); values.push(tipo_documento); }
    if (serie !== undefined) { fields.push('serie = ?'); values.push(serie.trim() || 'A1'); }
    if (numero_desde !== undefined) { fields.push('numero_desde = ?'); values.push(Number(numero_desde)); }
    if (numero_hasta !== undefined) { fields.push('numero_hasta = ?'); values.push(Number(numero_hasta)); }
    if (ultimo_numero_asignado !== undefined) { fields.push('ultimo_numero_asignado = ?'); values.push(Number(ultimo_numero_asignado)); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
    if (bloqueado !== undefined) { fields.push('bloqueado = ?'); values.push(bloqueado ? 1 : 0); }
    fields.push('updated_by = ?'); values.push(req.user.id);
    values.push(id);
    await pool.query(`UPDATE numeradores SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ message: 'Numerador actualizado' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

module.exports = {
  listTimbrados,
  createTimbrado,
  updateTimbrado,
  listEstablecimientos,
  createEstablecimiento,
  updateEstablecimiento,
  listPuntosExpedicion,
  createPuntoExpedicion,
  updatePuntoExpedicion,
  listCajas,
  createCaja,
  updateCaja,
  listNumeradores,
  createNumerador,
  updateNumerador,
};