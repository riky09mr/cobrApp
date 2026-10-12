const pool = require('../config/db');

async function existeZonaActivaConNombre(empresaId, nombre, excludeId = null) {
  const sql =
    `SELECT id
     FROM zonas
     WHERE empresa_id = ?
       AND estado = 1
       AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))` +
    (excludeId ? ' AND id <> ?' : '') +
    ' LIMIT 1';

  const params = excludeId ? [empresaId, nombre, excludeId] : [empresaId, nombre];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

async function existeZonaActivaConCobrador(empresaId, cobradorId, excludeId = null) {
  const sql =
    `SELECT id
     FROM zonas
     WHERE empresa_id = ?
       AND estado = 1
       AND cobrador_id = ?` +
    (excludeId ? ' AND id <> ?' : '') +
    ' LIMIT 1';

  const params = excludeId ? [empresaId, cobradorId, excludeId] : [empresaId, cobradorId];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

// Ray-casting point-in-polygon
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const getZonas = async (req, res, next) => {
  try {
    const { empresaId, rol } = req.user;
    const empId = rol === 'ADMIN' ? (req.query.empresa_id || empresaId) : empresaId;
    const params = rol === 'ADMIN' ? [empId] : [empId];
    const where = 'WHERE z.empresa_id = ?';

    const [rows] = await pool.query(
      `SELECT z.id, z.empresa_id, z.nombre, z.descripcion, z.color, z.poligono,
              z.estado, z.cobrador_id,
              CONCAT(COALESCE(u.nombre,''), ' ', COALESCE(u.apellido,'')) AS cobrador_nombre
       FROM zonas z
       LEFT JOIN usuarios u ON u.id = z.cobrador_id
       ${where}
       ORDER BY z.nombre ASC`,
      params
    );

    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const createZona = async (req, res, next) => {
  try {
    const { empresaId, rol } = req.user;
    const { nombre, descripcion, color, cobrador_id, poligono, empresa_id } = req.body;

    const nombreNormalizado = typeof nombre === 'string' ? nombre.trim() : '';
    if (!nombreNormalizado) return res.status(400).json({ message: 'El nombre es obligatorio' });

    const empId = rol === 'ADMIN' ? (empresa_id || empresaId) : empresaId;
    const cobradorId = cobrador_id || null;

    if (await existeZonaActivaConNombre(empId, nombreNormalizado)) {
      return res.status(409).json({ message: 'Ya existe una zona activa con ese nombre' });
    }

    if (cobradorId && (await existeZonaActivaConCobrador(empId, cobradorId))) {
      return res.status(409).json({ message: 'Ese cobrador ya esta asignado a otra zona activa' });
    }

    const [result] = await pool.query(
      'INSERT INTO zonas (empresa_id, nombre, descripcion, color, cobrador_id, poligono) VALUES (?, ?, ?, ?, ?, ?)',
      [
        empId,
        nombreNormalizado,
        descripcion || null,
        color || '#3B82F6',
        cobradorId,
        poligono ? JSON.stringify(poligono) : null,
      ]
    );

    return res.status(201).json({ data: { id: result.insertId }, message: 'Zona creada' });
  } catch (error) {
    return next(error);
  }
};

const updateZona = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { empresaId, rol } = req.user;
    const { nombre, descripcion, color, cobrador_id, poligono, estado } = req.body;

    const [[zona]] = await pool.query(
      'SELECT empresa_id, nombre, cobrador_id, estado FROM zonas WHERE id = ?',
      [id]
    );
    if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
    if (rol !== 'ADMIN' && zona.empresa_id !== empresaId)
      return res.status(403).json({ message: 'Sin permisos' });

    const nombreFinal = typeof nombre === 'string' ? nombre.trim() : (zona.nombre || '').trim();
    const cobradorFinal = cobrador_id !== undefined ? (cobrador_id || null) : zona.cobrador_id;
    const estadoFinal = estado !== undefined ? Number(estado) : Number(zona.estado);

    if (estadoFinal === 1) {
      if (!nombreFinal) {
        return res.status(400).json({ message: 'El nombre es obligatorio' });
      }

      if (await existeZonaActivaConNombre(zona.empresa_id, nombreFinal, Number(id))) {
        return res.status(409).json({ message: 'Ya existe una zona activa con ese nombre' });
      }

      if (cobradorFinal && (await existeZonaActivaConCobrador(zona.empresa_id, cobradorFinal, Number(id)))) {
        return res.status(409).json({ message: 'Ese cobrador ya esta asignado a otra zona activa' });
      }
    }

    await pool.query(
      `UPDATE zonas SET
        nombre      = COALESCE(?, nombre),
        descripcion = ?,
        color       = COALESCE(?, color),
        cobrador_id = ?,
        poligono    = ?,
        estado      = COALESCE(?, estado)
       WHERE id = ?`,
      [
        nombreFinal || null,
        descripcion !== undefined ? descripcion : null,
        color || null,
        cobrador_id !== undefined ? cobradorFinal : null,
        poligono ? JSON.stringify(poligono) : null,
        estado !== undefined ? estado : null,
        id,
      ]
    );

    return res.json({ message: 'Zona actualizada' });
  } catch (error) {
    return next(error);
  }
};

const deleteZona = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { empresaId, rol } = req.user;

    const [[zona]] = await conn.query(
      'SELECT empresa_id, cobrador_id FROM zonas WHERE id = ?',
      [id]
    );
    if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
    if (rol !== 'ADMIN' && zona.empresa_id !== empresaId)
      return res.status(403).json({ message: 'Sin permisos' });

    await conn.beginTransaction();

    // 1. Obtener los clientes de la zona ANTES de desasignarlos
    const [clientesZona] = await conn.query(
      'SELECT cliente_id FROM clientes_empresas WHERE zona_id = ?',
      [id]
    );
    const clienteIds = clientesZona.map((c) => c.cliente_id);

    // 2. Desactivar la zona
    await conn.query('UPDATE zonas SET estado = 0 WHERE id = ?', [id]);

    // 3. Desasignar clientes de la zona (zona_id = NULL)
    const [clientesResult] = await conn.query(
      'UPDATE clientes_empresas SET zona_id = NULL WHERE zona_id = ?',
      [id]
    );
    const clientesDesasignados = clientesResult.affectedRows;

    // 4. Desasignar cuotas pendientes/vencidas de los clientes de esta zona
    //    Cancelar las asignaciones PENDIENTE de las cuotas de los clientes que
    //    estaban en esta zona.
    let cuotasDesasignadas = 0;
    if (clienteIds.length > 0) {
      const [cuotasResult] = await conn.query(
        `UPDATE asignaciones a
         INNER JOIN cuotas q ON q.id = a.cuota_id
         INNER JOIN creditos cr ON cr.id = q.credito_id
         SET a.estado = 'CANCELADO'
         WHERE cr.cliente_id IN (?) AND a.estado = 'PENDIENTE'`,
        [clienteIds]
      );
      cuotasDesasignadas = cuotasResult.affectedRows;
    }

    await conn.commit();

    return res.json({
      message: 'Zona desactivada',
      data: {
        clientesDesasignados,
        cuotasDesasignadas,
        cobrador_id: zona.cobrador_id,
      },
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/zonas/no-asignadas
// Devuelve los clientes sin zona asignada y las cuotas
// pendientes/vencidas sin cobrador asignado.
// ─────────────────────────────────────────────────────────────
const getNoAsignadas = async (req, res, next) => {
  try {
    const { empresaId, rol } = req.user;

    const empId = rol === 'ADMIN' ? (req.query.empresa_id || empresaId) : empresaId;

    // 1. Clientes sin zona asignada
    const [clientesSinZona] = await pool.query(
      `SELECT ce.cliente_id, ce.empresa_id,
              CONCAT(COALESCE(cl.nombre,''), ' ', COALESCE(cl.apellido,'')) AS cliente,
              cl.cedula, cl.telefono,
              ce.latitud, ce.longitud
       FROM clientes_empresas ce
       INNER JOIN clientes cl ON cl.id = ce.cliente_id
       WHERE ce.empresa_id = ? AND ce.estado = 1 AND ce.zona_id IS NULL
       ORDER BY cliente ASC`,
      [empId]
    );

    // 2. Cuotas pendientes/vencidas sin asignación activa (PENDIENTE)
    const [cuotasSinAsignar] = await pool.query(
      `SELECT q.id, q.numero_cuota, q.fecha_vencimiento, q.monto_cuota, q.saldo_cuota, q.estado,
              cr.id AS credito_id, cr.numero_credito, cr.descripcion,
              cl.id AS cliente_id,
              CONCAT(COALESCE(cl.nombre,''), ' ', COALESCE(cl.apellido,'')) AS cliente,
              cl.cedula,
              ce.zona_id
       FROM cuotas q
       INNER JOIN creditos cr ON cr.id = q.credito_id
       INNER JOIN clientes cl ON cl.id = cr.cliente_id
       INNER JOIN clientes_empresas ce ON ce.cliente_id = cl.id AND ce.empresa_id = cr.empresa_id
       WHERE cr.empresa_id = ?
         AND q.estado IN ('PENDIENTE','VENCIDA')
         AND NOT EXISTS (
           SELECT 1 FROM asignaciones a
           WHERE a.cuota_id = q.id AND a.estado = 'PENDIENTE'
         )
       ORDER BY q.fecha_vencimiento ASC
       LIMIT 500`,
      [empId]
    );

    return res.json({
      data: {
        clientesSinZona,
        cuotasSinAsignar,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/zonas/asignar-cliente
// Asigna manualmente un cliente a una zona.
// Body: { cliente_id, zona_id }
// - Actualiza clientes_empresas.zona_id
// - Asigna las cuotas pendientes/vencidas del cliente al cobrador
//   de la zona.
// - Si el cliente está dentro del polígono de OTRA zona activa,
//   devuelve un aviso (pero igual asigna).
// ─────────────────────────────────────────────────────────────
const asignarClienteZona = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { empresaId, rol, id: supervisorId } = req.user;
    const { cliente_id, zona_id } = req.body;

    if (!cliente_id || !zona_id) {
      return res.status(400).json({ message: 'cliente_id y zona_id son obligatorios' });
    }
    if (rol !== 'SUPERVISOR' && rol !== 'ADMIN') {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    // 1. Verificar la zona
    const [[zona]] = await conn.query(
      'SELECT id, nombre, empresa_id, cobrador_id, poligono, estado FROM zonas WHERE id = ?',
      [zona_id]
    );
    if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
    if (rol !== 'ADMIN' && zona.empresa_id !== empresaId)
      return res.status(403).json({ message: 'Sin permisos' });
    if (Number(zona.estado) !== 1) {
      return res.status(400).json({ message: 'La zona está desactivada' });
    }

    // 2. Verificar el cliente en la empresa
    const [[clienteEmpresa]] = await conn.query(
      `SELECT ce.id AS rel_id, ce.cliente_id, ce.empresa_id, ce.latitud, ce.longitud, ce.zona_id
       FROM clientes_empresas ce
       WHERE ce.cliente_id = ? AND ce.empresa_id = ? AND ce.estado = 1`,
      [cliente_id, zona.empresa_id]
    );
    if (!clienteEmpresa) {
      return res.status(404).json({ message: 'El cliente no existe en esta empresa' });
    }

    // 3. Verificar si el cliente está dentro del polígono de OTRA zona activa
    let aviso = null;
    if (clienteEmpresa.latitud && clienteEmpresa.longitud) {
      const lat = parseFloat(clienteEmpresa.latitud);
      const lng = parseFloat(clienteEmpresa.longitud);

      const [otrasZonas] = await conn.query(
        `SELECT z.id, z.nombre, z.poligono, z.cobrador_id,
                CONCAT(COALESCE(u.nombre,''), ' ', COALESCE(u.apellido,'')) AS cobrador_nombre
         FROM zonas z
         LEFT JOIN usuarios u ON u.id = z.cobrador_id
         WHERE z.empresa_id = ? AND z.estado = 1 AND z.id <> ? AND z.poligono IS NOT NULL`,
        [zona.empresa_id, zona_id]
      );

      for (const otra of otrasZonas) {
        let polygon;
        try {
          polygon = typeof otra.poligono === 'string' ? JSON.parse(otra.poligono) : otra.poligono;
        } catch {
          continue;
        }
        if (Array.isArray(polygon) && polygon.length >= 3 && pointInPolygon(lat, lng, polygon)) {
          aviso = {
            zonaId: otra.id,
            zonaNombre: otra.nombre,
            cobradorNombre: otra.cobrador_nombre || 'Sin cobrador',
          };
          break;
        }
      }
    }

    await conn.beginTransaction();

    // 4. Asignar el cliente a la zona
    await conn.query(
      'UPDATE clientes_empresas SET zona_id = ? WHERE id = ?',
      [zona_id, clienteEmpresa.rel_id]
    );

    // 5. Asignar cuotas pendientes/vencidas del cliente al cobrador de la zona
    let cuotasAsignadas = 0;
    if (zona.cobrador_id) {
      const [cuotas] = await conn.query(
        `SELECT q.id FROM cuotas q
         INNER JOIN creditos cr ON cr.id = q.credito_id
         WHERE cr.cliente_id = ? AND cr.empresa_id = ? AND q.estado IN ('PENDIENTE','VENCIDA')`,
        [cliente_id, zona.empresa_id]
      );

      for (const cuota of cuotas) {
        // Si ya está asignada a OTRO cobrador pendiente, reasignarla a este
        const [[asignacionActual]] = await conn.query(
          `SELECT id FROM asignaciones
           WHERE cuota_id = ? AND estado = 'PENDIENTE'`,
          [cuota.id]
        );

        if (asignacionActual) {
          const [[mismaAsignacion]] = await conn.query(
            `SELECT id FROM asignaciones
             WHERE cuota_id = ? AND usuario_id = ? AND estado = 'PENDIENTE'`,
            [cuota.id, zona.cobrador_id]
          );
          if (mismaAsignacion) continue;

          await conn.query(
            `UPDATE asignaciones
             SET usuario_id = ?, supervisor_id = ?, fecha_asignacion = NOW()
             WHERE id = ?`,
            [zona.cobrador_id, supervisorId, asignacionActual.id]
          );
          cuotasAsignadas++;
        } else {
          await conn.query(
            'INSERT INTO asignaciones (cuota_id, usuario_id, supervisor_id) VALUES (?, ?, ?)',
            [cuota.id, zona.cobrador_id, supervisorId]
          );
          cuotasAsignadas++;
        }
      }
    }

    await conn.commit();

    return res.json({
      message: aviso
        ? `Cliente asignado a "${zona.nombre}". Aviso: el cliente está dentro de la zona de ${aviso.cobradorNombre}.`
        : `Cliente asignado a "${zona.nombre}"`,
      data: {
        cliente_id,
        zona_id,
        zona_nombre: zona.nombre,
        cuotasAsignadas,
        aviso,
      },
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};

const autoAsignar = async (req, res, next) => {
  try {
    const { empresaId, rol, id: supervisorId } = req.user;

    if (rol !== 'SUPERVISOR' && rol !== 'ADMIN') {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    const empId = rol === 'ADMIN' ? (req.body.empresa_id || empresaId) : empresaId;

    // 1. Zonas activas con cobrador y pol�gono definidos
    const [zonas] = await pool.query(
      `SELECT id, cobrador_id, poligono
       FROM zonas
       WHERE empresa_id = ? AND estado = 1 AND cobrador_id IS NOT NULL AND poligono IS NOT NULL`,
      [empId]
    );

    if (zonas.length === 0) {
      return res.json({
        data: { asignadas: 0, clientesUbicados: 0 },
        message: 'No hay zonas con cobrador y pol�gono configurados',
      });
    }

    // 2. Clientes con coordenadas en la empresa
    const [clientes] = await pool.query(
      `SELECT ce.id AS rel_id, ce.cliente_id, ce.latitud, ce.longitud
       FROM clientes_empresas ce
       WHERE ce.empresa_id = ? AND ce.latitud IS NOT NULL AND ce.longitud IS NOT NULL AND ce.estado = 1`,
      [empId]
    );

    let asignadas = 0;
    let clientesUbicados = 0;

    for (const cliente of clientes) {
      const lat = parseFloat(cliente.latitud);
      const lng = parseFloat(cliente.longitud);

      let zonaMatch = null;
      for (const zona of zonas) {
        let polygon;
        try {
          polygon = typeof zona.poligono === 'string' ? JSON.parse(zona.poligono) : zona.poligono;
        } catch {
          continue;
        }
        if (Array.isArray(polygon) && polygon.length >= 3 && pointInPolygon(lat, lng, polygon)) {
          zonaMatch = zona;
          break;
        }
      }

      if (!zonaMatch) continue;

      // Actualizar zona_id del cliente
      await pool.query('UPDATE clientes_empresas SET zona_id = ? WHERE id = ?', [
        zonaMatch.id,
        cliente.rel_id,
      ]);
      clientesUbicados++;

      // Cuotas pendientes/vencidas del cliente en esta empresa
      const [cuotas] = await pool.query(
        `SELECT q.id FROM cuotas q
         INNER JOIN creditos cr ON cr.id = q.credito_id
         WHERE cr.cliente_id = ? AND cr.empresa_id = ? AND q.estado IN ('PENDIENTE','VENCIDA')`,
        [cliente.cliente_id, empId]
      );

      for (const cuota of cuotas) {
        const [[existing]] = await pool.query(
          "SELECT id FROM asignaciones WHERE cuota_id = ? AND usuario_id = ? AND estado = 'PENDIENTE'",
          [cuota.id, zonaMatch.cobrador_id]
        );
        if (!existing) {
          await pool.query(
            'INSERT INTO asignaciones (cuota_id, usuario_id, supervisor_id) VALUES (?, ?, ?)',
            [cuota.id, zonaMatch.cobrador_id, supervisorId]
          );
          asignadas++;
        }
      }
    }

    return res.json({
      data: { asignadas, clientesUbicados },
      message: `${asignadas} cuota(s) asignadas  ${clientesUbicados} cliente(s) ubicados en zonas`,
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/zonas/:id/reasignar
// Reasigna los clientes/cuotas de UNA zona específica a su cobrador.
// Útil cuando se cambia el polígono de la zona: los clientes que
// quedan dentro del nuevo polígono se asignan al cobrador de la zona.
// Body opcional: { fecha_limite } para las nuevas asignaciones.
// ─────────────────────────────────────────────────────────────
const reasignarZona = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { empresaId, rol, id: supervisorId } = req.user;
    const { fecha_limite } = req.body || {};

    if (rol !== 'SUPERVISOR' && rol !== 'ADMIN') {
      return res.status(403).json({ message: 'Sin permisos' });
    }

    // 1. Zona activa con cobrador y polígono definidos
    const [[zona]] = await pool.query(
      `SELECT id, empresa_id, cobrador_id, poligono
       FROM zonas
       WHERE id = ? AND estado = 1`,
      [id]
    );
    if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
    if (rol !== 'ADMIN' && zona.empresa_id !== empresaId)
      return res.status(403).json({ message: 'Sin permisos' });
    if (!zona.cobrador_id) {
      return res.status(400).json({ message: 'La zona no tiene cobrador asignado' });
    }

    let polygon;
    try {
      polygon = typeof zona.poligono === 'string' ? JSON.parse(zona.poligono) : zona.poligono;
    } catch {
      polygon = null;
    }
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({ message: 'La zona no tiene un polígono válido' });
    }

    // 2. Clientes con coordenadas dentro del polígono de esta zona
    const [clientes] = await pool.query(
      `SELECT ce.id AS rel_id, ce.cliente_id, ce.latitud, ce.longitud
       FROM clientes_empresas ce
       WHERE ce.empresa_id = ? AND ce.latitud IS NOT NULL AND ce.longitud IS NOT NULL AND ce.estado = 1`,
      [zona.empresa_id]
    );

    let clientesUbicados = 0;
    let asignadas = 0;
    let reasignadas = 0;

    for (const cliente of clientes) {
      const lat = parseFloat(cliente.latitud);
      const lng = parseFloat(cliente.longitud);
      if (!pointInPolygon(lat, lng, polygon)) continue;

      // Actualizar zona_id del cliente
      await pool.query('UPDATE clientes_empresas SET zona_id = ? WHERE id = ?', [
        zona.id,
        cliente.rel_id,
      ]);
      clientesUbicados++;

      // Cuotas pendientes/vencidas del cliente en esta empresa
      const [cuotas] = await pool.query(
        `SELECT q.id FROM cuotas q
         INNER JOIN creditos cr ON cr.id = q.credito_id
         WHERE cr.cliente_id = ? AND cr.empresa_id = ? AND q.estado IN ('PENDIENTE','VENCIDA')`,
        [cliente.cliente_id, zona.empresa_id]
      );

      for (const cuota of cuotas) {
        // Si ya está asignada a OTRO cobrador pendiente, reasignarla a este
        const [[asignacionActual]] = await pool.query(
          `SELECT id FROM asignaciones
           WHERE cuota_id = ? AND estado = 'PENDIENTE'`,
          [cuota.id]
        );

        if (asignacionActual) {
          const [[mismaAsignacion]] = await pool.query(
            `SELECT id FROM asignaciones
             WHERE cuota_id = ? AND usuario_id = ? AND estado = 'PENDIENTE'`,
            [cuota.id, zona.cobrador_id]
          );
          if (mismaAsignacion) continue; // ya está asignada a este cobrador

          // Reasignar: cambiar el cobrador de la asignación pendiente
          await pool.query(
            `UPDATE asignaciones
             SET usuario_id = ?, supervisor_id = ?, fecha_asignacion = NOW(),
                 fecha_limite = COALESCE(?, fecha_limite)
             WHERE id = ?`,
            [zona.cobrador_id, supervisorId, fecha_limite || null, asignacionActual.id]
          );
          reasignadas++;
        } else {
          // Nueva asignación
          await pool.query(
            'INSERT INTO asignaciones (cuota_id, usuario_id, supervisor_id, fecha_limite) VALUES (?, ?, ?, ?)',
            [cuota.id, zona.cobrador_id, supervisorId, fecha_limite || null]
          );
          asignadas++;
        }
      }
    }

    return res.json({
      data: { asignadas, reasignadas, clientesUbicados },
      message: `${asignadas} cuota(s) asignadas, ${reasignadas} reasignada(s) · ${clientesUbicados} cliente(s) ubicados en la zona`,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getZonas, createZona, updateZona, deleteZona, autoAsignar, reasignarZona, getNoAsignadas, asignarClienteZona };
