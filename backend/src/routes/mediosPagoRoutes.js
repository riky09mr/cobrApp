const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const { getMediosPago, crearMedioPago, actualizarMedioPago } = require('../controllers/mediosPagoController');

const router = express.Router();
router.use(authenticateToken);

router.get('/',     requirePermission('medios_pago', 'ver'), getMediosPago);
router.post('/',    requirePermission('medios_pago', 'crear'), crearMedioPago);
router.put('/:id',  requirePermission('medios_pago', 'editar'), actualizarMedioPago);

module.exports = router;
