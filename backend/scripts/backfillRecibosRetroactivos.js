/**
 * Script: backfillRecibosRetroactivos.js
 * 
 * Genera recibos retroactivos para las visitas cobradas que no tienen recibo.
 * 
 * Pasos:
 * 1. Crea el numerador RECIBO_COBRANZA para el punto de expedición 6 (caja).
 * 2. Asigna la caja (id=1) al cobrador 5 (RIVALDO SAMANIEGO).
 * 3. Crea una caja_aperturas ABIERTA para el cobrador 5.
 * 4. Genera los recibos para las 16 visitas cobradas.
 * 
 * Uso: node scripts/backfillRecibosRetroactivos.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cobrApp',
  multipleStatements: true,
};

// Configuración de la caja v12
const CAJA_ID = 1;
const COBRADOR_ID = 5;
const EMPRESA_ID = 6;
const TIMBRADO_ID = 1;
const ESTABLECIMIENTO_ID = 1;
const PUNTO_EXPEDICION_ID = 6;
const ESTABLECIMIENTO_CODIGO = '001';
const PUNTO_CODIGO = '002';
const SERIE = 'A1';

const toMysqlLocal = (isoOrMs) =>
  new Date(isoOrMs || Date.now())
    .toLocaleString('sv-SE', { timeZone: 'America/Asuncion' })
    .replace('T', ' ');

const toDateLocal = (isoOrMs) =>
  new Date(isoOrMs || Date.now())
    .toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Conectado a la base de datos.');

  try {
    await conn.beginTransaction();

    // ============================================================
    // PASO 1: Crear numerador RECIBO_COBRANZA si no existe
    // ============================================================
    const [[numeradorExistente]] = await conn.query(
      `SELECT id FROM numeradores
       WHERE empresa_id = ? AND timbrado_id = ? AND establecimiento_id = ?
         AND punto_expedicion_id = ? AND tipo_documento = 'RECIBO_COBRANZA'
         AND deleted_at IS NULL
       LIMIT 1`,
      [EMPRESA_ID, TIMBRADO_ID, ESTABLECIMIENTO_ID, PUNTO_EXPEDICION_ID]
    );

    let numeradorId;
    if (numeradorExistente) {
      numeradorId = numeradorExistente.id;
      console.log(`Numerador RECIBO_COBRANZA ya existe (id=${numeradorId}).`);
    } else {
      const [numeradorResult] = await conn.query(
        `INSERT INTO numeradores
           (empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id,
            tipo_documento, serie, numero_desde, numero_hasta, ultimo_numero_asignado,
            activo, bloqueado, created_by, updated_by)
         VALUES (?, ?, ?, ?, 'RECIBO_COBRANZA', ?, 1, 9999999, 0, 1, 0, ?, ?)`,
        [EMPRESA_ID, TIMBRADO_ID, ESTABLECIMIENTO_ID, PUNTO_EXPEDICION_ID,
         SERIE, COBRADOR_ID, COBRADOR_ID]
      );
      numeradorId = numeradorResult.insertId;
      console.log(`Numerador RECIBO_COBRANZA creado (id=${numeradorId}).`);
    }

    // ============================================================
    // PASO 2: Asignar la caja al cobrador 5
    // ============================================================
    const [[caja]] = await conn.query(
      `SELECT id, cobrador_asignado_id FROM cajas WHERE id = ? AND deleted_at IS NULL`,
      [CAJA_ID]
    );
    if (!caja) {
      throw new Error(`Caja ${CAJA_ID} no encontrada.`);
    }
    if (caja.cobrador_asignado_id !== COBRADOR_ID) {
      await conn.query(
        `UPDATE cajas SET cobrador_asignado_id = ?, updated_at = NOW(), updated_by = ?
         WHERE id = ?`,
        [COBRADOR_ID, COBRADOR_ID, CAJA_ID]
      );
      console.log(`Caja ${CAJA_ID} asignada al cobrador ${COBRADOR_ID}.`);
    } else {
      console.log(`Caja ${CAJA_ID} ya estaba asignada al cobrador ${COBRADOR_ID}.`);
    }

    // ============================================================
    // PASO 3: Crear caja_aperturas ABIERTA para el cobrador 5
    // ============================================================
    const [[aperturaExistente]] = await conn.query(
      `SELECT id, saldo_actual FROM caja_aperturas
       WHERE cobrador_id = ? AND estado = 'ABIERTA' AND deleted_at IS NULL
       LIMIT 1`,
      [COBRADOR_ID]
    );

    let cajaAperturaId;
    let saldoActualApertura;
    if (aperturaExistente) {
      cajaAperturaId = aperturaExistente.id;
      saldoActualApertura = Number(aperturaExistente.saldo_actual || 0);
      console.log(`Caja apertura v12 ya existe (id=${cajaAperturaId}, saldo=${saldoActualApertura}).`);
    } else {
      const fechaHoraApertura = toMysqlLocal();
      const fechaOperacion = toDateLocal();
      const [aperturaResult] = await conn.query(
        `INSERT INTO caja_aperturas
           (empresa_id, caja_id, cobrador_id, fecha_operacion, fecha_hora_apertura,
            saldo_inicial, saldo_actual, estado, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, 0, 0, 'ABIERTA', ?, ?)`,
        [EMPRESA_ID, CAJA_ID, COBRADOR_ID, fechaOperacion, fechaHoraApertura,
         COBRADOR_ID, COBRADOR_ID]
      );
      cajaAperturaId = aperturaResult.insertId;
      saldoActualApertura = 0;
      console.log(`Caja apertura v12 creada (id=${cajaAperturaId}).`);
    }

    // ============================================================
    // PASO 4: Obtener las visitas cobradas sin recibo
    // ============================================================
    const [visitas] = await conn.query(
      `SELECT
         vc.id AS visita_id,
         vc.asignacion_id,
         vc.cobrador_id,
         vc.monto_cobrado,
         vc.fecha_hora,
         vc.arqueo_id,
         vc.recibo_id,
         vc.medio_pago_id,
         a.cuota_id,
         q.numero_cuota,
         cr.id AS credito_id,
         cr.numero_credito,
         cr.empresa_id,
         cr.cliente_id
       FROM visitas_cobro vc
       LEFT JOIN asignaciones a ON a.id = vc.asignacion_id
       LEFT JOIN cuotas q ON q.id = a.cuota_id
       LEFT JOIN creditos cr ON cr.id = q.credito_id
       WHERE vc.resultado = 'cobrado'
         AND vc.recibo_id IS NULL
       ORDER BY vc.id`
    );

    console.log(`Encontradas ${visitas.length} visitas cobradas sin recibo.`);

    if (visitas.length === 0) {
      console.log('No hay visitas para procesar. Saliendo.');
      await conn.rollback();
      return;
    }

    // ============================================================
    // PASO 5: Generar recibos para cada visita
    // ============================================================
    let recibosCreados = 0;
    let errores = [];

    for (const visita of visitas) {
      try {
        const importe = Number(visita.monto_cobrado);
        const fechaEmision = toMysqlLocal(visita.fecha_hora);
        const concepto = `Cobro cuota N. ${visita.numero_cuota} - Credito ${visita.numero_credito || visita.credito_id}`;

        // Obtener siguiente número de recibo
        const [[numerador]] = await conn.query(
          `SELECT id, numero_desde, numero_hasta, ultimo_numero_asignado, serie
           FROM numeradores
           WHERE id = ? FOR UPDATE`,
          [numeradorId]
        );

        const ultimoAsignado = Number(numerador.ultimo_numero_asignado || 0);
        const numeroDesde = Number(numerador.numero_desde || 1);
        const numeroHasta = Number(numerador.numero_hasta || 99999999);
        const siguienteNumero = Math.max(ultimoAsignado + 1, numeroDesde);

        if (siguienteNumero > numeroHasta) {
          throw new Error(`Numerador alcanzó su límite (${numeroHasta})`);
        }

        await conn.query(
          `UPDATE numeradores SET ultimo_numero_asignado = ?, updated_at = NOW()
           WHERE id = ?`,
          [siguienteNumero, numeradorId]
        );

        const numeroRecibo = `${ESTABLECIMIENTO_CODIGO}-${PUNTO_CODIGO}-${String(siguienteNumero).padStart(8, '0')}`;

        // Insertar recibo
        const [reciboResult] = await conn.query(
          `INSERT INTO recibos
             (empresa_id, timbrado_id, establecimiento_id, punto_expedicion_id,
              caja_id, caja_apertura_id, cobrador_id, cliente_id, numerador_id,
              visita_cobro_id, numero_secuencia, numero_recibo, estado,
              fecha_emision, moneda, total_recibo, tipo_emision,
              monto_sobrepago, saldo_a_favor, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITIDO', ?, 'PYG', ?, 'IMPRESO', 0, 0, ?, ?)`,
          [
            visita.empresa_id,
            TIMBRADO_ID,
            ESTABLECIMIENTO_ID,
            PUNTO_EXPEDICION_ID,
            CAJA_ID,
            cajaAperturaId,
            visita.cobrador_id,
            visita.cliente_id,
            numeradorId,
            visita.visita_id,
            siguienteNumero,
            numeroRecibo,
            fechaEmision,
            importe,
            visita.cobrador_id,
            visita.cobrador_id,
          ]
        );

        const reciboId = reciboResult.insertId;

        // Insertar detalle del recibo
        await conn.query(
          `INSERT INTO recibo_detalles
             (recibo_id, cuota_id, credito_id, concepto, cantidad, monto_unitario,
              monto_total, orden_detalle, created_by, updated_by)
           VALUES (?, ?, ?, ?, 1, ?, ?, 1, ?, ?)`,
          [
            reciboId,
            visita.cuota_id,
            visita.credito_id,
            concepto,
            importe,
            importe,
            visita.cobrador_id,
            visita.cobrador_id,
          ]
        );

        // Insertar movimiento de caja
        const saldoAnterior = saldoActualApertura;
        const saldoPosterior = saldoAnterior + importe;
        saldoActualApertura = saldoPosterior;

        await conn.query(
          `INSERT INTO caja_movimientos
             (empresa_id, caja_id, caja_apertura_id, recibo_id, tipo_movimiento,
              sentido_saldo, importe, saldo_anterior, saldo_posterior, descripcion,
              referencia_tabla, referencia_id, fecha_hora_movimiento, created_by, updated_by)
           VALUES (?, ?, ?, ?, 'COBRANZA', 'SUMA', ?, ?, ?, ?, 'visitas_cobro', ?, ?, ?, ?)`,
          [
            visita.empresa_id,
            CAJA_ID,
            cajaAperturaId,
            reciboId,
            importe,
            saldoAnterior,
            saldoPosterior,
            concepto,
            visita.visita_id,
            fechaEmision,
            visita.cobrador_id,
            visita.cobrador_id,
          ]
        );

        // Actualizar visita con recibo_id
        await conn.query(
          `UPDATE visitas_cobro SET recibo_id = ? WHERE id = ?`,
          [reciboId, visita.visita_id]
        );

        recibosCreados++;
        console.log(`  ✓ Recibo ${numeroRecibo} (id=${reciboId}) para visita ${visita.visita_id} - Gs. ${importe.toLocaleString('es-PY')}`);
      } catch (err) {
        errores.push({ visitaId: visita.visita_id, error: err.message });
        console.error(`  ✗ Error en visita ${visita.visita_id}: ${err.message}`);
      }
    }

    // Actualizar saldo de la apertura y de la caja
    await conn.query(
      `UPDATE caja_aperturas SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
       WHERE id = ?`,
      [saldoActualApertura, COBRADOR_ID, cajaAperturaId]
    );

    await conn.query(
      `UPDATE cajas SET saldo_actual = ?, updated_at = NOW(), updated_by = ?
       WHERE id = ?`,
      [saldoActualApertura, COBRADOR_ID, CAJA_ID]
    );

    await conn.commit();

    console.log('\n========================================');
    console.log(`Recibos creados: ${recibosCreados}`);
    console.log(`Errores: ${errores.length}`);
    console.log(`Saldo final de la apertura: Gs. ${saldoActualApertura.toLocaleString('es-PY')}`);
    console.log('========================================');

    if (errores.length > 0) {
      console.log('\nErrores detallados:');
      errores.forEach(e => console.log(`  - Visita ${e.visitaId}: ${e.error}`));
    }

  } catch (error) {
    await conn.rollback();
    console.error('Error fatal:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Error no controlado:', err);
  process.exit(1);
});
