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
    const params = rol === 'ADMIN' ? [] : [empresaId];
    const where = rol === 'ADMIN' ? '' : 'WHERE z.empresa_id = ?';

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
  try {
    const { id } = req.params;
    const { empresaId, rol } = req.user;

    const [[zona]] = await pool.query('SELECT empresa_id FROM zonas WHERE id = ?', [id]);
    if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
    if (rol !== 'ADMIN' && zona.empresa_id !== empresaId)
      return res.status(403).json({ message: 'Sin permisos' });

    await pool.query('UPDATE zonas SET estado = 0 WHERE id = ?', [id]);
    return res.json({ message: 'Zona desactivada' });
  } catch (error) {
    return next(error);
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

module.exports = { getZonas, createZona, updateZona, deleteZona, autoAsignar };
