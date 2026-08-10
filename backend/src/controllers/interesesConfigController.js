const pool = require('../config/db');
const {
  getConfig,
  getFeriados,
  recalcularInteresesEmpresa,
  todayLocal,
} = require('../services/cobranzas/interesService');
const {
  sincronizarFeriadosAnio,
} = require('../services/cobranzas/feriadosAnualService');

const resolveCompanyId = (req) => {
  const { rol, empresaId } = req.user;
  const requested = (req.query && req.query.empresa_id) || (req.body && req.body.empresa_id) || (req.params && req.params.empresaId);
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

const toInt01 = (value) => (value === true || value === 1 || value === '1' ? 1 : 0);

/**
 * GET /api/configuracion/intereses
 * Devuelve la configuracion de intereses y la lista de feriados de la empresa.
 */
const getConfiguracion = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);

    const config = await getConfig(empresaId);

    // Aseguramos que el año actual tenga su plantilla de feriados.
    // Si el cron del 1 de enero aún no corrió (o es un año nuevo), se
    // sincroniza acá en caliente: los fijos vuelven a su fecha original
    // y Semana Santa se recalcula con Computus.
    const anioActual = Number(todayLocal().slice(0, 4));
    const [[check]] = await pool.query(
      'SELECT COUNT(*) AS total FROM empresas_feriados WHERE empresa_id = ? AND deleted_at IS NULL AND YEAR(fecha) = ?',
      [empresaId, anioActual]
    );
    if (check.total === 0) {
      await sincronizarFeriadosAnio(empresaId, anioActual);
    }

    const [feriados] = await pool.query(
      `SELECT id, empresa_id,
              DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              DATE_FORMAT(fecha_original, '%Y-%m-%d') AS fecha_original,
              descripcion, origen, created_at, updated_at
       FROM empresas_feriados
       WHERE empresa_id = ? AND deleted_at IS NULL
       ORDER BY fecha ASC`,
      [empresaId]
    );

    return res.json({ data: { config, feriados } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

/**
 * PUT /api/configuracion/intereses
 * Actualiza la configuracion de intereses de la empresa.
 * Body: { generar_interes, dias_gracia, porcentaje_interes_diario,
 *         contar_domingos, contar_feriados }
 */
const updateConfiguracion = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const {
      generar_interes,
      dias_gracia,
      porcentaje_interes_diario,
      contar_domingos,
      contar_feriados,
    } = req.body;

    const diasGracia = Number(dias_gracia);
    if (diasGracia < 0 || !Number.isInteger(diasGracia)) {
      return res.status(400).json({ message: 'dias_gracia debe ser un entero >= 0' });
    }

    const porcentaje = Number(porcentaje_interes_diario);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ message: 'porcentaje_interes_diario debe estar entre 0 y 100' });
    }

    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO empresas_intereses_config
         (empresa_id, generar_interes, dias_gracia, porcentaje_interes_diario,
          contar_domingos, contar_feriados, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         generar_interes = VALUES(generar_interes),
         dias_gracia = VALUES(dias_gracia),
         porcentaje_interes_diario = VALUES(porcentaje_interes_diario),
         contar_domingos = VALUES(contar_domingos),
         contar_feriados = VALUES(contar_feriados),
         updated_by = VALUES(updated_by),
         updated_at = NOW()`,
      [
        empresaId,
        toInt01(generar_interes),
        diasGracia,
        porcentaje,
        toInt01(contar_domingos),
        toInt01(contar_feriados),
        req.user.id,
        req.user.id,
      ]
    );

    await conn.commit();
    return res.json({ message: 'Configuración de intereses actualizada' });
  } catch (error) {
    await conn.rollback();
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  } finally {
    conn.release();
  }
};

/**
 * POST /api/configuracion/intereses/feriados
 * Agrega un feriado por decreto presidencial a la empresa.
 * Máximo 2 feriados por decreto; solo esos se pueden eliminar.
 * Body: { fecha: 'YYYY-MM-DD', descripcion?, aplicar_a_todas? }
 * Si aplicar_a_todas es true (solo ADMIN), se agrega el mismo feriado
 * en todas las empresas activas (respetando el límite de 2 por empresa).
 */
const createFeriado = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    assertManagerRole(req);
    const { fecha, descripcion } = req.body;
    const aplicarATodas = Boolean(req.body.aplicar_a_todas) && req.user.rol === 'ADMIN';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
      return res.status(400).json({ message: 'fecha debe tener formato YYYY-MM-DD' });
    }

    if (aplicarATodas) {
      const [empresas] = await conn.query('SELECT id FROM empresas WHERE estado = TRUE ORDER BY id');
      const creadas = [];
      const omitidas = [];
      for (const empresa of empresas) {
        const [[{ n }]] = await conn.query(
          `SELECT COUNT(*) AS n
           FROM empresas_feriados
           WHERE empresa_id = ? AND deleted_at IS NULL AND origen = 'DECRETO'`,
          [empresa.id]
        );
        if (n >= 2) {
          omitidas.push({ empresa_id: empresa.id, motivo: 'Límite de 2 feriados por decreto alcanzado' });
          continue;
        }
        try {
          await conn.query(
            `INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, origen, created_by, updated_by)
             VALUES (?, ?, ?, 'DECRETO', ?, ?)`,
            [empresa.id, fecha, descripcion?.trim() || null, req.user.id, req.user.id]
          );
          creadas.push(empresa.id);
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            omitidas.push({ empresa_id: empresa.id, motivo: 'La fecha ya está registrada como feriado' });
          } else {
            throw err;
          }
        }
      }
      return res.status(201).json({
        message: `Feriado por decreto agregado en ${creadas.length} empresa(s)${omitidas.length ? `, omitido en ${omitidas.length}` : ''}`,
        creadas,
        omitidas,
      });
    }

    const empresaId = resolveCompanyId(req);
    await conn.beginTransaction();

    // Límite de 2 feriados por decreto presidencial (Ley 6631/2020).
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n
       FROM empresas_feriados
       WHERE empresa_id = ? AND deleted_at IS NULL AND origen = 'DECRETO'`,
      [empresaId]
    );
    if (n >= 2) {
      await conn.rollback();
      return res.status(409).json({ message: 'Límite: solo 2 feriados por decreto presidencial' });
    }

    const [result] = await conn.query(
      `INSERT INTO empresas_feriados (empresa_id, fecha, descripcion, origen, created_by, updated_by)
       VALUES (?, ?, ?, 'DECRETO', ?, ?)`,
      [empresaId, fecha, descripcion?.trim() || null, req.user.id, req.user.id]
    );
    await conn.commit();
    return res.status(201).json({ message: 'Feriado por decreto presidencial agregado', id: result.insertId });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'La fecha ya está registrada como feriado' });
    }
    return next(error);
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/configuracion/intereses/feriados/:id
 * Elimina (soft delete) SOLO feriados por decreto presidencial.
 */
