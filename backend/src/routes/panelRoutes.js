const express = require('express');
const multer = require('multer');
const {
  getDashboardSummary,
  getEmpresas,
  getClientes,
  getCobranzas,
  registrarCobro,
  updateFechaVencimiento,
  getGestiones,
  getUsuarios,
  getCobradores,
  getRoles,
  generarComprobante,
} = require('../controllers/panelController');
const { getZonas, createZona, updateZona, deleteZona, autoAsignar } = require('../controllers/zonasController');
const { createUsuario, cambiarPassword, updateUsuario, updateEstadoUsuario, getPropioUsuario, updatePropioUsuario } = require('../controllers/usuariosController');
const { getConversaciones, getConversacion, enviarMensaje, getNoLeidos } = require('../controllers/mensajesController');
const {
  importarClientes,
  getClientesSinUbicacion,
  updateUbicacionCliente,
  descargarPlantilla,
  descargarDuplicados,
  crearCliente,
  updateCliente,
  getLotes,
  eliminarLote,
} = require('../controllers/clientesController');
const { createEmpresa, updateEstadoEmpresa } = require('../controllers/empresasController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
    }
  },
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpg, png, webp, etc.)'), false);
    }
  },
});

const uploadEmpresaLogo = (req, res, next) => {
  uploadImage.single('logo')(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'El logo supera el tamaño máximo permitido (2 MB)' });
    }

    return res.status(400).json({ message: error.message || 'No se pudo procesar la imagen' });
  });
};

const router = express.Router();

router.get('/dashboard/summary', authenticateToken, getDashboardSummary);

router.get('/empresas', authenticateToken, getEmpresas);
router.post('/empresas', authenticateToken, createEmpresa);
router.patch('/empresas/:id/estado', authenticateToken, updateEstadoEmpresa);
// router.put('/empresas/:id', authenticateToken, updateEmpresa);       // Pendiente de implementar
// router.patch('/empresas/:id/logo', authenticateToken, uploadEmpresaLogo, uploadLogoEmpresa); // Pendiente de implementar

// Rutas específicas de clientes ANTES de cualquier ruta con :id
router.get('/clientes/sin-ubicacion', authenticateToken, getClientesSinUbicacion);
router.get('/clientes/plantilla', descargarPlantilla);
router.post('/clientes/importar', authenticateToken, upload.single('archivo'), importarClientes);
router.get('/clientes/importar/duplicados/:archivo', authenticateToken, descargarDuplicados);
router.get('/clientes/lotes-importacion', authenticateToken, getLotes);
router.delete('/clientes/lotes-importacion/:id', authenticateToken, eliminarLote);
router.post('/clientes', authenticateToken, crearCliente);
router.put('/clientes/:id', authenticateToken, updateCliente);
router.patch('/clientes/:id/ubicacion', authenticateToken, updateUbicacionCliente);
router.get('/clientes', authenticateToken, getClientes);

router.get('/cobranzas', authenticateToken, getCobranzas);
// router.post('/cobranzas/manual', authenticateToken, crearCobranzaManual); // Pendiente de implementar
router.patch('/cobranzas/:id/cobrar', authenticateToken, registrarCobro);
router.patch('/cobranzas/:id/fecha', authenticateToken, updateFechaVencimiento);
// router.post('/cobranzas/:id/asignar', authenticateToken, asignarCobranza); // Pendiente de implementar
router.get('/gestiones', authenticateToken, getGestiones);
router.get('/gestiones/:id/comprobante', authenticateToken, generarComprobante);
router.get('/usuarios', authenticateToken, getUsuarios);
router.get('/usuarios/cobradores', authenticateToken, getCobradores);
// Perfil propio — ANTES de :id para evitar conflicto de rutas
router.get('/usuarios/me', authenticateToken, getPropioUsuario);
router.put('/usuarios/me', authenticateToken, updatePropioUsuario);
router.get('/roles', authenticateToken, getRoles);

router.get('/zonas', authenticateToken, getZonas);
router.post('/zonas', authenticateToken, createZona);
router.put('/zonas/:id', authenticateToken, updateZona);
router.delete('/zonas/:id', authenticateToken, deleteZona);
router.post('/zonas/auto-asignar', authenticateToken, autoAsignar);
router.post('/usuarios', authenticateToken, createUsuario);
router.put('/usuarios/:id', authenticateToken, updateUsuario);
router.patch('/usuarios/:id/estado', authenticateToken, updateEstadoUsuario);
router.post('/cambiar-password', authenticateToken, cambiarPassword);



// Mensajes — /no-leidos antes de /:usuarioId para evitar conflicto
router.get('/mensajes/no-leidos', authenticateToken, getNoLeidos);
router.get('/mensajes', authenticateToken, getConversaciones);
router.get('/mensajes/:usuarioId', authenticateToken, getConversacion);
router.post('/mensajes', authenticateToken, enviarMensaje);

module.exports = router;
