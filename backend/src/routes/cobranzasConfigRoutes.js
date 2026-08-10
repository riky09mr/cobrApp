const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
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

router.get('/timbrados', listTimbrados);
router.post('/timbrados', createTimbrado);
router.put('/timbrados/:id', updateTimbrado);

router.get('/establecimientos', listEstablecimientos);
router.post('/establecimientos', createEstablecimiento);
router.put('/establecimientos/:id', updateEstablecimiento);

router.get('/puntos-expedicion', listPuntosExpedicion);
router.post('/puntos-expedicion', createPuntoExpedicion);
router.put('/puntos-expedicion/:id', updatePuntoExpedicion);

router.get('/cajas', listCajas);
router.post('/cajas', createCaja);
router.put('/cajas/:id', updateCaja);

router.get('/numeradores', listNumeradores);
router.post('/numeradores', createNumerador);
router.put('/numeradores/:id', updateNumerador);

module.exports = router;