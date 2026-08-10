const pool = require('../config/db');

const createEmpresa = async (req, res, next) => {
  try {
    const { rol } = req.user;
    if (rol !== 'ADMIN') return res.status(403).json({ message: 'Sin permisos' });

    const { razon_social, ruc, telefono, email, direccion } = req.body;

    if (!razon_social?.trim()) {
      return res.status(400).json({ message: 'La razón social es requerida' });
    }

    const [result] = await pool.query(
      `INSERT INTO empresas (razon_social, ruc, telefono, email, direccion, estado)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [
        razon_social.trim(),
        ruc?.trim() || null,
        telefono?.trim() || null,
        email?.trim() || null,
        direccion?.trim() || null,
      ]
    );

    return res.status(201).json({ data: { id: result.insertId }, message: 'Empresa creada' });
  } catch (error) {
    return next(error);
  }
};

const updateEstadoEmpresa = async (req, res, next) => {
  try {
    const { rol } = req.user;
    if (rol !== 'ADMIN') return res.status(403).json({ message: 'Sin permisos' });

    const id = parseInt(req.params.id, 10);
    const { estado } = req.body;

    if (typeof estado !== 'boolean') {
      return res.status(400).json({ message: 'El estado debe ser booleano' });
    }

    const [result] = await pool.query('UPDATE empresas SET estado = ? WHERE id = ?', [estado, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    return res.json({ message: estado ? 'Empresa activada' : 'Empresa inactivada' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createEmpresa,
  updateEstadoEmpresa,
};
