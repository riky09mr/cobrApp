const pool = require('../config/db');
const { registrarAuditoriaSegura } = require('../services/cobranzas/auditoriaService');

const getIpCliente = (req) => req.ip || req.headers['x-forwarded-for'] || null;

const ROL = { SUPERVISOR: 'SUPERVISOR', COBRADOR: 'COBRADOR' };

// GET /api/mensajes  lista de contactos con �ltimo mensaje y no-le�dos
const getConversaciones = async (req, res, next) => {
  try {
    const { id: userId, rol, empresaId } = req.user;
    if (rol === 'ADMIN') return res.status(403).json({ message: 'Sin permisos' });
    if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asignada' });

    const rolOpuesto = rol === ROL.SUPERVISOR ? ROL.COBRADOR : ROL.SUPERVISOR;

    // 1. Obtener todos los contactos del rol opuesto en la misma empresa
    const [contactos] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, r.nombre AS rol
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.empresa_id = ? AND u.estado = 1 AND r.nombre = ?
       ORDER BY u.nombre ASC`,
      [empresaId, rolOpuesto]
    );

    if (contactos.length === 0) return res.json({ data: [] });

    const contactIds = contactos.map(c => c.id);
    const ultimoMensajeMap = {};  // contacto_id → { contenido, created_at }
    const noLeidosMap = {};       // contacto_id → count

    // 2. Enriquecer con datos de mensajes (falla silenciosamente si la tabla no existe a�n)
    try {
      const [msgs] = await pool.query(
        `SELECT
           CASE WHEN emisor_id = ? THEN receptor_id ELSE emisor_id END AS contacto_id,
           contenido, created_at
         FROM mensajes
         WHERE (emisor_id = ? AND receptor_id IN (?))
            OR (emisor_id IN (?) AND receptor_id = ?)
         ORDER BY created_at DESC`,
        [userId, userId, contactIds, contactIds, userId]
      );
      for (const msg of msgs) {
        if (!ultimoMensajeMap[msg.contacto_id]) {
          ultimoMensajeMap[msg.contacto_id] = { contenido: msg.contenido, created_at: msg.created_at };
        }
      }

      const [noLeidos] = await pool.query(
        `SELECT emisor_id, COUNT(*) AS total
         FROM mensajes
         WHERE receptor_id = ? AND leido = 0 AND emisor_id IN (?)
         GROUP BY emisor_id`,
        [userId, contactIds]
      );
      for (const row of noLeidos) {
        noLeidosMap[row.emisor_id] = row.total;
      }
    } catch {
      // La tabla mensajes a�n no existe  los contactos igual aparecen, sin preview
    }

    // 3. Combinar y ordenar: primero los que tienen mensajes recientes, luego por nombre
    const result = contactos.map(c => ({
      ...c,
      ultimo_mensaje: ultimoMensajeMap[c.id]?.contenido ?? null,
      ultima_fecha:   ultimoMensajeMap[c.id]?.created_at ?? null,
      no_leidos:      noLeidosMap[c.id] ?? 0,
    }));

    result.sort((a, b) => {
      if (a.ultima_fecha && !b.ultima_fecha) return -1;
      if (!a.ultima_fecha && b.ultima_fecha) return 1;
      if (a.ultima_fecha && b.ultima_fecha) {
        return new Date(b.ultima_fecha).getTime() - new Date(a.ultima_fecha).getTime();
      }
      return a.nombre.localeCompare(b.nombre);
    });

    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
};

// GET /api/mensajes/:usuarioId  mensajes de la conversaci�n (y marca como le�dos)
const getConversacion = async (req, res, next) => {
  try {
    const { id: userId, rol, empresaId } = req.user;
    if (rol === 'ADMIN') return res.status(403).json({ message: 'Sin permisos' });

    const otroId = parseInt(req.params.usuarioId, 10);
    if (isNaN(otroId)) return res.status(400).json({ message: 'ID inv�lido' });

    // Verificar que el otro usuario pertenece a la misma empresa
    const [[otro]] = await pool.query(
      'SELECT id FROM usuarios WHERE id = ? AND empresa_id = ? AND estado = 1',
      [otroId, empresaId]
    );
    if (!otro) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Marcar como le�dos los mensajes recibidos de ese usuario
    await pool.query(
      'UPDATE mensajes SET leido = 1 WHERE emisor_id = ? AND receptor_id = ? AND leido = 0',
      [otroId, userId]
    );

    const [rows] = await pool.query(
      `SELECT m.id, m.emisor_id, m.receptor_id, m.contenido, m.imagen_url, m.leido, m.created_at,
              CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS emisor_nombre
       FROM mensajes m
       INNER JOIN usuarios u ON u.id = m.emisor_id
       WHERE (m.emisor_id = ? AND m.receptor_id = ?)
          OR (m.emisor_id = ? AND m.receptor_id = ?)
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [userId, otroId, otroId, userId]
    );

    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

// POST /api/mensajes  enviar un mensaje
const enviarMensaje = async (req, res, next) => {
  try {
    const { id: userId, rol, empresaId } = req.user;
    if (rol === 'ADMIN') return res.status(403).json({ message: 'Sin permisos' });

    const { receptor_id, contenido } = req.body;
    const imagenUrl = req.file ? `/uploads/mensajes/${req.file.filename}` : null;
    if (!receptor_id || (!contenido?.trim() && !imagenUrl)) {
      return res.status(400).json({ message: 'receptor_id y al menos contenido o imagen son requeridos' });
    }

    // Verificar receptor pertenece a la misma empresa con rol correcto
    const [[receptor]] = await pool.query(
      `SELECT u.id, r.nombre AS rol
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ? AND u.empresa_id = ? AND u.estado = 1`,
      [receptor_id, empresaId]
    );
    if (!receptor) {
      return res.status(404).json({ message: 'Receptor no encontrado en tu empresa' });
    }

    const rolEsperado = rol === ROL.SUPERVISOR ? ROL.COBRADOR : ROL.SUPERVISOR;
    if (receptor.rol !== rolEsperado) {
      return res.status(403).json({ message: `Solo pod�s enviar mensajes a usuarios con rol ${rolEsperado}` });
    }

    const [result] = await pool.query(
      'INSERT INTO mensajes (empresa_id, emisor_id, receptor_id, contenido, imagen_url) VALUES (?, ?, ?, ?, ?)',
      [empresaId, userId, receptor_id, contenido?.trim() ?? '', imagenUrl]
    );

    // Auditoría: envío de mensaje (con o sin imagen adjunta)
    await registrarAuditoriaSegura({
      empresaId,
      usuarioId: userId,
      ip: getIpCliente(req),
      accion: 'INSERT',
      tabla: 'mensajes',
      registroId: result.insertId,
      despues: {
        emisor_id: userId,
        receptor_id,
        tiene_imagen: !!imagenUrl,
        imagen_url: imagenUrl,
      },
      observaciones: imagenUrl
        ? 'Envío de mensaje con imagen adjunta'
        : 'Envío de mensaje',
    });

    return res.status(201).json({ message: 'Mensaje enviado', data: { id: result.insertId, imagen_url: imagenUrl } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/mensajes/no-leidos  cantidad de mensajes no le�dos (para badge)
const getNoLeidos = async (req, res, next) => {
  try {
    const { id: userId, rol } = req.user;
    if (rol === 'ADMIN') return res.json({ data: { total: 0 } });

    const [[row]] = await pool.query(
      'SELECT COUNT(*) AS total FROM mensajes WHERE receptor_id = ? AND leido = 0',
      [userId]
    );
    return res.json({ data: { total: row.total } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getConversaciones, getConversacion, enviarMensaje, getNoLeidos };
