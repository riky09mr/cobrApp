const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Todas las rutas de reportes requieren autenticación
router.use(authenticateToken);

// ──────────────────────────────────────────────
// Reporte 1: Eficiencia de cobradores
// Controlador: reportesCobradorController.js
// Ruta:       GET /api/reportes/cobrador/eficiencia
// ──────────────────────────────────────────────
const { getEficiencia } = require('../controllers/reportesCobradorController');
router.get('/cobrador/eficiencia', requirePermission('reportes', 'ver'), getEficiencia);

// ──────────────────────────────────────────────
// Reporte 2: Cartera vencida por antigüedad
// Controlador: reportesCarteraController.js
// Ruta:       GET /api/reportes/cartera/vencida
// ──────────────────────────────────────────────
const { getCarteraVencida } = require('../controllers/reportesCarteraController');
router.get('/cartera/vencida', requirePermission('reportes', 'ver'), getCarteraVencida);

// ──────────────────────────────────────────────
// Reporte 3: Cobranza por período
// Controlador: reportesPeriodoController.js
// Ruta:       GET /api/reportes/periodo/cobranza
// ──────────────────────────────────────────────
const { getCobranzaPeriodo } = require('../controllers/reportesPeriodoController');
router.get('/periodo/cobranza', requirePermission('reportes', 'ver'), getCobranzaPeriodo);

// ──────────────────────────────────────────────
// Reporte 7: Morosidad por cliente
// Controlador: reportesClienteController.js
// Ruta:       GET /api/reportes/cliente/morosidad
// ──────────────────────────────────────────────
const { getMorosidadCliente } = require('../controllers/reportesClienteController');
router.get('/cliente/morosidad', requirePermission('reportes', 'ver'), getMorosidadCliente);

// ──────────────────────────────────────────────
// Reporte 8: Cobradores del día
// Controlador: reportesCobradorController.js
// Ruta:       GET /api/reportes/cobradores/dia
// ──────────────────────────────────────────────
const { getCobradoresDia } = require('../controllers/reportesCobradorController');
router.get('/cobradores/dia', requirePermission('reportes', 'ver'), getCobradoresDia);

// ──────────────────────────────────────────────
// Reporte 9: Ranking de cobradores
// Controlador: reportesCobradorController.js
// Ruta:       GET /api/reportes/cobrador/ranking
// ──────────────────────────────────────────────
const { getRankingCobradores } = require('../controllers/reportesCobradorController');
router.get('/cobrador/ranking', requirePermission('reportes', 'ver'), getRankingCobradores);

// ──────────────────────────────────────────────
// KPIs del marco teórico (Cárdenas, 2021)
// Controlador: reportesKpisController.js
// Rutas:       /api/reportes/kpis/*
// ──────────────────────────────────────────────
const {
  getRotacionCartera,
  getCoberturaCobro,
  getTasaReagendamiento,
  getCostoGestion,
  getKpisResumen,
} = require('../controllers/reportesKpisController');

router.get('/kpis/rotacion', requirePermission('reportes', 'ver'), getRotacionCartera);
router.get('/kpis/cobertura', requirePermission('reportes', 'ver'), getCoberturaCobro);
router.get('/kpis/reagendamiento', requirePermission('reportes', 'ver'), getTasaReagendamiento);
router.get('/kpis/costo', requirePermission('reportes', 'ver'), getCostoGestion);
router.get('/kpis/resumen', requirePermission('reportes', 'ver'), getKpisResumen);

module.exports = router;
