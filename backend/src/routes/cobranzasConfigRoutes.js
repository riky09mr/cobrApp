const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const {
  listTimbrados,
  createTimbrado,
  updateTimbrado,
  listEstablecimientos,
  createEstablecimiento,
  updateEstablecimiento,
  listPuntosExpedicion,
  createPuntoExpedicion,
  updatePuntoExpedicion,
  listCajas,
  createCaja,
  updateCaja,
  listNumeradores,
  createNumerador,
  updateNumerador,
} = require('../controllers/cobranzasConfigController');

const router = express.Router();

router.use(authenticateToken);

router.get('/timbrados', requirePermission('configuracion', 'ver'), listTimbrados);
router.post('/timbrados', requirePermission('configuracion', 'editar'), createTimbrado);
router.put('/timbrados/:id', requirePermission('configuracion', 'editar'), updateTimbrado);

router.get('/establecimientos', requirePermission('configuracion', 'ver'), listEstablecimientos);
router.post('/establecimientos', requirePermission('configuracion', 'editar'), createEstablecimiento);
router.put('/establecimientos/:id', requirePermission('configuracion', 'editar'), updateEstablecimiento);

router.get('/puntos-expedicion', requirePermission('configuracion', 'ver'), listPuntosExpedicion);
router.post('/puntos-expedicion', requirePermission('configuracion', 'editar'), createPuntoExpedicion);
router.put('/puntos-expedicion/:id', requirePermission('configuracion', 'editar'), updatePuntoExpedicion);

router.get('/cajas', requirePermission('configuracion', 'ver'), listCajas);
router.post('/cajas', requirePermission('configuracion', 'editar'), createCaja);
router.put('/cajas/:id', requirePermission('configuracion', 'editar'), updateCaja);

router.get('/numeradores', requirePermission('configuracion', 'ver'), listNumeradores);
router.post('/numeradores', requirePermission('configuracion', 'editar'), createNumerador);
router.put('/numeradores/:id', requirePermission('configuracion', 'editar'), updateNumerador);

module.exports = router;