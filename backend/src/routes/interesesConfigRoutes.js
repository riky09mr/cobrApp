const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
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

router.get('/', getConfiguracion);
router.put('/', updateConfiguracion);

router.post('/feriados', createFeriado);
router.put('/feriados/:id', updateFeriado);
router.delete('/feriados/:id', deleteFeriado);

router.post('/recalcular', recalcular);

module.exports = router;
