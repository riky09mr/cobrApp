const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getHorarios,
  guardarHorario,
  eliminarHorario,
  getExcepciones,
  crearExcepcion,
  eliminarExcepcion,
} = require('../controllers/horariosController');

const soloSupervisor = (req, res, next) => {
  if (!['SUPERVISOR', 'ADMIN'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'Acceso restringido a supervisores' });
  }
  return next();
};

const router = express.Router();

router.use(authenticateToken, soloSupervisor);

// Horario semanal
router.get('/:cobradorId',              getHorarios);
router.post('/',                         guardarHorario);
router.delete('/:id',                    eliminarHorario);

// Excepciones
router.get('/:cobradorId/excepciones',   getExcepciones);
router.post('/:cobradorId/excepciones',  crearExcepcion);
router.delete('/excepciones/:id',        eliminarExcepcion);

module.exports = router;
