const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { getArqueos, getArqueoDetalle, confirmarRendicion } = require('../controllers/arqueosController');

const router = express.Router();
router.use(authenticateToken);

// Solo SUPERVISOR y ADMIN
const soloGestor = (req, res, next) => {
  if (req.user.rol === 'COBRADOR') {
    return res.status(403).json({ message: 'Sin permisos' });
  }
  return next();
};

router.get('/',                    soloGestor, getArqueos);
router.get('/:id',                 getArqueoDetalle);        // cobrador también puede ver el suyo
router.post('/:id/rendicion',      soloGestor, confirmarRendicion);

module.exports = router;
