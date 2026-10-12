const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

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

const updateEmpresa = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const id = parseInt(req.params.id, 10);
    const { razon_social, ruc, telefono, email, direccion } = req.body;

    if (!razon_social?.trim()) {
      return res.status(400).json({ message: 'La razón social es requerida' });
    }

    // Los usuarios no-ADMIN solo pueden editar su propia empresa
    let query = `UPDATE empresas
       SET razon_social = ?, ruc = ?, telefono = ?, email = ?, direccion = ?
       WHERE id = ?`;
    const params = [
      razon_social.trim(),
      ruc?.trim() || null,
      telefono?.trim() || null,
      email?.trim() || null,
      direccion?.trim() || null,
      id,
    ];

    if (rol !== 'ADMIN') {
      query += ' AND id = ?';
      params.push(empresaId);
    }

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    return res.json({ message: 'Empresa actualizada' });
  } catch (error) {
    return next(error);
  }
};

const uploadLogoEmpresa = async (req, res, next) => {
  try {
    const { rol, empresaId } = req.user;
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ message: 'Debe adjuntar un archivo de imagen' });
    }

    // Verificar que la empresa exista (y que el usuario no-ADMIN solo edite la suya)
    let query = 'SELECT id, logo_url FROM empresas WHERE id = ?';
    const params = [id];
    if (rol !== 'ADMIN') {
      query += ' AND id = ?';
      params.push(empresaId);
    }
    const [rows] = await pool.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const logoDir = path.join(__dirname, '../../uploads/logos');
    if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `empresa_${id}${ext}`;
    const filePath = path.join(logoDir, filename);

    // Eliminar logo anterior si existe (y no es el mismo archivo)
    const logoAnterior = rows[0].logo_url;
    if (logoAnterior && logoAnterior.startsWith('/uploads/logos/')) {
      const anteriorPath = path.join(__dirname, '../../', logoAnterior.replace(/^\//, ''));
      if (fs.existsSync(anteriorPath) && anteriorPath !== filePath) {
        fs.unlinkSync(anteriorPath);
      }
    }

    fs.writeFileSync(filePath, req.file.buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    await pool.query('UPDATE empresas SET logo_url = ? WHERE id = ?', [logoUrl, id]);

    return res.json({ message: 'Logo actualizado', data: { logo_url: logoUrl } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createEmpresa,
  updateEmpresa,
  updateEstadoEmpresa,
  uploadLogoEmpresa,
};
