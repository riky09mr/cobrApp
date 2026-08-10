const pool = require('../config/db');
const { enviarPushAUsuario } = require('./pushService');

// Helpers de hora local Paraguay (America/Asuncion)
const localDate = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Asuncion' });

/**
 * Envía alertas push a los cobradores sobre cuotas vencidas o
 * próximas a vencer que tienen asignadas y aún no gestionaron.
 *
 * Se ejecuta vía node-cron (por ejemplo cada mañana a las 07:00).
 *
 * Lógica:
 *  - Busca asignaciones PENDIENTES de cobradores activos.
 *  - Para cada cobrador, agrupa cuotas VENCIDAS (fecha_vencimiento < hoy)
 *    y PRÓXIMAS (fecha_vencimiento entre hoy y +3 días).
 *  - Envía UNA notificación por cobrador con el resumen.
 */
const enviarAlertasVencimiento = async () => {
  const hoy = localDate();

  // Cobradores con asignaciones pendientes y cuotas sin pagar
  const [rows] = await pool.query(
    `SELECT
       a.usuario_id AS cobrador_id,
       u.nombre     AS cobrador_nombre,
       u.apellido   AS cobrador_apellido,
       q.fecha_vencimiento,
       q.saldo_cuota,
       cl.nombre    AS cliente_nombre,
       cl.apellido  AS cliente_apellido
     FROM asignaciones a
     INNER JOIN cuotas q              ON q.id = a.cuota_id
     INNER JOIN creditos cr           ON cr.id = q.credito_id
     INNER JOIN clientes cl           ON cl.id = cr.cliente_id
     INNER JOIN usuarios u            ON u.id = a.usuario_id
     WHERE a.estado = 'PENDIENTE'
       AND q.estado != 'PAGADO'
       AND q.saldo_cuota > 0
       AND u.estado = 1
       AND q.fecha_vencimiento <= DATE_ADD(?, INTERVAL 3 DAY)`
  );

  // Agrupar por cobrador
  const porCobrador = new Map();
  for (const r of rows) {
    const fecha = new Date(r.fecha_vencimiento);
    const fechaISO = fecha.toISOString().split('T')[0];
    const esVencida = fechaISO < hoy;

    if (!porCobrador.has(r.cobrador_id)) {
      porCobrador.set(r.cobrador_id, { vencidas: 0, proximas: 0, nombre: `${r.cobrador_nombre} ${r.cobrador_apellido ?? ''}`.trim() });
    }
    const grupo = porCobrador.get(r.cobrador_id);
    if (esVencida) grupo.vencidas++;
    else grupo.proximas++;
  }

  let enviadas = 0;
  for (const [cobradorId, grupo] of porCobrador) {
    if (grupo.vencidas === 0 && grupo.proximas === 0) continue;

    const partes = [];
    if (grupo.vencidas > 0) partes.push(`${grupo.vencidas} vencida${grupo.vencidas !== 1 ? 's' : ''}`);
    if (grupo.proximas > 0) partes.push(`${grupo.proximas} próxima${grupo.proximas !== 1 ? 's' : ''} a vencer`);

    const ok = await enviarPushAUsuario(cobradorId, {
      title: 'Cobranzas pendientes',
      body: `Tenés ${partes.join(' y ')} para gestionar hoy.`,
      data: { screen: 'Agenda' },
    });
    if (ok > 0) enviadas++;
  }

  console.log(`[Cron push] ${enviadas} cobradores notificados.`);
  return enviadas;
};

module.exports = { enviarAlertasVencimiento };
