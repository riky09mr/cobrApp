const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

/**
 * POST /api/push/registrar
 * Registra (o actualiza) el token push de un dispositivo.
 * Body: { token, plataforma }
 */
router.post('/registrar', async (req, res) => {
  const { token, plataforma } = req.body;
  const usuarioId = req.user.id;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'El token es obligatorio' });
  }

  try {
    await pool.query(
      `INSERT INTO push_tokens (usuario_id, token, plataforma)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         usuario_id = VALUES(usuario_id),
         plataforma = VALUES(plataforma),
         ultimo_uso = NOW()`,
      [usuarioId, token, plataforma || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] Error registrando token:', err.message);
    res.status(500).json({ message: 'Error al registrar el token' });
  }
});

/**
 * DELETE /api/push/eliminar
 * Elimina un token push (logout o desinstalación).
 * Body: { token }
 */
router.delete('/eliminar', async (req, res) => {
  const { token } = req.body;
  const usuarioId = req.user.id;

  if (!token) {
    return res.status(400).json({ message: 'El token es obligatorio' });
  }

  try {
    await pool.query(
      `DELETE FROM push_tokens WHERE token = ? AND usuario_id = ?`,
      [token, usuarioId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] Error eliminando token:', err.message);
    res.status(500).json({ message: 'Error al eliminar el token' });
  }
});

module.exports = router;
