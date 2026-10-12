const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const { getArqueos, getArqueoDetalle, confirmarRendicion } = require('../controllers/arqueosController');

const router = express.Router();
router.use(authenticateToken);

router.get('/',                    requirePermission('cobranzas', 'ver'), getArqueos);
router.get('/:id',                 requirePermission('cobranzas', 'ver'), getArqueoDetalle);
router.post('/:id/rendicion',      requirePermission('cobranzas', 'editar'), confirmarRendicion);

module.exports = router;
