const pool = require('../config/db');

/**
 * Middleware de permisos por vista y acción.
 *
 * Verifica si el usuario autenticado tiene el permiso `modulo.accion`.
 *
 * Reglas:
 *  - El rol ADMIN siempre tiene acceso total (no se consulta la BD).
 *  - Para SUPERVISOR y COBRADOR se consultan los permisos del rol
 *    (tabla `rol_permisos`) más las excepciones por usuario
 *    (tabla `usuario_permisos`).
 *  - Las excepciones por usuario pueden OTORGAR (otorgado=1) o
 *    DENEGAR (otorgado=0) un permiso.
 *
 * Uso:
 *   router.get('/clientes', authenticateToken, requirePermission('clientes', 'ver'), getClientes);
 */
const requirePermission = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      const { rol, rol_id, id: usuarioId } = req.user;

      // ADMIN siempre tiene acceso total
      if (rol === 'ADMIN') {
        return next();
      }

      // Buscar el permiso en el catálogo
      const [[permiso]] = await pool.query(
        'SELECT id FROM permisos WHERE modulo = ? AND accion = ?',
        [modulo, accion]
      );

      if (!permiso) {
        return res.status(403).json({ message: 'Permiso no definido' });
      }

      // Verificar excepción por usuario (tiene prioridad sobre el rol)
      const [[excepcion]] = await pool.query(
        'SELECT otorgado FROM usuario_permisos WHERE usuario_id = ? AND permiso_id = ?',
        [usuarioId, permiso.id]
      );

      if (excepcion) {
        if (excepcion.otorgado === 1 || excepcion.otorgado === true) {
          return next();
        }
        return res.status(403).json({ message: 'No tenés permisos para realizar esta acción' });
      }

      // Verificar permiso del rol
      const [[rolPermiso]] = await pool.query(
        'SELECT rp.id FROM rol_permisos rp WHERE rp.rol_id = ? AND rp.permiso_id = ?',
        [rol_id, permiso.id]
      );

      if (rolPermiso) {
        return next();
      }

      return res.status(403).json({ message: 'No tenés permisos para realizar esta acción' });
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * Obtiene la lista de permisos efectivos de un usuario.
 * Devuelve un array de strings con formato "modulo.accion".
 *
 * Se usa en el login y en el endpoint GET /api/permisos.
 */
const getPermisosUsuario = async (usuario) => {
  const { rol, rol_id, id: usuarioId } = usuario;

  // ADMIN siempre tiene todos los permisos
  if (rol === 'ADMIN') {
    const [todos] = await pool.query('SELECT modulo, accion FROM permisos');
    return todos.map((p) => `${p.modulo}.${p.accion}`);
  }

  // Permisos del rol
  const [rolPermisos] = await pool.query(
    `SELECT p.modulo, p.accion
     FROM rol_permisos rp
     INNER JOIN permisos p ON p.id = rp.permiso_id
     WHERE rp.rol_id = ?`,
    [rol_id]
  );

  const permisosMap = new Map();
  rolPermisos.forEach((p) => permisosMap.set(`${p.modulo}.${p.accion}`, true));

  // Excepciones por usuario
  const [excepciones] = await pool.query(
    `SELECT p.modulo, p.accion, up.otorgado
     FROM usuario_permisos up
     INNER JOIN permisos p ON p.id = up.permiso_id
     WHERE up.usuario_id = ?`,
    [usuarioId]
  );

  excepciones.forEach((e) => {
    const key = `${e.modulo}.${e.accion}`;
    if (e.otorgado === 1 || e.otorgado === true) {
      permisosMap.set(key, true);
    } else {
      permisosMap.delete(key);
    }
  });

  return Array.from(permisosMap.keys());
};

module.exports = { requirePermission, getPermisosUsuario };
