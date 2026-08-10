#!/usr/bin/env node
require('dotenv').config();

const pool = require('../src/config/db');
const { getExistingTables, hasAllTables } = require('../src/services/cobranzas/schemaSupport');

const REQUIRED_TABLES = [
  'facturas_timbrado',
  'timbrados',
  'establecimientos',
  'puntos_expedicion',
  'numeradores',
  'cajas',
  'usuarios',
  'roles',
];

const commitMode = process.argv.includes('--commit');

const toCode3 = (value, fallback = 1) => String(Number(value || fallback)).padStart(3, '0');

const getLegacyTimbrados = async (conn) => {
  const [rows] = await conn.query(
    `SELECT
       ft.id,
       ft.empresa_id,
       ft.numero_timbrado,
       ft.establecimiento,
       ft.punto_emision,
       ft.fecha_inicio,
       ft.fecha_vencimiento,
       ft.numero_desde,
       ft.numero_hasta,
       ft.numero_actual,
       ft.es_electronica,
       ft.activo,
       t.id AS timbrado_v12_id
     FROM facturas_timbrado ft
     LEFT JOIN timbrados t ON t.facturas_timbrado_legacy_id = ft.id
     ORDER BY ft.empresa_id, ft.id`
  );
  return rows;
};

const ensureTimbrado = async (conn, legacy) => {
  if (legacy.timbrado_v12_id) {
    return legacy.timbrado_v12_id;
  }

  const [[existing]] = await conn.query(
    `SELECT id FROM timbrados
     WHERE empresa_id = ? AND numero_timbrado = ? AND deleted_at IS NULL
     LIMIT 1`,
    [legacy.empresa_id, legacy.numero_timbrado]
  );
  if (existing) {
    await conn.query(
      `UPDATE timbrados SET facturas_timbrado_legacy_id = COALESCE(facturas_timbrado_legacy_id, ?)
       WHERE id = ?`,
      [legacy.id, existing.id]
    );
    return existing.id;
  }

  const estado = legacy.activo
    ? ((legacy.fecha_vencimiento && new Date(legacy.fecha_vencimiento) < new Date()) ? 'VENCIDO' : 'VIGENTE')
    : 'INACTIVO';

  const [result] = await conn.query(
    `INSERT INTO timbrados
       (empresa_id, numero_timbrado, fecha_inicio, fecha_fin, estado, observaciones,
        es_electronico, facturas_timbrado_legacy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      legacy.empresa_id,
      legacy.numero_timbrado,
      legacy.fecha_inicio || new Date(),
      legacy.fecha_vencimiento || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      estado,
      'Backfill desde facturas_timbrado',
      legacy.es_electronica ? 1 : 0,
      legacy.id,
    ]
  );

  return result.insertId;
};

const ensureEstablecimiento = async (conn, { empresaId, timbradoId, codigo }) => {
  const code = toCode3(codigo);
  const [[existing]] = await conn.query(
    `SELECT id FROM establecimientos
     WHERE empresa_id = ? AND codigo = ? AND deleted_at IS NULL
     LIMIT 1`,
    [empresaId, code]
  );
  if (existing) {
    await conn.query(
      `UPDATE establecimientos
       SET timbrado_id = COALESCE(timbrado_id, ?), activo = 1, updated_at = NOW()
       WHERE id = ?`,
      [timbradoId, existing.id]
    );
    return existing.id;
  }

  const [result] = await conn.query(
    `INSERT INTO establecimientos (empresa_id, timbrado_id, codigo, descripcion, activo)
     VALUES (?, ?, ?, ?, 1)`,
    [empresaId, timbradoId, code, `Establecimiento ${code}`]
  );
  return result.insertId;
};

const ensurePunto = async (conn, { empresaId, timbradoId, establecimientoId, codigo }) => {
  const code = toCode3(codigo);
  const [[existing]] = await conn.query(
    `SELECT id FROM puntos_expedicion
     WHERE establecimiento_id = ? AND codigo = ? AND deleted_at IS NULL
     LIMIT 1`,
    [establecimientoId, code]
  );
  if (existing) {
    await conn.query(
      `UPDATE puntos_expedicion
       SET timbrado_id = ?, empresa_id = ?, activo = 1, updated_at = NOW()
       WHERE id = ?`,
      [timbradoId, empresaId, existing.id]
    );
    return existing.id;
  }

  const [result] = await conn.query(
    `INSERT INTO puntos_expedicion (empresa_id, timbrado_id, establecimiento_id, codigo, descripcion, activo)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [empresaId, timbradoId, establecimientoId, code, `Punto ${code}`]
  );
  return result.insertId;
};

const ensureNumerador = async (conn, legacy, { timbradoId, establecimientoId, puntoId }) => {
  const ultimoAsignado = Math.max(Number(legacy.numero_actual || 1) - 1, Number(legacy.numero_desde || 1) - 1, 0);
  const [[existing]] = await conn.query(
    `SELECT id, ultimo_numero_asignado FROM numeradores
     WHERE empresa_id = ?
       AND timbrado_id = ?
       AND establecimiento_id = ?
       AND punto_expedicion_id = ?
       AND tipo_documento = 'RECIBO_COBRANZA'
       AND serie = 'A1'
       AND deleted_at IS NULL
     LIMIT 1`,
    [legacy.empresa_id, timbradoId, establecimientoId, puntoId]
  );

  if (existing) {
    if (Number(existing.ultimo_numero_asignado || 0) < ultimoAsignado) {
      await conn.query(
        `UPDATE numeradores
         SET ultimo_numero_asignado = ?, numero_desde = ?, numero_hasta = ?, activo = 1, bloqueado = 0, updated_at = NOW()
         WHERE id = ?`,
        [ultimoAsignado, Number(legacy.numero_desde || 1), Number(legacy.numero_hasta || 9999999), existing.id]
      );
    }
    return existing.id;
  }

  const [result] = await conn.query(
    `INSERT INTO numeradores
       (empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id, tipo_documento,
        serie, numero_desde, numero_hasta, ultimo_numero_asignado, activo, bloqueado)
     VALUES (?, ?, ?, ?, 'RECIBO_COBRANZA', 'A1', ?, ?, ?, 1, 0)`,
    [
      legacy.empresa_id,
      timbradoId,
      establecimientoId,
      puntoId,
      Number(legacy.numero_desde || 1),
      Number(legacy.numero_hasta || 9999999),
      ultimoAsignado,
    ]
  );
  return result.insertId;
};