const deleteFeriado = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const feriadoId = Number(req.params.id);

    const [[feriado]] = await pool.query(
      `SELECT origen
       FROM empresas_feriados
       WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [feriadoId, empresaId]
    );

    if (!feriado) {
      return res.status(404).json({ message: 'Feriado no encontrado' });
    }
    if (feriado.origen !== 'DECRETO') {
      return res.status(403).json({ message: 'Solo los feriados por decreto presidencial se pueden eliminar' });
    }

    const [result] = await pool.query(
      `UPDATE empresas_feriados
       SET deleted_at = NOW(), updated_by = ?
       WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [req.user.id, feriadoId, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Feriado no encontrado' });
    }
    return res.json({ message: 'Feriado por decreto eliminado' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

/**
 * PUT /api/configuracion/intereses/feriados/:id
 * Modifica la fecha y/o descripcion de un feriado fijo (MANUAL) o por
 * decreto. Los de Semana Santa se calculan automáticamente y no se
 * pueden editar.
 * Body: { fecha: 'YYYY-MM-DD', descripcion?, aplicar_a_todas? }
 * Si aplicar_a_todas es true (solo ADMIN), se replica el mismo cambio
 * de fecha/descripcion al feriado equivalente (mismo origen y misma
 * fecha anterior) de las demás empresas activas.
 */
const updateFeriado = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const feriadoId = Number(req.params.id);
    const { fecha, descripcion } = req.body;
    const aplicarATodas = Boolean(req.body.aplicar_a_todas) && req.user.rol === 'ADMIN';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
      return res.status(400).json({ message: 'fecha debe tener formato YYYY-MM-DD' });
    }

    await conn.beginTransaction();

    const [[feriado]] = await conn.query(
      `SELECT origen, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha
       FROM empresas_feriados
       WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [feriadoId, empresaId]
    );

    if (!feriado) {
      await conn.rollback();
      return res.status(404).json({ message: 'Feriado no encontrado' });
    }
    if (feriado.origen === 'jueves_santo' || feriado.origen === 'viernes_santo') {
      await conn.rollback();
      return res.status(400).json({ message: 'La fecha de Semana Santa se calcula automáticamente' });
    }

    const [result] = await conn.query(
      `UPDATE empresas_feriados
       SET fecha = ?, descripcion = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
      [fecha, descripcion?.trim() || null, req.user.id, feriadoId, empresaId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Feriado no encontrado' });
    }

    await conn.commit();

    if (!aplicarATodas) {
      return res.json({ message: 'Feriado actualizado' });
    }

    // Propaga el mismo cambio al feriado equivalente (mismo origen y
    // misma fecha anterior) de las demás empresas activas.
    const [siblings] = await conn.query(
      `SELECT ef.id, ef.empresa_id
       FROM empresas_feriados ef
       JOIN empresas e ON e.id = ef.empresa_id
       WHERE ef.origen = ? AND ef.fecha = ? AND ef.deleted_at IS NULL
         AND ef.empresa_id != ? AND e.estado = TRUE`,
      [feriado.origen, feriado.fecha, empresaId]
    );

    const actualizadas = [];
    const omitidas = [];
    for (const sibling of siblings) {
      try {
        const [r] = await conn.query(
          `UPDATE empresas_feriados
           SET fecha = ?, descripcion = ?, updated_by = ?, updated_at = NOW()
           WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL`,
          [fecha, descripcion?.trim() || null, req.user.id, sibling.id, sibling.empresa_id]
        );
        if (r.affectedRows > 0) actualizadas.push(sibling.empresa_id);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          omitidas.push({ empresa_id: sibling.empresa_id, motivo: 'La fecha ya está registrada como feriado' });
        } else {
          throw err;
        }
      }
    }

    return res.json({
      message: `Feriado actualizado en ${1 + actualizadas.length} empresa(s)${omitidas.length ? `, omitido en ${omitidas.length}` : ''}`,
      actualizadas,
      omitidas,
    });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'La fecha ya está registrada como feriado' });
    }
    return next(error);
  } finally {
    conn.release();
  }
};

/**
 * POST /api/configuracion/intereses/recalcular
 * Recalcula interes_acumulado y dias_retraso de las cuotas vencidas
 * de la empresa. Body opcional: { fecha_corte: 'YYYY-MM-DD' }
 */
const recalcular = async (req, res, next) => {
  try {
    assertManagerRole(req);
    const empresaId = resolveCompanyId(req);
    const { fecha_corte } = req.body || {};

    const fechaCorte = fecha_corte || todayLocal();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) {
      return res.status(400).json({ message: 'fecha_corte debe tener formato YYYY-MM-DD' });
    }

    const resultado = await recalcularInteresesEmpresa(empresaId, fechaCorte);
    return res.json({
      message: 'Intereses recalculados',
      data: { fecha_corte: fechaCorte, ...resultado },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

module.exports = {
  getConfiguracion,
  updateConfiguracion,
  createFeriado,
  updateFeriado,
  deleteFeriado,
  recalcular,
};
