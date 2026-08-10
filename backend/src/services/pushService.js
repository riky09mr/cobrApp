const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
// Servicio de notificaciones push usando la API HTTP de Expo.
// No requiere dependencias externas (usa fetch nativo de Node 18+).
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/
// ─────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envía una notificación push a un token de Expo.
 * @param {string} token  Expo Push Token (ExponentPushToken[...])
 * @param {object} data   { title, body, data? }
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function enviarPush(token, { title, body, data = {} }) {
  if (!token || !token.startsWith('ExponentPushToken')) {
    return false;
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      }),
    });

    const json = await res.json();
    // Expo devuelve { data: [ { status: 'ok' | 'error', ... } ] }
    const ticket = json?.data?.[0];
    return ticket?.status === 'ok';
  } catch (err) {
    console.error('[push] Error enviando notificación:', err.message);
    return false;
  }
}

/**
 * Envía una notificación a todos los dispositivos de un usuario.
 * @param {number} usuarioId
 * @param {object} payload  { title, body, data? }
 */
async function enviarPushAUsuario(usuarioId, payload) {
  const [tokens] = await pool.query(
    `SELECT token FROM push_tokens WHERE usuario_id = ?`,
    [usuarioId]
  );

  const resultados = await Promise.all(
    tokens.map((t) => enviarPush(t.token, payload))
  );

  return resultados.filter(Boolean).length;
}

/**
 * Envía una notificación a todos los cobradores de una empresa.
 * @param {number} empresaId
 * @param {object} payload  { title, body, data? }
 */
async function enviarPushAEmpresa(empresaId, payload) {
  const [tokens] = await pool.query(
    `SELECT pt.token
     FROM push_tokens pt
     INNER JOIN usuarios u ON u.id = pt.usuario_id
     WHERE u.empresa_id = ? AND u.estado = 1`,
    [empresaId]
  );

  const resultados = await Promise.all(
    tokens.map((t) => enviarPush(t.token, payload))
  );

  return resultados.filter(Boolean).length;
}

module.exports = {
  enviarPush,
  enviarPushAUsuario,
  enviarPushAEmpresa,
};
