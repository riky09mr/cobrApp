# Análisis del Estado Actual — cobrApp
> Fecha de análisis: Mayo 2026  
> Autor: Rivaldo Andrés Zarate Samaniego  
> Sistema: Aplicación web y móvil para la gestión de cobranzas multiempresa

---

## 1. Estado General del Proyecto

El sistema **cobrApp** se encuentra en una etapa de desarrollo inicial-intermedia. Se ha establecido correctamente la base de la arquitectura (backend REST + frontend web), el sistema de autenticación y el control de acceso por roles. Sin embargo, los módulos funcionales principales —que son el núcleo del protocolo de investigación— aún están en estado de solo lectura o directamente sin implementar.

---

## 2. Lo que ya está implementado ✅

### 2.1 Backend (Node.js + Express + MySQL)

| Componente | Estado | Detalle |
|---|---|---|
| Servidor Express | ✅ Completo | Puerto 5000, CORS, Morgan, manejo global de errores |
| Conexión a base de datos | ✅ Completo | Pool MySQL2 con variables de entorno |
| Autenticación JWT | ✅ Completo | Login con token firmado, expiración 24h |
| Registro de empresa + admin | ✅ Completo | Crea empresa y usuario ADMIN en una sola operación |
| Middleware de autenticación | ✅ Completo | Verifica Bearer token en cada ruta protegida |
| Encriptación de contraseñas | ✅ Completo | bcrypt con 10 rounds |
| Sistema de roles | ✅ Completo | ADMIN, SUPERVISOR, COBRADOR con permisos diferenciados |
| Cambio obligatorio de contraseña | ✅ Completo | Flag `debe_cambiar_password`, validado en login |
| Contraseña temporal automática | ✅ Completo | Formato: `nombreEmpresa + año` |
| CRUD Usuarios | ✅ Completo | Crear, editar, con control de permisos por rol |
| Listado Empresas | ✅ Parcial | Solo GET, sin POST/PUT/DELETE |
| Listado Clientes | ✅ Parcial | Solo GET, sin POST/PUT/DELETE |
| Listado Cobranzas (cuotas) | ✅ Parcial | Solo GET, sin asignación ni registro de pagos |
| Dashboard summary | ✅ Básico | Conteos: empresas, clientes, usuarios, cuotas pendientes |

### 2.2 Frontend Web (Next.js + TypeScript + Tailwind CSS)

| Pantalla | Estado | Detalle |
|---|---|---|
| Página de inicio `/` | ✅ Completo | Presentación con links a login/register/dashboard |
| Login `/login` | ✅ Completo | Autenticación con redirección según flag de cambio de password |
| Registro `/register` | ✅ Completo | Registro de empresa y admin |
| Dashboard `/dashboard` | ✅ Básico | Tarjetas con métricas del sistema |
| Empresas `/empresas` | ✅ Parcial | Solo listado, sin formulario |
| Clientes `/clientes` | ✅ Parcial | Solo listado, sin formulario |
| Cobranzas `/cobranzas` | ✅ Parcial | Solo listado, sin asignación ni pagos |
| Usuarios `/usuarios` | ✅ Avanzado | Listado + formulario crear/editar con control de roles |
| Cambiar contraseña `/cambiar-password` | ✅ Completo | Formulario con validaciones |
| PanelShell (layout) | ✅ Completo | Sidebar, header, navegación activa, logout |
| Protección de rutas (`useAuth`) | ✅ Básico | Verifica token en localStorage |

### 2.3 Base de datos

| Tabla | Estado inferido |
|---|---|
| `empresas` | ✅ Existe |
| `usuarios` | ✅ Existe (con `debe_cambiar_password`) |
| `roles` | ✅ Existe |
| `clientes` | ✅ Existe |
| `creditos` | ✅ Existe (referenciada en consultas) |
| `cuotas` | ✅ Existe (con estados PENDIENTE/VENCIDA/PAGADA) |

---

## 3. Lo que falta implementar ❌

### 3.1 Módulos críticos (requeridos por el protocolo)

