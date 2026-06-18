const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getTipos,
  crearTipo,
  editarTipo,
  desactivarTipo,
  getReporteDescansos,
} = require('../controllers/descansosController');

const soloSupervisor = (req, res, next) => {
  if (!['SUPERVISOR', 'ADMIN'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'Acceso restringido a supervisores' });
  }
  return next();
};

const router = express.Router();

router.use(authenticateToken);

// Cualquier usuario autenticado puede ver los tipos de su empresa
router.get('/tipos',         getTipos);

// Solo supervisores/admins pueden crear/editar/desactivar
router.post('/tipos',        soloSupervisor, crearTipo);
router.put('/tipos/:id',     soloSupervisor, editarTipo);
router.delete('/tipos/:id',  soloSupervisor, desactivarTipo);

// Reporte de descansos (solo supervisores)
router.get('/reporte',       soloSupervisor, getReporteDescansos);

module.exports = router;
