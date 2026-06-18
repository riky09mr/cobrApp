const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const register = async (req, res, next) => {
  try {
    const { nombreEmpresa, email, password, nombre = 'Admin', apellido = 'Principal' } = req.body;

    if (!nombreEmpresa || !email || !password) {
      return res.status(400).json({ message: 'nombreEmpresa, email y password son requeridos' });
    }

    const [existingUsers] = await pool.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const [empresaResult] = await pool.query(
      'INSERT INTO empresas (razon_social, email) VALUES (?, ?)',
      [nombreEmpresa, email]
    );

    const empresaId = empresaResult.insertId;

    await pool.query(
      'INSERT INTO roles (nombre, descripcion) VALUES (?, ?) ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)',
      ['ADMIN', 'Administrador de empresa']
    );

    const [roles] = await pool.query('SELECT id FROM roles WHERE nombre = ? LIMIT 1', ['ADMIN']);
    const rolId = roles[0].id;

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const [usuarioResult] = await pool.query(
      'INSERT INTO usuarios (empresa_id, rol_id, nombre, apellido, email, password) VALUES (?, ?, ?, ?, ?, ?)',
      [empresaId, rolId, nombre, apellido, email, hashedPassword]
    );

    return res.status(201).json({
      message: 'Registro exitoso',
      data: {
        empresaId,
        usuarioId: usuarioResult.insertId,
        email,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email y password son requeridos' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.password, u.empresa_id, u.rol_id, u.debe_cambiar_password, r.nombre AS rol,
              e.razon_social AS empresa_nombre, e.logo_url AS empresa_logo
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE u.email = ? AND u.estado = TRUE
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = rows[0];

    const isHashedPassword = /^\$2[aby]\$/.test(user.password);
    let isValidPassword = false;

    if (isHashedPassword) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else if (user.password === password) {
      const migratedHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [migratedHash, user.id]);
      isValidPassword = true;
    }

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        empresaId: user.empresa_id,
        rol_id: user.rol_id,
        rol: user.rol,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const debeCambiarPassword = user.debe_cambiar_password === 1 || user.debe_cambiar_password === true;

    return res.json({
      message: 'Login exitoso',
      token,
      debeCambiarPassword,
      data: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        empresaId: user.empresa_id,
        rol: user.rol,
        empresa_nombre: user.empresa_nombre ?? null,
        empresa_logo: user.empresa_logo ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
};
