const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getAgenda,
  getCuotasPendientesCredito,
  registrarCobro,
  registrarVisita,
  subirFotoVisita,
  getCobrosDelDia,
} = require('../controllers/cobradorController');
const { generarComprobante } = require('../controllers/panelController');
const {
  abrirCaja, getCajaActiva, cerrarCaja, registrarGasto,
} = require('../controllers/arqueosController');
const {
  iniciarDescanso,
  finalizarDescanso,
  getDescansoActivo,
} = require('../controllers/descansosController');

// ── Multer: almacenamiento en disco para fotos de evidencia ──
const uploadDir = path.join(__dirname, '../../uploads/evidencias');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const ts = Date.now();
    cb(null, `evidencia_${ts}${ext}`);
  },
});

const uploadFoto = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, png, webp)'), false);
    }
  },
});

// ── Middleware de autorización de rol ────────────────────────
const soloCobrador = (req, res, next) => {
  if (req.user.rol !== 'COBRADOR') {
    return res.status(403).json({ message: 'Acceso restringido a cobradores' });
  }
  return next();
};

const router = express.Router();

// Todas las rutas requieren autenticación y rol COBRADOR
router.use(authenticateToken, soloCobrador);

router.get('/agenda',              getAgenda);
router.get('/creditos/:creditoId/cuotas-pendientes', getCuotasPendientesCredito);
router.get('/cobros',              getCobrosDelDia);
router.post('/cobros',             registrarCobro);
router.get('/cobros/:id/comprobante', generarComprobante);
router.post('/visitas',            registrarVisita);
router.post('/visitas/:id/foto',   uploadFoto.single('foto'), subirFotoVisita);

// Caja diaria del cobrador
router.post('/caja/abrir',         abrirCaja);
router.get('/caja/activa',         getCajaActiva);
router.post('/caja/cerrar',        cerrarCaja);
router.post('/caja/:id/gastos',    registrarGasto);

// Descansos del cobrador
router.get('/descansos/activo',    getDescansoActivo);
router.post('/descansos/iniciar',  iniciarDescanso);
router.post('/descansos/finalizar', finalizarDescanso);

module.exports = router;
