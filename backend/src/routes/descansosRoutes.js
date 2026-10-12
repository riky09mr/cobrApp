const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const {
  getTipos,
  crearTipo,
  editarTipo,
  desactivarTipo,
  getReporteDescansos,
} = require('../controllers/descansosController');

const router = express.Router();

router.use(authenticateToken);

// Cualquier usuario autenticado puede ver los tipos de su empresa
router.get('/tipos',         requirePermission('descansos', 'ver'), getTipos);

// Solo con permiso de editar descansos
router.post('/tipos',        requirePermission('descansos', 'editar'), crearTipo);
router.put('/tipos/:id',     requirePermission('descansos', 'editar'), editarTipo);
router.delete('/tipos/:id',  requirePermission('descansos', 'editar'), desactivarTipo);

// Reporte de descansos
router.get('/reporte',       requirePermission('descansos', 'ver'), getReporteDescansos);

module.exports = router;