#### 3.1.1 Asignación de cobranzas a cobradores
- No existe endpoint `POST /api/asignaciones`
- No hay tabla `asignaciones` en la base de datos
- No hay pantalla de asignación en el panel web
- Sin esto, el cobrador no sabe qué cuotas debe cobrar
- **Impacto:** Alto — es la funcionalidad central del sistema

#### 3.1.2 Registro de gestiones en campo
- No existe tabla `gestiones` para historial de visitas/intentos de cobro
- El cobrador no puede registrar: observaciones, resultado de visita, adjuntar evidencia
- No hay endpoint para registrar una gestión
- **Impacto:** Alto — requerido explícitamente en el protocolo

#### 3.1.3 Registro de pagos
- No hay endpoint `POST /api/pagos` ni `PATCH /api/cuotas/:id/pagar`
- El estado de una cuota no puede ser actualizado desde el sistema
- No se puede registrar montos parciales (pagos a cuenta)
- **Impacto:** Alto — sin esto el sistema no tiene utilidad operativa real

#### 3.1.4 Módulo de geolocalización
- No hay integración con APIs de mapas (Google Maps, Leaflet, OpenStreetMap)
- No existe tabla `zonas` ni `coordenadas_cobrador`
- No hay rastreo ni historial de ubicaciones de cobradores
- No se pueden definir zonas de cobertura por cobrador
- **Impacto:** Medio-Alto — objetivo específico del protocolo

#### 3.1.5 Sistema de notificaciones automáticas
- No hay servicio de envío de alertas (email, push notifications, SMS)
- No hay job/cron para detectar cuotas vencidas o próximas a vencer
- No hay tabla `notificaciones` para registro de alertas enviadas
- **Impacto:** Medio — objetivo específico del protocolo

#### 3.1.6 Aplicación Móvil
- La carpeta `mobile/` está completamente vacía
- Es uno de los dos pilares principales del sistema (web + móvil)
- Tecnología no definida aún (React Native, Expo, Flutter, etc.)
- **Impacto:** Muy alto — objetivo principal del protocolo de investigación

### 3.2 Módulos operacionales faltantes

#### 3.2.1 CRUD completo de Clientes
- Falta: crear cliente, editar datos, activar/desactivar
- Falta: asociar cliente a empresa correctamente desde la UI
- Falta: endpoint `POST /api/clientes`, `PUT /api/clientes/:id`

#### 3.2.2 CRUD completo de Empresas
- Falta: crear empresa (desde el panel, no solo por registro)
- Falta: editar RUC, teléfono, dirección, email de empresa
- Falta: activar/desactivar empresa
- Falta: endpoints `POST /api/empresas`, `PUT /api/empresas/:id`

#### 3.2.3 Gestión de Créditos
- No hay pantalla ni endpoints para crear créditos
- No se puede definir: monto total, cantidad de cuotas, tasa de interés, fecha inicio
- Las cuotas existen en la BD pero no hay forma de generarlas desde el sistema
- Falta: `POST /api/creditos`, vista `/creditos`

#### 3.2.4 Módulo de Reportes
- No hay ningún reporte exportable
- No hay gráficas de rendimiento de cobradores
- No hay reporte de morosidad por empresa
- No hay reporte de cobranzas por periodo
- Herramientas sugeridas: Chart.js / Recharts (web), exportación a PDF/Excel

#### 3.2.5 Supervisión de cobradores
- No hay pantalla donde el supervisor vea el estado de sus cobradores
- No hay indicadores de desempeño por cobrador (cuotas asignadas vs cobradas)
- No hay historial de gestiones por cobrador

### 3.3 Seguridad y mejoras técnicas pendientes

