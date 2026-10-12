const express = require('express');
const multer = require('multer');
const {
  getDashboardSummary,
  getEmpresas,
  getClientes,
  getCobranzas,
  registrarCobro,
  updateFechaVencimiento,
  asignarCobranza,
  getGestiones,
  getUsuarios,
  getCobradores,
  getAsignacionesCobrador,
  getRoles,
  generarComprobante,
  generarComprobanteA4,
} = require('../controllers/panelController');
const { getZonas, createZona, updateZona, deleteZona, autoAsignar, reasignarZona, getNoAsignadas, asignarClienteZona } = require('../controllers/zonasController');
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
const { createEmpresa, updateEmpresa, updateEstadoEmpresa, uploadLogoEmpresa } = require('../controllers/empresasController');
// const { anularReciboController, getRecibo, listarRecibos, generarNotaCreditoManual } = require('../controllers/recibosController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

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

router.get('/empresas', authenticateToken, requirePermission('empresas', 'ver'), getEmpresas);
router.post('/empresas', authenticateToken, requirePermission('empresas', 'crear'), createEmpresa);
router.patch('/empresas/:id/estado', authenticateToken, requirePermission('empresas', 'editar'), updateEstadoEmpresa);
router.put('/empresas/:id', authenticateToken, requirePermission('empresas', 'editar'), updateEmpresa);
router.patch('/empresas/:id/logo', authenticateToken, requirePermission('empresas', 'editar'), uploadEmpresaLogo, uploadLogoEmpresa);

// Rutas específicas de clientes ANTES de cualquier ruta con :id
router.get('/clientes/sin-ubicacion', authenticateToken, requirePermission('clientes', 'ver'), getClientesSinUbicacion);
router.get('/clientes/plantilla', descargarPlantilla);
router.post('/clientes/importar', authenticateToken, requirePermission('importar', 'crear'), upload.single('archivo'), importarClientes);
router.get('/clientes/importar/duplicados/:archivo', authenticateToken, requirePermission('importar', 'ver'), descargarDuplicados);
router.get('/clientes/lotes-importacion', authenticateToken, requirePermission('importar', 'ver'), getLotes);
router.delete('/clientes/lotes-importacion/:id', authenticateToken, requirePermission('importar', 'crear'), eliminarLote);
router.post('/clientes', authenticateToken, requirePermission('clientes', 'crear'), crearCliente);
router.put('/clientes/:id', authenticateToken, requirePermission('clientes', 'editar'), updateCliente);
router.patch('/clientes/:id/ubicacion', authenticateToken, requirePermission('clientes', 'editar'), updateUbicacionCliente);
router.get('/clientes', authenticateToken, requirePermission('clientes', 'ver'), getClientes);

router.get('/cobranzas', authenticateToken, requirePermission('cobranzas', 'ver'), getCobranzas);
// router.post('/cobranzas/manual', authenticateToken, requirePermission('cobranzas', 'crear'), crearCobranzaManual); // Pendiente de implementar
router.patch('/cobranzas/:id/cobrar', authenticateToken, requirePermission('cobranzas', 'crear'), registrarCobro);
router.patch('/cobranzas/:id/fecha', authenticateToken, requirePermission('cobranzas', 'editar'), updateFechaVencimiento);
router.post('/cobranzas/:id/asignar', authenticateToken, requirePermission('cobranzas', 'editar'), asignarCobranza);
router.get('/gestiones', authenticateToken, requirePermission('gestiones', 'ver'), getGestiones);
router.get('/gestiones/:id/comprobante', authenticateToken, requirePermission('gestiones', 'ver'), generarComprobante);
router.get('/gestiones/:id/comprobante-a4', authenticateToken, requirePermission('gestiones', 'ver'), generarComprobanteA4);

// Recibos de cobranza — listado, consulta, anulación manual y nota de crédito (DESACTIVADO)
// router.get('/recibos', authenticateToken, requirePermission('cobranzas', 'ver'), listarRecibos);
// router.get('/recibos/:id', authenticateToken, requirePermission('cobranzas', 'ver'), getRecibo);
// router.post('/recibos/:id/anular', authenticateToken, requirePermission('cobranzas', 'editar'), anularReciboController);
// router.post('/recibos/:id/nota-credito', authenticateToken, requirePermission('cobranzas', 'editar'), generarNotaCreditoManual);
router.get('/usuarios', authenticateToken, requirePermission('usuarios', 'ver'), getUsuarios);
router.get('/usuarios/cobradores', authenticateToken, requirePermission('usuarios', 'ver'), getCobradores);
router.get('/cobradores/:id/asignaciones', authenticateToken, requirePermission('cobranzas', 'ver'), getAsignacionesCobrador);
// Perfil propio — ANTES de :id para evitar conflicto de rutas
router.get('/usuarios/me', authenticateToken, getPropioUsuario);
router.put('/usuarios/me', authenticateToken, updatePropioUsuario);
router.get('/roles', authenticateToken, requirePermission('usuarios', 'ver'), getRoles);

router.get('/zonas', authenticateToken, requirePermission('zonas', 'ver'), getZonas);
router.get('/zonas/no-asignadas', authenticateToken, requirePermission('zonas', 'ver'), getNoAsignadas);
router.post('/zonas', authenticateToken, requirePermission('zonas', 'crear'), createZona);
router.put('/zonas/:id', authenticateToken, requirePermission('zonas', 'editar'), updateZona);
router.delete('/zonas/:id', authenticateToken, requirePermission('zonas', 'eliminar'), deleteZona);
router.post('/zonas/auto-asignar', authenticateToken, requirePermission('zonas', 'editar'), autoAsignar);
router.post('/zonas/asignar-cliente', authenticateToken, requirePermission('zonas', 'editar'), asignarClienteZona);
router.post('/zonas/:id/reasignar', authenticateToken, requirePermission('zonas', 'editar'), reasignarZona);
router.post('/usuarios', authenticateToken, requirePermission('usuarios', 'crear'), createUsuario);
router.put('/usuarios/:id', authenticateToken, requirePermission('usuarios', 'editar'), updateUsuario);
router.patch('/usuarios/:id/estado', authenticateToken, requirePermission('usuarios', 'editar'), updateEstadoUsuario);
router.post('/cambiar-password', authenticateToken, cambiarPassword);



// Mensajes — /no-leidos antes de /:usuarioId para evitar conflicto
router.get('/mensajes/no-leidos', authenticateToken, requirePermission('mensajes', 'ver'), getNoLeidos);
router.get('/mensajes', authenticateToken, requirePermission('mensajes', 'ver'), getConversaciones);
router.get('/mensajes/:usuarioId', authenticateToken, requirePermission('mensajes', 'ver'), getConversacion);
router.post('/mensajes', authenticateToken, requirePermission('mensajes', 'crear'), enviarMensaje);

module.exports = router;
