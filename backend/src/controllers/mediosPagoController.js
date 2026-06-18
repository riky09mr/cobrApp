const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
// GET /api/medios-pago
// COBRADOR  → solo activos de su empresa (para mostrar en app)
// SUP/ADMIN → todos (activos e inactivos) para gestión
// ─────────────────────────────────────────────────────────────
const getMediosPago = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;

    const params = [empresaId];
    let where = 'WHERE mp.empresa_id = ?';
    if (rol === 'COBRADOR') {
      where += ' AND mp.activo = TRUE';
    }

    const [rows] = await pool.query(
      `SELECT id, nombre, requiere_comprobante, activo
       FROM medios_pago mp
       ${where}
       ORDER BY nombre`,
      params
    );
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/medios-pago
// ─────────────────────────────────────────────────────────────
const crearMedioPago = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const { nombre, requiere_comprobante, empresa_id } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    // Admin puede especificar empresa_id; supervisor usa el propio
    const empId = rol === 'ADMIN' && empresa_id ? empresa_id : empresaId;

    const [result] = await pool.query(
      `INSERT INTO medios_pago (empresa_id, nombre, requiere_comprobante) VALUES (?, ?, ?)`,
      [empId, nombre.trim(), requiere_comprobante ? 1 : 0]
    );
    return res.status(201).json({ message: 'Medio de pago creado', id: result.insertId });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/medios-pago/:id
// ─────────────────────────────────────────────────────────────
const actualizarMedioPago = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rol, empresaId } = req.user;
    const { nombre, requiere_comprobante, activo } = req.body;

    const [[medio]] = await pool.query(
      'SELECT id, empresa_id FROM medios_pago WHERE id = ?',
      [id]
    );
    if (!medio) return res.status(404).json({ message: 'Medio de pago no encontrado' });
    if (rol !== 'ADMIN' && medio.empresa_id !== empresaId) {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    const fields = [];
    const values = [];
    if (nombre !== undefined)               { fields.push('nombre = ?');               values.push(nombre.trim()); }
    if (requiere_comprobante !== undefined) { fields.push('requiere_comprobante = ?'); values.push(requiere_comprobante ? 1 : 0); }
    if (activo !== undefined)               { fields.push('activo = ?');               values.push(activo ? 1 : 0); }

    if (!fields.length) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(id);
    await pool.query(`UPDATE medios_pago SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ message: 'Medio de pago actualizado' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMediosPago, crearMedioPago, actualizarMedioPago };