| Problema | Descripción | Riesgo |
|---|---|---|
| **CORS abierto** | `app.use(cors())` sin restricciones | Alto en producción |
| **Token en localStorage** | Vulnerable a ataques XSS | Medio |
| **Sin refresh token** | El token expira y obliga a re-login sin aviso | Usabilidad |
| **`useAuth` incompleto** | Solo verifica existencia del token, no su validez real | Medio |
| **Sin rate limiting** | El endpoint de login no tiene límite de intentos | Alto (fuerza bruta) |
| **Sin validación de entrada** | Los endpoints no usan librerías como `express-validator` o `joi` | Medio |
| **Sin HTTPS configurado** | Solo funciona en HTTP local actualmente | Alto en producción |

---

## 4. Lo que debe mejorarse ⚠️

### 4.1 Backend

| Aspecto | Situación actual | Mejora necesaria |
|---|---|---|
| Paginación | `LIMIT 100` fijo en todos los endpoints | Implementar `?page=1&limit=20` |
| Filtros | Sin filtros en ningún listado | Añadir filtros por estado, empresa, fecha, rol |
| Búsqueda | Ninguna | Añadir parámetro `?search=nombre` |
| Migraciones DB | Un solo archivo `.sql` suelto | Sistema de migraciones versionado |
| Aislamiento multiempresa | Listados no filtran por `empresa_id` del usuario autenticado | SUPERVISOR/COBRADOR solo deben ver su empresa |
| Logs | Solo `morgan` (peticiones HTTP) | Añadir logs de errores y auditoría de acciones |

### 4.2 Frontend

| Aspecto | Situación actual | Mejora necesaria |
|---|---|---|
| Tablas | Listas `<ul>` simples | Tablas con ordenamiento, búsqueda y paginación |
| Formularios | Sin validación en tiempo real | Validación con React Hook Form + Zod |
| Estado global | Sin gestor de estado | Context API o Zustand para datos del usuario |
| Manejo de errores 401 | Código duplicado en cada página | Interceptor Axios centralizado |
| Responsive | Solo adaptado para desktop/tablet | Mejorar para móvil (aunque el panel es web) |
| Feedback visual | Mensajes de éxito/error básicos | Toasts/notificaciones tipo Sonner o react-hot-toast |
| Loading states | Texto "Cargando..." | Skeletons de carga |

---

## 5. Orden de prioridad recomendado

```
PRIORIDAD 1 — Core del sistema (sin esto no funciona el negocio)
├── CRUD completo: Empresas y Clientes
├── Gestión de Créditos (crear crédito → generar cuotas)
├── Registro de pagos (cambiar estado cuota a PAGADA)
└── Asignación de cobranzas a cobradores

PRIORIDAD 2 — Diferenciadores del sistema (requeridos por el protocolo)
├── Historial de gestiones / observaciones en campo
├── Módulo de supervisión de cobradores
└── Reportes básicos (tabla + exportación)

PRIORIDAD 3 — Plataforma móvil (objetivo principal del protocolo)
├── Definir tecnología (Expo/React Native recomendado)
├── Login + listado de asignaciones del cobrador
├── Registrar gestión/pago desde el móvil
└── Sincronización con el backend

PRIORIDAD 4 — Módulos avanzados
├── Notificaciones automáticas (cron + email/push)
├── Geolocalización y zonas de cobertura
└── Dashboard con gráficas avanzadas

PRIORIDAD 5 — Hardening para producción
├── CORS restrictivo
├── Rate limiting
├── Refresh tokens
├── HTTPS
└── Variables de entorno seguras
```

---

## 6. Estimación de módulos vs objetivos del protocolo

| Objetivo específico del protocolo | Estado actual |
|---|---|
| Aplicación móvil para cobradores | ❌ No iniciado |
| Automatizar asignación y seguimiento de cobranzas | ❌ No iniciado |
| Módulo de geolocalización y rutas | ❌ No iniciado |
| Alertas automáticas por vencimientos | ❌ No iniciado |
| Observaciones/comentarios por gestión | ❌ No iniciado |
| Control de acceso con roles diferenciados | ✅ Implementado |
| Gestión centralizada multiempresa | ⚠️ Parcial (solo lectura) |
| Reportes para toma de decisiones | ❌ No iniciado |

---

*Documento generado para guiar el desarrollo y la defensa del protocolo de investigación.*
