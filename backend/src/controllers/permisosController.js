const pool = require('../config/db');
const { getPermisosUsuario } = require('../middlewares/permissionMiddleware');
const { registrarAuditoriaSegura } = require('../services/cobranzas/auditoriaService');

const getIpCliente = (req) => req.ip || req.headers['x-forwarded-for'] || null;

/**
 * GET /api/permisos
 * Devuelve los permisos efectivos del usuario autenticado.
 * Formato: { permisos: ["clientes.ver", "clientes.crear", ...] }
 */
const getMisPermisos = async (req, res, next) => {
  try {
    const permisos = await getPermisosUsuario(req.user);
    return res.json({ message: 'ok', data: { permisos } });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/permisos/catalogo
 * Devuelve el catálogo completo de permisos disponibles.
 * Solo ADMIN y SUPERVISOR.
 */
const getCatalogoPermisos = async (req, res, next) => {
  try {
    const [permisos] = await pool.query(
      'SELECT id, modulo, accion, descripcion FROM permisos ORDER BY modulo, accion'
    );
    return res.json({ message: 'ok', data: { permisos } });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/permisos/usuario/:id
 * Devuelve los permisos efectivos de un usuario específico
 * (permisos del rol + excepciones por usuario).
 * Solo ADMIN y SUPERVISOR.
 */
const getPermisosUsuarioId = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Obtener el usuario con su rol
    const [[usuario]] = await pool.query(
      `SELECT u.id, u.empresa_id, u.rol_id, r.nombre AS rol
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ?`,
      [id]
    );

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Restricción de empresa: SUPERVISOR solo puede ver usuarios de su empresa
    if (req.user.rol === 'SUPERVISOR' && usuario.empresa_id !== req.user.empresaId) {
      return res.status(403).json({ message: 'No tenés permisos para ver este usuario' });
    }

    const permisos = await getPermisosUsuario(usuario);

    // Obtener las excepciones explícitas (para poder mostrarlas en la UI)
    const [excepciones] = await pool.query(
      `SELECT p.id AS permiso_id, p.modulo, p.accion, up.otorgado
       FROM usuario_permisos up
       INNER JOIN permisos p ON p.id = up.permiso_id
       WHERE up.usuario_id = ?`,
      [id]
    );

    return res.json({
      message: 'ok',
      data: {
        permisos,
        excepciones,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/permisos/usuario/:id
 * Asigna permisos a un usuario (excepciones).
 * Body: { permisos: ["clientes.ver", "cobranzas.crear", ...] }
 *   - Los permisos en la lista se OTORGAN.
 *   - Los permisos del rol que NO estén en la lista se DENIEGAN
 *     (se crea una excepción con otorgado=0).
 * Solo ADMIN y SUPERVISOR.
 */
const asignarPermisosUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permisos } = req.body;

    if (!Array.isArray(permisos)) {
      return res.status(400).json({ message: 'permisos debe ser un array' });
    }

    // Obtener el usuario objetivo
    const [[usuario]] = await pool.query(
      `SELECT u.id, u.empresa_id, u.rol_id, r.nombre AS rol
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ?`,
      [id]
    );

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Restricciones:
    // - No se pueden modificar permisos de un ADMIN (siempre tiene todo).
    // - SUPERVISOR solo puede modificar permisos de COBRADORES de su empresa.
    if (usuario.rol === 'ADMIN') {
      return res.status(403).json({ message: 'El rol ADMIN siempre tiene acceso total' });
    }

    if (req.user.rol === 'SUPERVISOR') {
      if (usuario.rol !== 'COBRADOR') {
        return res.status(403).json({ message: 'Los supervisores solo pueden asignar permisos a cobradores' });
      }
      if (usuario.empresa_id !== req.user.empresaId) {
        return res.status(403).json({ message: 'No tenés permisos para modificar este usuario' });
      }
    }

    // Obtener los permisos del rol del usuario (para saber cuáles denegar)
    const [rolPermisos] = await pool.query(
      `SELECT p.id, p.modulo, p.accion
       FROM rol_permisos rp
       INNER JOIN permisos p ON p.id = rp.permiso_id
       WHERE rp.rol_id = ?`,
      [usuario.rol_id]
    );

    // Mapa de permisos del rol
    const rolPermisosMap = new Map();
    rolPermisos.forEach((p) => rolPermisosMap.set(`${p.modulo}.${p.accion}`, p.id));

    // Mapa de permisos solicitados
    const permisosSolicitados = new Set(permisos);

    // Resolver IDs de permisos solicitados
    const permisosSolicitadosIds = new Map();
    if (permisosSolicitados.size > 0) {
      const [permisosCatalogo] = await pool.query(
        'SELECT id, modulo, accion FROM permisos'
      );
      permisosCatalogo.forEach((p) => {
        const key = `${p.modulo}.${p.accion}`;
        if (permisosSolicitados.has(key)) {
          permisosSolicitadosIds.set(key, p.id);
        }
      });
    }

    // Construir la lista de excepciones a guardar:
    // 1. Permisos otorgados (los que están en la lista solicitada)
    // 2. Permisos del rol que NO están en la lista → denegados (otorgado=0)
    const excepciones = [];

    // Permisos otorgados
    for (const [key, permisoId] of permisosSolicitadosIds) {
      excepciones.push({ permiso_id: permisoId, otorgado: 1 });
    }

    // Permisos del rol denegados
    for (const [key, permisoId] of rolPermisosMap) {
      if (!permisosSolicitados.has(key)) {
        excepciones.push({ permiso_id: permisoId, otorgado: 0 });
      }
    }

    // Guardar en transacción
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Eliminar excepciones existentes
      await conn.query('DELETE FROM usuario_permisos WHERE usuario_id = ?', [id]);

      // Insertar nuevas excepciones
      if (excepciones.length > 0) {
        const values = excepciones.map((e) => [id, e.permiso_id, e.otorgado]);
        await conn.query(
          'INSERT INTO usuario_permisos (usuario_id, permiso_id, otorgado) VALUES ?',
          [values]
        );
      }

      await conn.commit();

      // Auditoría
      await registrarAuditoriaSegura({
        empresaId: req.user.empresaId,
        usuarioId: req.user.id,
        ip: getIpCliente(req),
        accion: 'UPDATE',
        tabla: 'usuario_permisos',
        registroId: id,
        despues: { permisos: permisosSolicitados.size },
        observaciones: `Asignación de permisos al usuario ${id}`,
      });

      return res.json({ message: 'Permisos actualizados correctamente' });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMisPermisos,
  getCatalogoPermisos,
  getPermisosUsuarioId,
  asignarPermisosUsuario,
};