const getCompanyCobradores = async (conn, empresaId) => {
  const [rows] = await conn.query(
    `SELECT
       u.id,
       u.nombre,
       u.apellido,
       MAX(ac.fecha_apertura) AS ultima_apertura
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     LEFT JOIN arqueos_caja ac ON ac.cobrador_id = u.id
     WHERE u.empresa_id = ?
       AND u.estado = 1
       AND r.nombre = 'COBRADOR'
     GROUP BY u.id, u.nombre, u.apellido
     ORDER BY ultima_apertura DESC, u.id ASC`,
    [empresaId]
  );
  return rows;
};

const ensureCaja = async (conn, { empresaId, puntoId, nombre, cobradorId }) => {
  const [[existing]] = await conn.query(
    `SELECT id, cobrador_asignado_id FROM cajas
     WHERE empresa_id = ? AND punto_expedicion_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [empresaId, puntoId]
  );

  if (existing) {
    if (!existing.cobrador_asignado_id && cobradorId) {
      await conn.query(
        `UPDATE cajas
         SET cobrador_asignado_id = ?, estado = 'ACTIVA', updated_at = NOW()
         WHERE id = ?`,
        [cobradorId, existing.id]
      );
    }
    return existing.id;
  }

  const [result] = await conn.query(
    `INSERT INTO cajas
       (empresa_id, punto_expedicion_id, nombre, estado, cobrador_asignado_id,
        saldo_inicial_referencia, saldo_actual)
     VALUES (?, ?, ?, 'ACTIVA', ?, 0, 0)`,
    [empresaId, puntoId, nombre, cobradorId || null]
  );
  return result.insertId;
};

const main = async () => {
  const conn = await pool.getConnection();
  const summary = {
    mode: commitMode ? 'commit' : 'dry-run',
    timbrados: 0,
    establecimientos: 0,
    puntos: 0,
    numeradores: 0,
    cajas: 0,
    warnings: [],
  };

  try {
    const existingTables = await getExistingTables(conn, REQUIRED_TABLES);
    if (!hasAllTables(existingTables, REQUIRED_TABLES)) {
      const missing = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));
      throw new Error(`Faltan tablas requeridas para el backfill: ${missing.join(', ')}`);
    }

    await conn.beginTransaction();

    const legacyTimbrados = await getLegacyTimbrados(conn);
    const companyMap = new Map();

    for (const legacy of legacyTimbrados) {
      const timbradoId = await ensureTimbrado(conn, legacy);
      const establecimientoId = await ensureEstablecimiento(conn, {
        empresaId: legacy.empresa_id,
        timbradoId,
        codigo: legacy.establecimiento,
      });
      const puntoId = await ensurePunto(conn, {
        empresaId: legacy.empresa_id,
        timbradoId,
        establecimientoId,
        codigo: legacy.punto_emision,
      });
      await ensureNumerador(conn, legacy, { timbradoId, establecimientoId, puntoId });

      if (!companyMap.has(legacy.empresa_id)) {
        companyMap.set(legacy.empresa_id, []);
      }
      companyMap.get(legacy.empresa_id).push({
        timbradoId,
        establecimientoId,
        puntoId,
        legacy,
      });
    }

    summary.timbrados = legacyTimbrados.length;

    for (const [empresaId, pointConfigs] of companyMap.entries()) {
      const cobradores = await getCompanyCobradores(conn, empresaId);
      const queue = [...cobradores];

      for (const config of pointConfigs) {
        const cobrador = queue.shift() || null;
        const nombreCaja = `Caja ${toCode3(config.legacy.establecimiento)}-${toCode3(config.legacy.punto_emision)}`;
        await ensureCaja(conn, {
          empresaId,
          puntoId: config.puntoId,
          nombre: nombreCaja,
          cobradorId: cobrador?.id || null,
        });
      }

      if (queue.length > 0) {
        summary.warnings.push(
          `Empresa ${empresaId}: ${queue.length} cobrador(es) quedaron sin caja V12 porque no existen puntos de expedición fiscales suficientes en el legado.`
        );
      }
    }

    const [[counts]] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM establecimientos WHERE deleted_at IS NULL) AS establecimientos,
         (SELECT COUNT(*) FROM puntos_expedicion WHERE deleted_at IS NULL) AS puntos,
         (SELECT COUNT(*) FROM numeradores WHERE deleted_at IS NULL) AS numeradores,
         (SELECT COUNT(*) FROM cajas WHERE deleted_at IS NULL) AS cajas`
    );

    summary.establecimientos = Number(counts.establecimientos || 0);
    summary.puntos = Number(counts.puntos || 0);
    summary.numeradores = Number(counts.numeradores || 0);
    summary.cajas = Number(counts.cajas || 0);

    if (commitMode) {
      await conn.commit();
    } else {
      await conn.rollback();
    }

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    console.error('[backfill-cobranzas-v12] Error:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };