const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { getMediosPago, crearMedioPago, actualizarMedioPago } = require('../controllers/mediosPagoController');

const router = express.Router();
router.use(authenticateToken);

// Solo SUPERVISOR y ADMIN pueden crear/editar
const soloGestor = (req, res, next) => {
  if (req.user.rol === 'COBRADOR') {
    return res.status(403).json({ message: 'Sin permisos' });
  }
  return next();
};

router.get('/',     getMediosPago);
router.post('/',    soloGestor, crearMedioPago);
router.put('/:id',  soloGestor, actualizarMedioPago);

module.exports = router;
