const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const {
  getMisPermisos,
  getCatalogoPermisos,
  getPermisosUsuarioId,
  asignarPermisosUsuario,
} = require('../controllers/permisosController');

const router = express.Router();

// Permisos del usuario autenticado (cualquier rol autenticado)
router.get('/', authenticateToken, getMisPermisos);

// Catálogo de permisos (ADMIN y SUPERVISOR)
router.get('/catalogo', authenticateToken, requirePermission('usuarios', 'permisos'), getCatalogoPermisos);

// Permisos de un usuario específico (ADMIN y SUPERVISOR)
router.get('/usuario/:id', authenticateToken, requirePermission('usuarios', 'permisos'), getPermisosUsuarioId);

// Asignar permisos a un usuario (ADMIN y SUPERVISOR)
router.put('/usuario/:id', authenticateToken, requirePermission('usuarios', 'permisos'), asignarPermisosUsuario);

module.exports = router;
