const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const {
  getHorarios,
  guardarHorario,
  eliminarHorario,
  getExcepciones,
  crearExcepcion,
  eliminarExcepcion,
} = require('../controllers/horariosController');

const router = express.Router();

router.use(authenticateToken);

// Horario semanal
router.get('/:cobradorId',              requirePermission('horarios', 'ver'), getHorarios);
router.post('/',                         requirePermission('horarios', 'editar'), guardarHorario);
router.delete('/:id',                    requirePermission('horarios', 'editar'), eliminarHorario);

// Excepciones
router.get('/:cobradorId/excepciones',   requirePermission('horarios', 'ver'), getExcepciones);
router.post('/:cobradorId/excepciones',  requirePermission('horarios', 'editar'), crearExcepcion);
router.delete('/excepciones/:id',        requirePermission('horarios', 'editar'), eliminarExcepcion);

module.exports = router;
