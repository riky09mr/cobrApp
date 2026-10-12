const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const {
  getConfiguracion,
  updateConfiguracion,
  createFeriado,
  updateFeriado,
  deleteFeriado,
  recalcular,
} = require('../controllers/interesesConfigController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('configuracion', 'ver'), getConfiguracion);
router.put('/', requirePermission('configuracion', 'editar'), updateConfiguracion);

router.post('/feriados', requirePermission('configuracion', 'intereses'), createFeriado);
router.put('/feriados/:id', requirePermission('configuracion', 'intereses'), updateFeriado);
router.delete('/feriados/:id', requirePermission('configuracion', 'intereses'), deleteFeriado);

router.post('/recalcular', requirePermission('configuracion', 'intereses'), recalcular);

module.exports = router;
