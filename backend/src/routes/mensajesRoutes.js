const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const {
  getConversaciones,
  getConversacion,
  enviarMensaje,
  getNoLeidos,
} = require('../controllers/mensajesController');

// ── Multer: imágenes adjuntas en mensajes ──────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/mensajes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `msg_${Date.now()}${ext}`);
  },
});

const uploadImagen = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = express.Router();

router.use(authenticateToken);

router.get('/no-leidos',      requirePermission('mensajes', 'ver'), getNoLeidos);
router.get('/',               requirePermission('mensajes', 'ver'), getConversaciones);
router.get('/:usuarioId',     requirePermission('mensajes', 'ver'), getConversacion);
router.post('/',              requirePermission('mensajes', 'crear'), uploadImagen.single('imagen'), enviarMensaje);

module.exports = router;
