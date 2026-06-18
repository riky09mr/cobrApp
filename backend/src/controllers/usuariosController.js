const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

// Mapeo de roles
const ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  COBRADOR: 'COBRADOR',
};

const createUsuario = async (req, res, next) => {
  try {
    let { nombre, apellido, cedula, telefono, email, password, rol_id, empresa_id } = req.body;

    // Validar campos requeridos básicos
    if (!nombre || !apellido || !email || !rol_id) {
      return res.status(400).json({
        message: 'Campos requeridos: nombre, apellido, email, rol_id',
      });
    }

    // Obtener el rol del usuario autenticado
    const usuarioActual = req.user;
    let nombreRolActual;

    // Si el token tiene rol_id, buscar el rol por ID
    if (usuarioActual.rol_id) {
      const [[rolActual]] = await pool.query(
        'SELECT nombre FROM roles WHERE id = ?',
        [usuarioActual.rol_id]
      );
      
      if (!rolActual) {
        return res.status(403).json({ message: 'Rol del usuario no encontrado' });
      }
      
      nombreRolActual = rolActual.nombre;
    } 
    // Si el token antiguo solo tiene "rol", usarlo directamente
    else if (usuarioActual.rol) {
      nombreRolActual = usuarioActual.rol;
    } 
    else {
      return res.status(403).json({ message: 'Información de rol no disponible. Por favor, inicie sesión nuevamente.' });
    }

    // Validar permisos según el rol
    if (nombreRolActual === ROLES.COBRADOR) {
      return res.status(403).json({ message: 'No tienes permisos para crear usuarios' });
    }

    // Si es SUPERVISOR, usar automáticamente su empresa_id
    if (nombreRolActual === ROLES.SUPERVISOR) {
      empresa_id = usuarioActual.empresaId;
    } else if (!empresa_id) {
      // Si es ADMIN, validar que empresa_id sea requerido
      return res.status(400).json({ message: 'empresa_id es requerido' });
    }

    // Obtener el rol que se quiere asignar al nuevo usuario
    const [[rolNuevo]] = await pool.query(
      'SELECT nombre FROM roles WHERE id = ?',
      [rol_id]
    );

    if (!rolNuevo) {
      return res.status(400).json({ message: 'Rol seleccionado no válido' });
    }

    const nombreRolNuevo = rolNuevo.nombre;

    // Si es SUPERVISOR, solo puede crear SUPERVISOR o COBRADOR
    if (nombreRolActual === ROLES.SUPERVISOR) {
      if (nombreRolNuevo === ROLES.ADMIN) {
        return res.status(403).json({
          message: 'Los supervisores no pueden crear usuarios con rol ADMIN',
        });
      }
    }

    // Validar que el email no esté repetido
    const [[emailExistente]] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (emailExistente) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }

    // Obtener información de la empresa para generar contraseña automática
    const [[empresa]] = await pool.query(
      'SELECT razon_social FROM empresas WHERE id = ?',
      [empresa_id]
    );

    if (!empresa) {
      return res.status(400).json({ message: 'Empresa no encontrada' });
    }

    // Generar contraseña automática: nombreEmpresa + año actual
    const currentYear = new Date().getFullYear();
    const razonSocialLimpia = empresa.razon_social
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
    const passwordAutomatica = `${razonSocialLimpia}${currentYear}`;

    // Encriptar la contraseña (usar la automática)
    const hashedPassword = await bcrypt.hash(passwordAutomatica, BCRYPT_SALT_ROUNDS);

    // Insertar el usuario con debe_cambiar_password = TRUE (si el campo existe)
    // Intentar primero con el campo, si falla, insertar sin él
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO usuarios (empresa_id, rol_id, nombre, apellido, cedula, telefono, email, password, debe_cambiar_password, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
        [empresa_id, rol_id, nombre, apellido, cedula || null, telefono || null, email, hashedPassword]
      );
    } catch (insertError) {
      // Si falla (probablemente porque debe_cambiar_password no existe), insertar sin ese campo
      [result] = await pool.query(
        `INSERT INTO usuarios (empresa_id, rol_id, nombre, apellido, cedula, telefono, email, password, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [empresa_id, rol_id, nombre, apellido, cedula || null, telefono || null, email, hashedPassword]
      );
    }

    return res.status(201).json({
      message: 'Usuario creado exitosamente',
      data: {
        id: result.insertId,
        nombre,
        apellido,
        email,
        rol: nombreRolNuevo,
        passwordTemporal: passwordAutomatica,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const cambiarPassword = async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    const usuarioId = req.user.id;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ message: 'passwordActual y passwordNueva son requeridos' });
    }

    if (passwordNueva.length < 6) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    // Obtener contraseña actual del usuario
    const [[usuario]] = await pool.query(
      'SELECT password FROM usuarios WHERE id = ?',
      [usuarioId]
    );

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const isValid = await bcrypt.compare(passwordActual, usuario.password);

    if (!isValid) {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    // Encriptar nueva contraseña
    const hashedPassword = await bcrypt.hash(passwordNueva, BCRYPT_SALT_ROUNDS);

    // Actualizar contraseña y marcar debe_cambiar_password como FALSE (si el campo existe)
    try {
      await pool.query(
        'UPDATE usuarios SET password = ?, debe_cambiar_password = FALSE WHERE id = ?',
        [hashedPassword, usuarioId]
      );
    } catch (updateError) {
      // Si falla (probablemente porque debe_cambiar_password no existe), actualizar solo password
      await pool.query(
        'UPDATE usuarios SET password = ? WHERE id = ?',
        [hashedPassword, usuarioId]
      );
    }

    return res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    return next(error);
  }
};

const updateUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { nombre, apellido, cedula, telefono, email, rol_id, empresa_id, resetPassword } = req.body;

    // Validar campos requeridos básicos
    if (!nombre || !apellido || !email || !rol_id) {
      return res.status(400).json({
        message: 'Campos requeridos: nombre, apellido, email, rol_id',
      });
    }

    // Obtener el rol del usuario autenticado
    const usuarioActual = req.user;
    let nombreRolActual;

    if (usuarioActual.rol_id) {
      const [[rolActual]] = await pool.query(
        'SELECT nombre FROM roles WHERE id = ?',
        [usuarioActual.rol_id]
      );
      
      if (!rolActual) {
        return res.status(403).json({ message: 'Rol del usuario no encontrado' });
      }
      
      nombreRolActual = rolActual.nombre;
    } else if (usuarioActual.rol) {
      nombreRolActual = usuarioActual.rol;
    } else {
      return res.status(403).json({ message: 'Información de rol no disponible. Por favor, inicie sesión nuevamente.' });
    }

    // Validar permisos según el rol
    if (nombreRolActual === ROLES.COBRADOR) {
      return res.status(403).json({ message: 'No tienes permisos para editar usuarios' });
    }

    // Obtener el usuario que se va a editar
    const [[usuarioAEditar]] = await pool.query(
      'SELECT u.*, r.nombre as rol_nombre FROM usuarios u INNER JOIN roles r ON u.rol_id = r.id WHERE u.id = ?',
      [id]
    );

    if (!usuarioAEditar) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si es SUPERVISOR, validar que solo edite usuarios de su empresa con rol COBRADOR
    if (nombreRolActual === ROLES.SUPERVISOR) {
      if (usuarioAEditar.empresa_id !== usuarioActual.empresaId) {
        return res.status(403).json({ message: 'Solo puedes editar usuarios de tu empresa' });
      }

      // Solo puede editar usuarios COBRADOR
      if (usuarioAEditar.rol_nombre !== ROLES.COBRADOR) {
        return res.status(403).json({ message: 'Solo puedes editar usuarios con rol COBRADOR' });
      }

      // Forzar que la empresa_id no cambie
      empresa_id = usuarioAEditar.empresa_id;
    } else if (!empresa_id) {
      // Si es ADMIN y no envía empresa_id, mantener la actual
      empresa_id = usuarioAEditar.empresa_id;
    }

    // Obtener el rol que se quiere asignar
    const [[rolNuevo]] = await pool.query(
      'SELECT nombre FROM roles WHERE id = ?',
      [rol_id]
    );

    if (!rolNuevo) {
      return res.status(400).json({ message: 'Rol seleccionado no válido' });
    }

    const nombreRolNuevo = rolNuevo.nombre;

    // Si es SUPERVISOR, no puede cambiar el rol a ADMIN
    if (nombreRolActual === ROLES.SUPERVISOR) {
      if (nombreRolNuevo === ROLES.ADMIN) {
        return res.status(403).json({
          message: 'Los supervisores no pueden asignar el rol ADMIN',
        });
      }
    }

    // Validar que el email no esté repetido (excepto si es el mismo email del usuario que se está editando)
    const [[emailExistente]] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?',
      [email, id]
    );

    if (emailExistente) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }

    // Validar que la empresa exista
    const [[empresa]] = await pool.query(
      'SELECT id FROM empresas WHERE id = ?',
      [empresa_id]
    );

    if (!empresa) {
      return res.status(400).json({ message: 'Empresa no encontrada' });
    }

    // Actualizar el usuario
    await pool.query(
      `UPDATE usuarios 
       SET empresa_id = ?, rol_id = ?, nombre = ?, apellido = ?, cedula = ?, telefono = ?, email = ?
       WHERE id = ?`,
      [empresa_id, rol_id, nombre, apellido, cedula || null, telefono || null, email, id]
    );

    // Restablecer contraseña si se solicitó
    let passwordTemporal = null;
    if (resetPassword) {
      const [[emp]] = await pool.query('SELECT razon_social FROM empresas WHERE id = ?', [empresa_id]);
      const currentYear = new Date().getFullYear();
      const razonLimpia = emp.razon_social.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      passwordTemporal = `${razonLimpia}${currentYear}`;
      const hashedPassword = await bcrypt.hash(passwordTemporal, BCRYPT_SALT_ROUNDS);
      await pool.query(
        'UPDATE usuarios SET password = ?, debe_cambiar_password = TRUE WHERE id = ?',
        [hashedPassword, id]
      );
    }

    return res.json({
      message: resetPassword ? 'Usuario actualizado y contraseña restablecida' : 'Usuario actualizado exitosamente',
      data: {
        id: parseInt(id),
        nombre,
        apellido,
        email,
        rol: nombreRolNuevo,
        ...(passwordTemporal ? { passwordTemporal } : {}),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getPropioUsuario = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.cedula, u.email, u.telefono,
              e.razon_social AS empresa, r.nombre AS rol
       FROM usuarios u
       INNER JOIN empresas e ON e.id = u.empresa_id
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!row) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json({ data: row });
  } catch (error) {
    return next(error);
  }
};

const updatePropioUsuario = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { nombre, apellido, cedula, telefono, email } = req.body;

    if (!nombre?.trim() || !apellido?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Nombre, apellido y email son requeridos' });
    }

    const [[emailExistente]] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?',
      [email.trim(), userId]
    );
    if (emailExistente) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }

    await pool.query(
      'UPDATE usuarios SET nombre = ?, apellido = ?, cedula = ?, telefono = ?, email = ? WHERE id = ?',
      [nombre.trim(), apellido.trim(), cedula?.trim() || null, telefono?.trim() || null, email.trim(), userId]
    );

    return res.json({
      message: 'Perfil actualizado',
      data: { nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim() },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createUsuario,
  cambiarPassword,
  updateUsuario,
  getPropioUsuario,
  updatePropioUsuario,
};
