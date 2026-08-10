# Documentación Técnica — cobrApp
### Sistema de Gestión de Cobranzas Multiempresa

> **Versión:** 1.0  
> **Fecha:** Mayo 2026  
> **Autor:** Rivaldo Andrés Zarate Samaniego  
> **Institución:** Universidad Católica Nuestra Señora de la Asunción — Unidad Pedagógica Carapeguá  
> **Tutor:** Ing. Aldo Federico Ávalos

---

## Tabla de Contenidos

1. [Descripción General del Sistema](#1-descripción-general-del-sistema)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Tecnologías Utilizadas](#3-tecnologías-utilizadas)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Base de Datos](#5-base-de-datos)
6. [Backend — API REST](#6-backend--api-rest)
7. [Frontend Web](#7-frontend-web)
8. [Aplicación Móvil](#8-aplicación-móvil)
9. [Sistema de Autenticación y Autorización](#9-sistema-de-autenticación-y-autorización)
10. [Módulos del Sistema](#10-módulos-del-sistema)
11. [Variables de Entorno](#11-variables-de-entorno)
12. [Flujos Principales del Sistema](#12-flujos-principales-del-sistema)
13. [Seguridad](#13-seguridad)
14. [Guía de Instalación y Ejecución](#14-guía-de-instalación-y-ejecución)

---

## 1. Descripción General del Sistema

**cobrApp** es un sistema informático compuesto por una plataforma web administrativa y una aplicación móvil para cobradores, diseñado para gestionar de forma centralizada los procesos de cobranza de múltiples empresas que otorgan créditos o venden productos a plazos.

### 1.1 Problema que resuelve

Muchas empresas que operan con créditos o ventas a plazos gestionan sus cobranzas de forma manual o con herramientas poco integradas (planillas, cuadernos, aplicaciones genéricas). Esto genera:

- Falta de visibilidad en tiempo real sobre el estado de las cobranzas.
- Duplicación de tareas y cobranzas en vano por falta de asignación clara.
- Imposibilidad de supervisar el trabajo del cobrador en campo.
- Pérdida de datos y errores por registros manuales.
- Demoras en la toma de decisiones por ausencia de reportes actualizados.

### 1.2 Solución propuesta

cobrApp centraliza toda la operación de cobranza en una única plataforma que permite:

- Administrar múltiples empresas desde un solo sistema (arquitectura multiempresa).
- Asignar cuotas y créditos a cobradores específicos.
- Registrar gestiones, observaciones y pagos desde una app móvil.
- Supervisar el desempeño de los cobradores en tiempo real.
- Generar reportes y alertas automáticas por vencimientos.
- Organizar zonas de cobertura mediante geolocalización.

### 1.3 Usuarios del sistema

| Rol | Descripción |
|---|---|
| **ADMIN** | Administrador de la empresa. Gestiona todo el sistema: usuarios, clientes, créditos, reportes. Puede ver y administrar todas las empresas. |
| **SUPERVISOR** | Supervisa a los cobradores de su empresa. Asigna cobranzas, ve el estado de gestiones y el desempeño del equipo. Solo accede a datos de su empresa. |
| **COBRADOR** | Opera desde la aplicación móvil en campo. Visualiza sus asignaciones, registra gestiones, cobros y observaciones. Solo ve sus propias asignaciones. |

---

## 2. Arquitectura del Sistema

cobrApp sigue una arquitectura de **cliente-servidor en tres capas**, con separación clara entre frontend, backend y base de datos.

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTES                              │
│                                                          │
│   ┌──────────────────┐    ┌──────────────────────────┐  │
│   │  Panel Web       │    │  Aplicación Móvil        │  │
│   │  (Next.js)       │    │  (React Native / Expo)   │  │
│   │  Administradores │    │  Cobradores en campo     │  │
│   │  Supervisores    │    │                          │  │
│   └────────┬─────────┘    └────────────┬─────────────┘  │
│            │ HTTPS / REST              │ HTTPS / REST   │
└────────────┼───────────────────────────┼────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND — API REST                      │
│                  Node.js + Express.js                    │
│                                                          │
│   ┌──────────────────────────────────────────────────┐   │
│   │  Auth Module (JWT + bcrypt)                      │   │
│   │  Panel Module (CRUD + Reportes)                  │   │
│   │  Cobranzas V12 (dominio): Caja, Recibos,         │   │
│   │    Numeradores, Intereses, Feriados (Computus)   │   │
│   │  Cron: descansos (14:30) · feriados anuales      │   │
│   │    (1° enero · zona America/Asuncion)            │   │
│   └──────────────────────────────────────────────────┘   │
│                                                          │
│   Middleware: authenticateToken + control de rol por     │
│   ruta (soloGestor / soloCobrador en cada router)        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              BASE DE DATOS — MySQL                       │
│                                                          │
│   empresas → usuarios → roles                           │
│   clientes → clientes_empresas → creditos → cuotas      │
│   asignaciones → visitas_cobro (gestión en campo)      │
│   zonas → clientes_empresas (latitud/longitud)          │
│   módulos V12: caja_aperturas, recibos, caja_movimientos│
└─────────────────────────────────────────────────────────┘
```

### 2.1 Patrón arquitectónico

El backend implementa una **API REST por capas simplificada**, combinando dos patrones
de Martin Fowler (en *Patterns of Enterprise Application Architecture*):

- **Transaction Script** como patrón dominante: la mayor parte de los módulos
  (autenticación, empresas, clientes, usuarios, zonas, mensajes, reportes) organiza
  la lógica de negocio en **controladores con acceso directo a datos**, donde cada
  operación del sistema se implementa como un *script*: el controlador recibe la
  petición, ejecuta las consultas SQL parametrizadas sobre el pool de MySQL2 y
  devuelve el resultado. Esta elección es apropiada para la complejidad actual del
  dominio: operaciones mayoritariamente CRUD con reglas de negocio simples, donde
  un modelo de dominio completo (Domain Model) añadiría fricción sin beneficio.
- **Service Layer parcial** para el módulo de cobranzas (V12): las reglas de negocio
  complejas (apertura/cierre de caja, generación de recibos con numeradores,
  cálculo de intereses por mora, feriados anuales con algoritmo de Computus) están
  encapsuladas en una capa de servicios de dominio dentro de `services/cobranzas/`,
  reutilizable por los controladores de panel, cobrador y configuración.

La estructura por capas es:

- **Controladores** (`controllers/`): orquestan la petición HTTP, validan la entrada
  y ejecutan consultas parametrizadas directas (Transaction Script) o delegan en la
  capa de servicios (módulo cobranzas).
- **Servicios de dominio** (`services/cobranzas/`): encapsulan las reglas de negocio
  del módulo de cobranzas V12 (caja, recibos, numeradores, intereses, feriados).
- **Rutas** (`routes/`): mapean URLs a controladores y aplican los middlewares de
  autenticación y de control de rol.
- **Middlewares** (`middlewares/` + helpers por ruta): `authenticateToken` para
  validar el JWT y control de rol por ruta (`soloGestor` / `soloCobrador`).

> **Nota sobre `models/`:** el directorio `backend/src/models/` existe pero no se
> utiliza. En lugar de un modelo de dominio, el acceso a datos se realiza mediante
> el pool de conexiones de MySQL2 directamente desde los controladores, en línea
> con el patrón Transaction Script descrito arriba.

### 2.2 Comunicación entre capas

- **Frontend ↔ Backend:** HTTP/HTTPS mediante peticiones REST con formato JSON.
- **Autenticación:** Token JWT enviado en el header `Authorization: Bearer <token>`.
- **Backend ↔ Base de datos:** Pool de conexiones MySQL2 con consultas parametrizadas.

---

## 3. Tecnologías Utilizadas

### 3.1 Backend

| Tecnología | Versión | Uso |
|---|---|---|
| **Node.js** | 18+ | Runtime de JavaScript en el servidor |
| **Express.js** | 5.x (5.2.1) | Framework para construir la API REST |
| **MySQL2** | 3.x (3.15.3) | Driver para conectar con MySQL usando Promises |
| **bcryptjs** | 3.x (3.0.2) | Encriptación de contraseñas con salt rounds |
| **jsonwebtoken** | 9.x (9.0.2) | Generación y verificación de tokens JWT |
| **dotenv** | 17.x (17.3.1) | Manejo de variables de entorno desde `.env` |
| **cors** | 2.x | Middleware para habilitar Cross-Origin Resource Sharing |
| **morgan** | 1.x | Logger de peticiones HTTP en desarrollo |
| **multer** | 2.x | Middleware para recibir archivos subidos (`multipart/form-data`) |
| **xlsx** | 0.18.x | Lectura y escritura de archivos Excel (.xlsx) |
| **node-cron** | 4.x | Tareas programadas: activación automática de descansos (14:30) y sincronización anual de feriados (1° de enero), zona `America/Asuncion` |
| **pdfkit** | 0.18.x | Generación de documentos PDF (recibos y comprobantes) |

### 3.2 Frontend Web

| Tecnología | Versión | Uso |
|---|---|---|
| **Next.js** | 15.x | Framework React con App Router, SSR y optimizaciones |
| **React** | 19.x | Biblioteca para construir interfaces de usuario |
| **TypeScript** | 5.x | Tipado estático para mayor robustez del código |
| **Tailwind CSS** | 4.x | Framework de utilidades CSS para el diseño |
| **Axios** | 1.x | Cliente HTTP para consumir la API REST |
| **sonner** | 2.x | Librería de notificaciones toast (alertas emergentes) |
| **leaflet** | 1.9.x | Librería de mapas interactivos (base) |
| **react-leaflet** | 5.x | Componentes React para Leaflet (mapa de visitas) |

### 3.3 Base de datos

| Tecnología | Uso |
|---|---|
| **MySQL 8.x** | Sistema de gestión de base de datos relacional |
| **Laragon** | Entorno de desarrollo local (Windows) |

### 3.4 Aplicación Móvil

| Tecnología | Uso |
|---|---|
| **React Native + Expo** | Framework para apps iOS y Android con código compartido |
| **Expo Location** | Acceso al GPS del dispositivo |
| **Expo Notifications** | Push notifications en dispositivos móviles |
| **AsyncStorage** | Almacenamiento local en el dispositivo móvil |
| **react-native-maps** | Mapa nativo con marcadores y polilíneas de ruta |

### 3.5 Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| **VS Code** | Editor de código principal |
| **Git** | Control de versiones |
| **DBeaver / phpMyAdmin** | Administración visual de la base de datos |
| **Postman / Thunder Client** | Prueba de endpoints de la API |

---

## 4. Estructura del Proyecto

```
cobrApp/
├── backend/                    # API REST (Node.js + Express)
│   ├── .env                    # Variables de entorno (NO subir a Git)
│   ├── package.json
│   ├── scripts/                # Scripts de aplicación de migraciones y backfills
│   │   ├── applyMigrationV6.js
│   │   ├── applyMigrationV12.js
│   │   ├── applyMigrationV13.js
│   │   ├── applyMigrationV14.js
│   │   ├── applyMigrationV15.js
│   │   ├── backfillCobranzasV12.js
│   │   └── fixFeriadosFijos.js
│   └── src/
│       ├── app.js              # Punto de entrada del servidor (monta rutas y crons)
│       ├── config/
│       │   └── db.js           # Configuración del pool de MySQL
│       ├── controllers/        # Lógica de negocio (Transaction Script)
│       │   ├── authController.js
│       │   ├── clientesController.js   # CRUD + importación Excel
│       │   ├── cobradorController.js   # Agenda, visitas y gestiones (móvil)
│       │   ├── descansosController.js  # Gestión de descansos de cobradores
│       │   ├── horariosController.js   # Horarios laborales
│       │   ├── mensajesController.js   # Chat interno
│       │   ├── panelController.js      # Dashboard, cobranzas y PDFs (pdfkit)
│       │   ├── usuariosController.js   # ABM de usuarios
│       │   ├── zonasController.js      # Zonas geográficas
│       │   ├── empresasController.js   # ABM de empresas
│       │   ├── arqueosController.js    # Arqueos y rendiciones de caja
│       │   ├── mediosPagoController.js # Medios de pago (efectivo, transferencia…)
│       │   ├── cobranzasConfigController.js  # Timbrados, cajas, numeradores (V12)
│       │   ├── interesesConfigController.js  # Configuración de intereses por mora
│       │   ├── reportesCarteraController.js  # Reporte de cartera vencida
│       │   ├── reportesCobradorController.js # Reporte de eficiencia de cobradores
│       │   ├── reportesPeriodoController.js  # Reporte de cobranza por período
│       │   └── reportesKpisController.js     # 6 KPIs del marco teórico (morosidad,
│       │                                     #  efectividad, rotación, cobertura,
│       │                                     #  costo por gestión, reagendamiento)
│       ├── middlewares/
│       │   └── authMiddleware.js       # Verificación de JWT (authenticateToken)
│       ├── models/             # (Directorio vacío — no utilizado; el acceso a
│       │                       #  datos se hace directo desde los controladores)
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── cobradorRoutes.js       # Rutas exclusivas de la app móvil
│       │   ├── descansosRoutes.js
│       │   ├── horariosRoutes.js       # Montadas en /api/supervisor/horarios
│       │   ├── panelRoutes.js          # Rutas del panel web
│       │   ├── arqueosRoutes.js        # /api/arqueos
│       │   ├── mediosPagoRoutes.js     # /api/medios-pago
│       │   ├── mensajesRoutes.js       # /api/mensajes
│       │   ├── cobranzasConfigRoutes.js# /api/configuracion/cobranzas
│       │   ├── interesesConfigRoutes.js# /api/configuracion/intereses
│       │   └── reportesRoutes.js       # /api/reportes
│       ├── services/
│       │   ├── descansoCron.js         # Cron: activación automática de descansos
│       │   └── cobranzas/              # Service Layer del módulo de cobranzas (V12)
│       │       ├── cajaService.js          # Apertura/cierre de caja
│       │       ├── cajaLifecycleService.js # Ciclo de vida de la caja del cobrador
│       │       ├── reciboService.js        # Generación de recibos
│       │       ├── numeradorService.js     # Numeradores secuenciales por empresa
│       │       ├── interesService.js       # Cálculo de intereses por mora
│       │       ├── feriadosAnualService.js # Sincronización anual de feriados
│       │       ├── computus.js             # Algoritmo de Computus (Pascua)
│       │       ├── schemaSupport.js        # Utilidades de esquema
│       │       ├── serviceError.js         # Errores tipados del servicio
│       │       └── time.js                 # Utilidades de fecha/hora
│       └── uploads/
│           ├── evidencias/             # Fotos de comprobantes subidas desde móvil
│           └── mensajes/               # Imágenes adjuntas del chat interno
│
├── web/                        # Panel administrativo (Next.js)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── src/
│       ├── app/                # App Router de Next.js
│       │   ├── layout.tsx      # Layout raíz
│       │   ├── page.tsx        # Página de inicio "/"
│       │   ├── globals.css
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   ├── dashboard/page.tsx
│       │   ├── empresas/page.tsx
│       │   ├── clientes/page.tsx
│       │   ├── cobranzas/page.tsx
│       │   ├── gestiones/page.tsx
│       │   ├── horarios/page.tsx
│       │   ├── descansos/page.tsx
│       │   ├── zonas/page.tsx
│       │   ├── mapa/page.tsx           # Mapa de visitas georreferenciadas
│       │   ├── mensajes/page.tsx       # Chat interno
│       │   ├── importar/page.tsx       # Importación masiva desde Excel
│       │   ├── usuarios/page.tsx
│       │   ├── perfil/page.tsx
│       │   ├── cambiar-password/page.tsx
│       │   ├── facturas/page.tsx       # Facturas y timbrado (configuración)
│       │   ├── medios-pago/page.tsx    # Medios de pago
│       │   ├── configuracion-cobranzas/page.tsx  # Timbrados, cajas, numeradores
│       │   ├── configuracion-intereses/page.tsx  # Intereses por mora
│       │   └── reportes/               # Reportes del panel
│       │       ├── cobrador/page.tsx   # Eficiencia de cobradores
│       │       ├── cartera/page.tsx    # Cartera vencida
│       │       └── periodo/page.tsx    # Cobranza por período
│       ├── components/
│       │   ├── PanelShell.tsx          # Layout del panel (sidebar + header)
│       │   ├── MapaVisitas.tsx         # Mapa Leaflet de gestiones
│       │   └── MapPolygonPicker.tsx    # Selector de polígono para zonas
│       ├── hooks/
│       │   ├── useAuth.ts              # Hook de protección de rutas
│       │   └── useInactivityLogout.ts  # Cierre de sesión por inactividad (60 min)
│       ├── layouts/            # (Directorio vacío — reservado)
│       └── services/
│           └── api.ts          # Instancia Axios + tipos + funciones API
│
├── mobile/                     # App móvil (React Native + Expo)
│   ├── App.tsx                 # Punto de entrada y stack de navegación
│   ├── app.json
│   ├── package.json
│   └── src/
│       ├── api/
│       │   ├── client.ts           # Instancia Axios para el móvil
│       │   ├── cobradorApi.ts      # Agenda, visitas, gestiones
│       │   ├── descansosApi.ts     # Descansos
│       │   └── mensajesApi.ts      # Chat interno
│       ├── context/
│       │   ├── AuthContext.tsx     # Contexto de autenticación global
│       │   └── MensajesContext.tsx # Contexto global del chat (no leídos, refresco)
│       ├── screens/
│       │   ├── LoginScreen.tsx
│       │   ├── AgendaScreen.tsx    # Lista de visitas del día
│       │   ├── MapaRutaScreen.tsx  # Mapa con ruta TSP optimizada
│       │   ├── VisitaScreen.tsx    # Registro de gestión con GPS y foto
│       │   ├── CajaScreen.tsx      # Apertura/cierre de caja, arqueo y gastos
│       │   ├── MensajesScreen.tsx  # Chat con supervisores
│       │   ├── DescansoScreen.tsx  # Solicitud y estado de descansos
│       │   └── PerfilScreen.tsx    # Perfil del cobrador
│       └── utils/
│           ├── tsp.ts              # Algoritmo Nearest Neighbor TSP
│           └── notifications.ts   # Configuración de push notifications
│
├── database/                   # Scripts SQL de migración
│   ├── agregar_campo_debe_cambiar_password.sql
│   ├── migracion_v2.sql
│   ├── migracion_v3_clientes_global.sql
│   ├── migracion_v4_cobrador.sql
│   ├── migracion_v5_descansos.sql
│   ├── migracion_v6_horarios.sql
│   ├── migracion_v7_mensajes.sql
│   ├── migracion_v8_mensajes_imagen.sql
│   ├── migracion_v9_facturas_config.sql
│   ├── migracion_v10_anulaciones.sql
│   ├── migracion_v10_empresa_logo.sql
│   ├── migracion_v11_arqueos_caja.sql
│   ├── migracion_v12_cobranzas_erp_multientidad.sql
│   ├── migracion_v13_intereses_config_empresa.sql
│   ├── migracion_v14_feriados_origen.sql
│   └── migracion_v15_feriados_anuales.sql
│
├── ANALISIS_ESTADO_SISTEMA.md
├── DOCUMENTACION_TECNICA.md
├── MARCO_TEORICO_TESIS.md
├── MODULO_USUARIOS_README.md
├── REDISENO_MODULO_COBRANZAS_V12.md
├── SETUP.md
├── esquema_bd.sql              # Esquema de referencia (vacío / en construcción)
├── cobraapp.png                # Imagen de marca
├── login-bg.png                # Imagen de fondo del login
├── ej/                         # Ejemplos y pruebas locales
├── funcionamiento/             # Documentación de funcionamiento
├── protocolo/                  # Documentación del protocolo de investigación
├── reporte/                    # Documentación del reporte de tesis
└── Protocolo_Rivaldo_Zarate (1).docx
```

---

## 5. Base de Datos

### 5.1 Motor y configuración

- **Motor:** MySQL 8.x
- **Nombre de la base de datos:** `cobrApp`
- **Charset:** `utf8mb4` (soporte completo para caracteres especiales)
- **Collation:** `utf8mb4_unicode_ci`

### 5.2 Diagrama entidad-relación (tablas principales)

```
empresas (1) ──────── (N) usuarios
empresas (1) ──────── (N) clientes_empresas ──── (N) clientes [global]
empresas (1) ──────── (N) zonas
zonas    (1) ──────── (N) clientes_empresas
usuarios (N) ──────── (1) roles
clientes (1) ──────── (N) creditos
creditos (1) ──────── (N) cuotas
cuotas   (1) ──────── (N) asignaciones ──── (N) usuarios (cobrador)
asignaciones (1) ──── (N) visitas_cobro ──── (N) usuarios (cobrador)
empresas (1) ──────── (N) tipos_descanso
tipos_descanso (1) ── (N) descansos_cobrador ──── (N) usuarios (cobrador)
usuarios (1) ──────── (N) horarios_cobrador
usuarios (N) ──────── (N) mensajes [emisor / receptor]
empresas (1) ──────── (1) empresas_intereses_config
empresas (1) ──────── (N) empresas_feriados
creditos (1) ──────── (N) cuotas [interes_acumulado, dias_retraso]

-- Módulo V11 – Arqueos de caja y medios de pago
empresas (1) ──────── (N) medios_pago
empresas (1) ──────── (N) arqueos_caja ──────── (N) usuarios (cobrador)
arqueos_caja (1) ──── (N) movimientos_caja
arqueos_caja (1) ──── (1) rendiciones ──────── (N) usuarios (supervisor)
visitas_cobro (N) ──── (1) arqueos_caja
visitas_cobro (N) ──── (1) medios_pago

-- Módulo V12 – Rediseño ERP de cobranzas multientidad
empresas (1) ──────── (N) timbrados
timbrados (1) ──────── (N) establecimientos
establecimientos (1) ── (N) puntos_expedicion
puntos_expedicion (1) ─ (N) cajas
cajas (1) ──────────── (N) caja_cambios
cajas (1) ──────────── (N) caja_aperturas ──── (N) usuarios (cobrador)
puntos_expedicion (1) ─ (N) numeradores
cajas (1) ──────────── (N) recibos ──────────── (N) clientes
recibos (1) ────────── (1) visitas_cobro
recibos (1) ────────── (N) recibo_detalles ──── (N) cuotas
cajas (1) ──────────── (N) caja_movimientos
cajas (1) ──────────── (N) arqueos
cajas (1) ──────────── (N) cierres_caja
caja_aperturas (1) ─── (1) cierres_caja
auditoria [transversal: empresa_id, usuario_id, tabla_afectada]
```

### 5.3 Descripción de tablas

#### `empresas`
Almacena las empresas clientes del sistema multiempresa.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `razon_social` | VARCHAR(200) NOT NULL | Nombre legal de la empresa |
| `ruc` | VARCHAR(20) | RUC o número de identificación fiscal |
| `telefono` | VARCHAR(20) | Teléfono de contacto |
| `email` | VARCHAR(150) | Email de la empresa |
| `direccion` | VARCHAR(300) | Dirección física |
| `estado` | TINYINT(1) DEFAULT 1 | 1 = activa, 0 = inactiva |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de registro |

#### `roles`
Define los tipos de usuario disponibles en el sistema.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `nombre` | VARCHAR(50) UNIQUE | ADMIN, SUPERVISOR, COBRADOR |
| `descripcion` | VARCHAR(200) | Descripción del rol |

#### `usuarios`
Almacena todos los usuarios del sistema (admins, supervisores y cobradores).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `empresa_id` | INT FK | Empresa a la que pertenece |
| `rol_id` | INT FK | Rol asignado |
| `nombre` | VARCHAR(100) NOT NULL | Nombre del usuario |
| `apellido` | VARCHAR(100) NOT NULL | Apellido del usuario |
| `cedula` | VARCHAR(20) | Número de cédula de identidad |
| `email` | VARCHAR(150) UNIQUE NOT NULL | Correo electrónico (login) |
| `telefono` | VARCHAR(20) | Teléfono de contacto |
| `password` | VARCHAR(255) NOT NULL | Contraseña encriptada con bcrypt |
| `debe_cambiar_password` | TINYINT(1) DEFAULT 0 | 1 = debe cambiar al próximo login |
| `estado` | TINYINT(1) DEFAULT 1 | 1 = activo, 0 = inactivo |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de registro |

#### `clientes`
Tabla global de personas deudoras. Un cliente (identificado por cédula/RUC) existe una sola vez en el sistema, independientemente de cuántas empresas lo tengan. La relación con cada empresa se gestiona en `clientes_empresas`.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `cedula` | VARCHAR(20) UNIQUE NOT NULL | CI o RUC — identificador único global del cliente |
| `nombre` | VARCHAR(100) NOT NULL | Nombre del cliente |
| `apellido` | VARCHAR(100) | Apellido del cliente |
| `telefono` | VARCHAR(20) | Teléfono de contacto |
| `email` | VARCHAR(150) | Email del cliente |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de registro |
| `updated_at` | DATETIME | Última actualización |

#### `clientes_empresas`
Tabla pivot que relaciona un cliente global con una empresa específica. Contiene los datos propios de esa relación: dirección, coordenadas GPS y zona.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `cliente_id` | INT FK | Referencia a `clientes.id` |
| `empresa_id` | BIGINT FK | Referencia a `empresas.id` |
| `direccion` | VARCHAR(255) | Dirección del cliente para esta empresa |
| `latitud` | DECIMAL(10,8) | Coordenada GPS latitud |
| `longitud` | DECIMAL(11,8) | Coordenada GPS longitud |
| `zona_id` | BIGINT FK | Zona geográfica asignada |
| `estado` | TINYINT(1) DEFAULT 1 | 1 = activo, 0 = inactivo |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de registro |

#### `creditos`
Representa un crédito otorgado a un cliente.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `cliente_id` | INT FK | Cliente al que se le otorgó el crédito |
| `empresa_id` | INT FK | Empresa que otorgó el crédito |
| `numero_credito` | VARCHAR(100) | Código o número de referencia del crédito |
| `monto_total` | DECIMAL(12,2) NOT NULL | Monto total del crédito |
| `cantidad_cuotas` | INT NOT NULL | Número de cuotas |
| `tasa_interes` | DECIMAL(5,2) DEFAULT 0 | Tasa de interés en porcentaje |
| `periodicidad` | ENUM('SEMANAL','QUINCENAL','MENSUAL') | Frecuencia de pago |
| `fecha_inicio` | DATE NOT NULL | Fecha de inicio del crédito |
| `estado` | ENUM('ACTIVO','CANCELADO','MORA') DEFAULT 'ACTIVO' | Estado del crédito |
| `observaciones` | TEXT | Notas adicionales |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de registro |

#### `cuotas`
Cada una de las cuotas que componen un crédito.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `credito_id` | INT FK | Crédito al que pertenece |
| `numero_cuota` | INT NOT NULL | Número de orden de la cuota |
| `fecha_vencimiento` | DATE NOT NULL | Fecha límite de pago |
| `monto_cuota` | DECIMAL(12,2) NOT NULL | Monto original de la cuota |
| `saldo_cuota` | DECIMAL(12,2) NOT NULL | Saldo pendiente |
| `estado` | ENUM('PENDIENTE','VENCIDA','PAGADA','PARCIAL') DEFAULT 'PENDIENTE' | Estado de la cuota |
| `fecha_pago` | DATE | Fecha real en que fue pagada |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de creación |

#### `asignaciones`
Relaciona una cuota con el cobrador responsable de cobrarla.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `cuota_id` | INT FK | Cuota asignada |
| `cobrador_id` | INT FK | Usuario cobrador asignado |
| `supervisor_id` | INT FK | Supervisor que realizó la asignación |
| `fecha_asignacion` | DATETIME DEFAULT NOW() | Fecha de asignación |
| `fecha_limite` | DATE | Fecha límite para completar la cobranza |
| `estado` | ENUM('PENDIENTE','EN_GESTION','COBRADA','NO_COBRADA') DEFAULT 'PENDIENTE' | Estado de la asignación |

#### `visitas_cobro`
Registro de cada visita que el cobrador realiza a un cliente en campo. Es la tabla central del módulo móvil.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | Identificador único |
| `asignacion_id` | BIGINT FK | Asignación a la que corresponde la visita |
| `cobrador_id` | BIGINT FK | Cobrador que realizó la visita |
| `resultado` | ENUM('cobrado','ausente','reagendado') NOT NULL | Resultado de la visita |
| `monto_cobrado` | DECIMAL(12,2) | Monto cobrado (solo para `cobrado`) |
| `medio_pago` | VARCHAR(50) | Efectivo, transferencia, etc. |
| `comentario` | TEXT | Observación libre del cobrador |
| `foto_path` | VARCHAR(500) | Ruta relativa de la foto de comprobante |
| `latitud` | DECIMAL(10,8) | Coordenada GPS latitud |
| `longitud` | DECIMAL(11,8) | Coordenada GPS longitud |
| `nueva_hora` | TIME | Hora reprogramada (solo para `reagendado`) |
| `fecha_hora` | DATETIME DEFAULT NOW() | Fecha y hora de la visita |

#### `tipos_descanso`
Define los tipos de descanso disponibles para una empresa (ej: Almuerzo, Sanitario, Combustible). Los configura el supervisor.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | Identificador único |
| `empresa_id` | BIGINT FK | Empresa que lo configuró |
| `nombre` | VARCHAR(100) NOT NULL | Nombre del tipo de descanso |
| `es_obligatorio` | TINYINT(1) DEFAULT 0 | 1 = el sistema puede activarlo automáticamente |
| `hora_inicio` | TIME | Desde cuándo puede activarse |
| `hora_fin_auto` | TIME | Se activa automáticamente a esta hora si no fue iniciado |
| `activo` | TINYINT(1) DEFAULT 1 | 1 = disponible |

#### `descansos_cobrador`
Historial de descansos tomados por los cobradores durante su jornada.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | Identificador único |
| `tipo_descanso_id` | BIGINT FK | Tipo de descanso tomado |
| `cobrador_id` | BIGINT FK | Cobrador que tomó el descanso |
| `fecha` | DATE NOT NULL | Fecha del descanso |
| `hora_inicio_real` | DATETIME NOT NULL | Inicio del descanso |
| `hora_fin_real` | DATETIME | Fin del descanso (NULL = aún activo) |
| `duracion_minutos` | INT | Duración calculada al finalizar |
| `activado_auto` | TINYINT(1) DEFAULT 0 | 1 = activado por el cron del sistema |
| `comentario` | VARCHAR(255) | Observación opcional |

#### `horarios_cobrador`
Horario laboral semanal de cada cobrador, definido por el supervisor.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | Identificador único |
| `cobrador_id` | BIGINT FK | Cobrador al que aplica el horario |
| `empresa_id` | BIGINT FK | Empresa a la que pertenece |
| `dia_semana` | TINYINT NOT NULL | 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb |
| `hora_inicio` | TIME NOT NULL | Inicio del turno |
| `hora_fin` | TIME NOT NULL | Fin del turno |
| `activo` | TINYINT(1) DEFAULT 1 | 1 = vigente |
| `created_by` | BIGINT FK | Supervisor que creó el horario |

#### `excepciones_horario`
Fechas específicas en que el cobrador no trabaja o trabaja con horario especial.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | Identificador único |
| `cobrador_id` | BIGINT FK | Cobrador afectado |
| `empresa_id` | BIGINT FK | Empresa a la que pertenece |
| `fecha` | DATE NOT NULL UNIQUE | Fecha de la excepción |
| `tipo` | ENUM('LIBRE','HORARIO_ESPECIAL') | Tipo de excepción |
| `hora_inicio` | TIME | Solo para `HORARIO_ESPECIAL` |
| `hora_fin` | TIME | Solo para `HORARIO_ESPECIAL` |
| `motivo` | VARCHAR(255) | Descripción de la excepción |

#### `mensajes`
Chat interno entre supervisores y cobradores de la misma empresa.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `empresa_id` | INT FK | Empresa a la que pertenece la conversación |
| `emisor_id` | INT FK | Usuario que envió el mensaje |
| `receptor_id` | INT FK | Usuario destinatario |
| `contenido` | TEXT NOT NULL | Texto del mensaje |
| `leido` | TINYINT(1) DEFAULT 0 | 0 = no leído, 1 = leído |
| `created_at` | DATETIME DEFAULT NOW() | Fecha y hora de envío |

#### `empresas_intereses_config`
Configuración de intereses por mora de cada empresa (una fila por empresa). Permite que cada empresa decida de forma independiente si genera intereses, cuántos días de gracia otorga, el porcentaje diario y cómo se cuentan los días.

| Campo | Tipo | Descripción |
|---|---|---|
| `empresa_id` | BIGINT PK | Empresa a la que pertenece la configuración |
| `generar_interes` | TINYINT(1) DEFAULT 0 | 1 = la empresa genera interés por mora |
| `dias_gracia` | INT DEFAULT 0 | Días de luz: días posteriores al vencimiento sin interés |
| `porcentaje_interes_diario` | DECIMAL(6,4) DEFAULT 0 | % de interés por día de retraso, sobre el saldo de la cuota |
| `contar_domingos` | TINYINT(1) DEFAULT 0 | 1 = los domingos cuentan como días de retraso |
| `contar_feriados` | TINYINT(1) DEFAULT 0 | 1 = los feriados cuentan como días de retraso |
| `created_by` | BIGINT FK | Usuario que creó la configuración |
| `updated_by` | BIGINT FK | Último usuario que la modificó |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de creación |
| `updated_at` | DATETIME DEFAULT NOW() ON UPDATE NOW() | Última actualización |

#### `empresas_feriados`
Feriados locales registrados por empresa. Se excluyen del conteo de días de retraso cuando `contar_feriados = 0`.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | Identificador único |
| `empresa_id` | BIGINT FK | Empresa dueña del feriado |
| `fecha` | DATE NOT NULL | Fecha del feriado |
| `descripcion` | VARCHAR(120) | Nombre o descripción del feriado |
| `origen` | VARCHAR(50) DEFAULT 'MANUAL' | Origen del feriado: `MANUAL`, `jueves_santo`, `viernes_santo`, `traslado_heroes`, `traslado_paz_chaco`, `traslado_fundacion_asuncion` (columna añadida en la migración V14) |
| `created_by` | BIGINT FK | Usuario que lo registró |
| `deleted_at` | DATETIME | Soft delete: NULL = vigente |
| `created_at` | DATETIME DEFAULT NOW() | Fecha de registro |
| `updated_at` | DATETIME DEFAULT NOW() ON UPDATE NOW() | Última actualización |

> Restricción: `UNIQUE (empresa_id, fecha)` — no se puede duplicar un feriado para la misma empresa.

**Feriados móviles y algoritmo Computus** (servicio `backend/src/services/cobranzas/computus.js`):
- **Semana Santa:** `easterSunday(year)` implementa el algoritmo de **Computus gregoriano de Meeus/Jones/Butcher** para calcular el Domingo de Resurrección de cualquier año. De ahí se derivan `jueves_santo` (Pascua − 3), `viernes_santo` (Pascua − 2), `sabado_santo` (Pascua − 1) y `domingo_resurreccion` (Pascua). Jueves y Viernes Santo son **inamovibles** (no se trasladan).
- **Traslados Ley 6631/2020:** `aplicarTraslado(fecha)` mueve los feriados trasladables al lunes más próximo: martes → lunes anterior; miércoles/jueves → lunes siguiente; lunes/viernes/sábado/domingo quedan igual. Se aplica a los feriados nacionales trasladables: **Día de los Héroes (1 de marzo)**, **Paz del Chaco (12 de junio)** y **Fundación de Asunción (15 de agosto)**.
- `feriadosMoviblesParaguay(year)` devuelve los 5 feriados generables automáticamente para un año: jueves_santo, viernes_santo y los 3 traslados.

#### Columnas añadidas a `cuotas` (V13)

| Campo | Tipo | Descripción |
|---|---|---|
| `interes_acumulado` | DECIMAL(12,2) DEFAULT 0 | Interés acumulado calculado sobre la cuota vencida |
| `dias_retraso` | INT DEFAULT 0 | Días efectivos de retraso usados para el último cálculo |

#### Tablas del módulo de caja y medios de pago (V11)

| Tabla | Descripción |
|---|---|
| `medios_pago` | Catálogo de medios de pago por empresa (efectivo, transferencia, cheque). `requiere_comprobante` obliga a registrar `nro_comprobante` al cobrar |
| `arqueos_caja` | Caja diaria del cobrador: saldo inicial, saldo esperado, saldo contado y diferencia; un cobrador solo puede tener una caja `ABIERTO` a la vez |
| `movimientos_caja` | Gastos del cobrador durante la jornada (combustible, etc.); reducen el saldo esperado en efectivo |
| `rendiciones` | Confirmación del supervisor de la recepción del dinero: estado `CUADRADO` / `SOBRANTE` / `FALTANTE` |

#### Tablas del rediseño ERP multientidad (V12)

| Tabla | Descripción |
|---|---|
| `timbrados` | Timbrados fiscales por empresa con vigencia (`VIGENTE`, `VENCIDO`, etc.) y soporte electrónico |
| `establecimientos` | Establecimientos fiscales de la empresa (código de 3 dígitos) |
| `puntos_expedicion` | Puntos de expedición por establecimiento y timbrado |
| `cajas` | Caja operativa vinculada a un punto de expedición, con saldo actual y cobrador asignado |
| `caja_cambios` | Historial de cambios estructurales sobre la caja (cambio de cobrador, punto, timbrado, bloqueos) |
| `caja_aperturas` | Aperturas diarias de caja por cobrador, con GPS e IP de origen |
| `numeradores` | Secuencias fiscales por punto de expedición y tipo de documento (reemplaza `MAX()+1`) |
| `recibos` | Recibos fiscales y operativos emitidos por cobranzas (con `cdc`, `hash_documento`, estado `EMITIDO`/`ANULADO`/`REVERSADO`) |
| `recibo_detalles` | Conceptos cobrados por recibo, referenciando cuotas y créditos |
| `caja_movimientos` | Libro mayor de caja con trazabilidad de saldos (nunca se modifica el saldo manualmente) |
| `arqueos` | Arqueos históricos no eliminables, con saldo de sistema vs declarado |
| `cierres_caja` | Resultado consolidado del cierre de una apertura (uno por apertura, UNIQUE) |
| `auditoria` | Bitácora transversal: acciones (`INSERT`, `UPDATE`, `DELETE`, `APERTURAR`, `CERRAR`, `LOGIN`, etc.) con `datos_antes`/`datos_despues` en JSON |

> Nota: el rediseño V12 convive con el esquema legacy — las tablas `facturas_*` (V9) y `arqueos_caja` (V11) se mantienen operativas y se conectan al nuevo flujo mediante columnas puente (`legacy_arqueo_caja_id`, `facturas_timbrado_legacy_id`, `visita_cobro_id`, `factura_legacy_id`).

---

## 6. Backend — API REST

### 6.1 Configuración del servidor

- **Puerto:** 5000 (configurable por `.env`)
- **Base URL:** `http://localhost:5000`
- **Formato de respuesta:** JSON en todos los endpoints

### 6.2 Estructura de respuestas

**Respuesta exitosa:**
```json
{
  "data": { ... },
  "message": "Mensaje opcional"
}
```

**Respuesta de error:**
```json
{
  "message": "Descripción del error"
}
```

### 6.3 Endpoints implementados

#### Autenticación — `/api/auth`

| Método | Endpoint | Autenticación | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Registra una empresa y su usuario ADMIN |
| `POST` | `/api/auth/login` | No | Inicia sesión y retorna un token JWT |

**POST /api/auth/register**

Request:
```json
{
  "nombreEmpresa": "Distribuidora XYZ",
  "email": "admin@xyz.com",
  "password": "miPassword123",
  "nombre": "Juan",
  "apellido": "Pérez"
}
```

Response (201):
```json
{
  "message": "Registro exitoso",
  "data": {
    "empresaId": 1,
    "usuarioId": 1,
    "email": "admin@xyz.com"
  }
}
```

**POST /api/auth/login**

Request:
```json
{
  "email": "admin@xyz.com",
  "password": "miPassword123"
}
```

Response (200):
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "admin@xyz.com",
    "rol": "ADMIN",
    "empresaId": 1
  },
  "debeCambiarPassword": false
}
```

---

#### Panel Administrativo — `/api` (requieren Bearer Token)

| Método | Endpoint | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | Todos | Métricas generales del sistema |
| `GET` | `/api/empresas` | Todos | Lista de empresas |
| `POST` | `/api/empresas` | ADMIN, SUPERVISOR | Crear empresa |
| `PATCH` | `/api/empresas/:id/estado` | ADMIN, SUPERVISOR | Activar/desactivar empresa |
| `GET` | `/api/clientes` | Todos | Lista de clientes |
| `POST` | `/api/clientes` | ADMIN, SUPERVISOR | Crear cliente manualmente |
| `PUT` | `/api/clientes/:id` | ADMIN, SUPERVISOR | Actualizar cliente |
| `PATCH` | `/api/clientes/:id/ubicacion` | Todos | Actualizar coordenadas GPS del cliente |
| `GET` | `/api/clientes/sin-ubicacion` | Todos | Clientes sin coordenadas registradas |
| `GET` | `/api/cobranzas` | Todos | Lista de cuotas |
| `PATCH` | `/api/cobranzas/:id/cobrar` | Todos | Registrar cobro de una cuota |
| `PATCH` | `/api/cobranzas/:id/fecha` | Todos | Actualizar fecha de vencimiento |
| `GET` | `/api/gestiones` | Todos | Historial de visitas de cobro (fuente: visitas_cobro) |
| `GET` | `/api/usuarios` | Todos | Lista de usuarios |
| `GET` | `/api/usuarios/cobradores` | Todos | Lista de usuarios con rol COBRADOR |
| `GET` | `/api/usuarios/me` | Todos | Datos del usuario autenticado |
| `PUT` | `/api/usuarios/me` | Todos | Actualizar datos propios |
| `GET` | `/api/roles` | Todos | Lista de roles disponibles |
| `POST` | `/api/usuarios` | ADMIN, SUPERVISOR | Crear nuevo usuario |
| `PUT` | `/api/usuarios/:id` | ADMIN, SUPERVISOR | Actualizar usuario existente |
| `PATCH` | `/api/usuarios/:id/estado` | ADMIN, SUPERVISOR | Activar/desactivar usuario |
| `POST` | `/api/cambiar-password` | Todos | Cambiar contraseña propia |
| `GET` | `/api/zonas` | Todos | Lista de zonas |
| `POST` | `/api/zonas` | ADMIN, SUPERVISOR | Crear zona |
| `PUT` | `/api/zonas/:id` | ADMIN, SUPERVISOR | Actualizar zona |
| `DELETE` | `/api/zonas/:id` | ADMIN, SUPERVISOR | Eliminar zona |
| `POST` | `/api/zonas/auto-asignar` | ADMIN, SUPERVISOR | Asignación automática de clientes a zonas |
| `POST` | `/api/clientes/importar` | ADMIN, SUPERVISOR | Importar clientes y créditos desde archivo Excel |
| `GET` | `/api/clientes/plantilla` | No | Descargar plantilla Excel de ejemplo |
| `GET` | `/api/facturas-config` | ADMIN | Configuración de facturación de todas las empresas |
| `GET` | `/api/facturas-config/:empresaId` | ADMIN, SUPERVISOR | Configuración de facturación de una empresa |
| `PUT` | `/api/facturas-config/:empresaId` | ADMIN, SUPERVISOR | Guardar configuración de facturación |
| `GET` | `/api/facturas-timbrado/:empresaId/historial` | ADMIN, SUPERVISOR | Historial de timbrados de una empresa |
| `GET` | `/api/mensajes` | SUPERVISOR, COBRADOR | Lista de conversaciones con último mensaje y no leídos |
| `GET` | `/api/mensajes/no-leidos` | SUPERVISOR, COBRADOR | Contador total de mensajes no leídos |
| `GET` | `/api/mensajes/:usuarioId` | SUPERVISOR, COBRADOR | Historial de mensajes con un usuario específico |
| `POST` | `/api/mensajes` | SUPERVISOR, COBRADOR | Enviar un mensaje a otro usuario |

#### Cobrador móvil — `/api/cobrador` (requieren Bearer Token + rol COBRADOR)

| Método | Endpoint | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/cobrador/agenda` | COBRADOR | Agenda de visitas del día |
| `POST` | `/api/cobrador/cobros` | COBRADOR | Registrar cobro desde el móvil |
| `POST` | `/api/cobrador/visitas` | COBRADOR | Registrar visita/gestión en campo |
| `POST` | `/api/cobrador/visitas/:id/foto` | COBRADOR | Subir foto de comprobante (jpeg/png/webp) |
| `POST` | `/api/cobrador/caja/abrir` | COBRADOR | Abrir caja diaria |
| `GET` | `/api/cobrador/caja/activa` | COBRADOR | Consultar caja activa del cobrador |
| `POST` | `/api/cobrador/caja/cerrar` | COBRADOR | Cerrar caja diaria |
| `POST` | `/api/cobrador/caja/:id/gastos` | COBRADOR | Registrar gasto en caja |
| `GET` | `/api/cobrador/descansos/activo` | COBRADOR | Estado del descanso activo |
| `POST` | `/api/cobrador/descansos/iniciar` | COBRADOR | Iniciar descanso |
| `POST` | `/api/cobrador/descansos/finalizar` | COBRADOR | Finalizar descanso |

#### Arqueos — `/api/arqueos` (requieren Bearer Token)

| Método | Endpoint | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/arqueos` | ADMIN, SUPERVISOR | Lista de arqueos de caja |
| `GET` | `/api/arqueos/:id` | Todos | Detalle de un arqueo (el cobrador ve el suyo) |
| `POST` | `/api/arqueos/:id/rendicion` | ADMIN, SUPERVISOR | Confirmar rendición del arqueo |

#### Medios de pago — `/api/medios-pago` (requieren Bearer Token)

| Método | Endpoint | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/medios-pago` | Todos | Lista de medios de pago |
| `POST` | `/api/medios-pago` | ADMIN, SUPERVISOR | Crear medio de pago |
| `PUT` | `/api/medios-pago/:id` | ADMIN, SUPERVISOR | Actualizar medio de pago |

#### Configuración de cobranzas — `/api/configuracion/cobranzas` (requieren Bearer Token)

| Método | Endpoint | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/configuracion/cobranzas/timbrados` | ADMIN, SUPERVISOR | Lista de timbrados |
| `POST` | `/api/configuracion/cobranzas/timbrados` | ADMIN, SUPERVISOR | Crear timbrado |
| `PUT` | `/api/configuracion/cobranzas/timbrados/:id` | ADMIN, SUPERVISOR | Actualizar timbrado |
| `GET` | `/api/configuracion/cobranzas/establecimientos` | ADMIN, SUPERVISOR | Lista de establecimientos |
| `POST` | `/api/configuracion/cobranzas/establecimientos` | ADMIN, SUPERVISOR | Crear establecimiento |
| `PUT` | `/api/configuracion/cobranzas/establecimientos/:id` | ADMIN, SUPERVISOR | Actualizar establecimiento |
| `GET` | `/api/configuracion/cobranzas/puntos-expedicion` | ADMIN, SUPERVISOR | Lista de puntos de expedición |
| `POST` | `/api/configuracion/cobranzas/puntos-expedicion` | ADMIN, SUPERVISOR | Crear punto de expedición |
| `PUT` | `/api/configuracion/cobranzas/puntos-expedicion/:id` | ADMIN, SUPERVISOR | Actualizar punto de expedición |
| `GET` | `/api/configuracion/cobranzas/cajas` | ADMIN, SUPERVISOR | Lista de cajas |
| `POST` | `/api/configuracion/cobranzas/cajas` | ADMIN, SUPERVISOR | Crear caja |
| `PUT` | `/api/configuracion/cobranzas/cajas/:id` | ADMIN, SUPERVISOR | Actualizar caja |
| `GET` | `/api/configuracion/cobranzas/numeradores` | ADMIN, SUPERVISOR | Lista de numeradores |
| `POST` | `/api/configuracion/cobranzas/numeradores` | ADMIN, SUPERVISOR | Crear numerador |
| `PUT` | `/api/configuracion/cobranzas/numeradores/:id` | ADMIN, SUPERVISOR | Actualizar numerador |

#### Reportes — `/api/reportes` (requieren Bearer Token)

| Método | Endpoint | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/reportes/cobrador/eficiencia` | Todos | Reporte de eficiencia de cobradores |
| `GET` | `/api/reportes/cartera/vencida` | Todos | Reporte de cartera vencida |
| `GET` | `/api/reportes/periodo/cobranza` | Todos | Reporte de cobranza por período |
| `GET` | `/api/reportes/kpis/rotacion` | Todos | KPI rotación de cartera: `monto_cobrado`, `cartera_vigente`, `rotacion_cartera`, `rotacion_anualizada`, `dias_promedio_cobro` |
| `GET` | `/api/reportes/kpis/cobertura` | Todos | KPI cobertura de cobro: `total_asignaciones`, `asignaciones_con_visita`, `total_visitas`, `cobertura_cobro` |
| `GET` | `/api/reportes/kpis/reagendamiento` | Todos | KPI tasa de reagendamiento: `total_visitas`, `visitas_reagendadas`, `visitas_cobradas`, `visitas_ausentes`, `tasa_reagendamiento` |
| `GET` | `/api/reportes/kpis/costo` | Todos | KPI costo por gestión: `total_gestiones`, `costo_operativo`, `costo_por_gestion`. Requiere `?costo_operativo=N` |
| `GET` | `/api/reportes/kpis/resumen` | Todos | Los 6 KPIs del marco teórico en una sola respuesta: `{periodo, kpis}` |

**Parámetros comunes de KPIs** (query string): `empresa_id` (solo ADMIN), `cobrador_id`, `fecha_desde`, `fecha_hasta` (formato `YYYY-MM-DD`; por defecto: inicio del año actual a la fecha actual, hora local `America/Asuncion`). El rol COBRADOR solo ve sus propios datos y no puede filtrar por `cobrador_id` distinto al suyo.

**KPIs incluidos en `/kpis/resumen`** (marco teórico, Cárdenas 2021 §2.4): `indice_morosidad`, `efectividad_cobro`, `rotacion_cartera`, `cobertura_cobro`, `costo_gestion`, `tasa_reagendamiento`. El KPI `costo_gestion` devuelve `valor: null` y `disponible: false` si no se pasa `costo_operativo`.

#### Intereses por mora — `/api/configuracion/intereses` (requieren Bearer Token)

| Método | Endpoint | Roles | Descripción |
|---|---|---|---|
| `GET` | `/api/configuracion/intereses` | ADMIN, SUPERVISOR | Configuración de intereses y feriados de la empresa (`?empresa_id=` solo ADMIN) |
| `PUT` | `/api/configuracion/intereses` | ADMIN, SUPERVISOR | Guarda la configuración (generar_interes, dias_gracia, porcentaje_interes_diario, contar_domingos, contar_feriados) |
| `POST` | `/api/configuracion/intereses/feriados` | ADMIN, SUPERVISOR | Registra un feriado local (`fecha` + `descripcion` opcional) |
| `PUT` | `/api/configuracion/intereses/feriados/:id` | ADMIN, SUPERVISOR | Actualiza `fecha` y/o `descripcion` de un feriado (400 si el formato de fecha es inválido, 404 si no existe, 409 si la fecha ya está registrada) |
| `DELETE` | `/api/configuracion/intereses/feriados/:id` | ADMIN, SUPERVISOR | Elimina (soft delete) un feriado |
| `POST` | `/api/configuracion/intereses/feriados/generar` | ADMIN, SUPERVISOR | Genera automáticamente los feriados móviles de un año (Semana Santa con Computus + traslados Ley 6631/2020). Body: `{ anio, empresa_id? }` |
| `POST` | `/api/configuracion/intereses/recalcular` | ADMIN, SUPERVISOR | Recalcula intereses de todas las cuotas vencidas de la empresa (opcional `fecha_corte`) |

**GET /api/configuracion/intereses** (respuesta)

```json
{
  "data": {
    "config": {
      "empresa_id": 1,
      "generar_interes": 1,
      "dias_gracia": 7,
      "porcentaje_interes_diario": "0.1000",
      "contar_domingos": 0,
      "contar_feriados": 0
    },
    "feriados": [
      { "id": 1, "empresa_id": 1, "fecha": "2026-12-08", "descripcion": "Día de la Virgen de Caacupé", "origen": "MANUAL" }
    ]
  }
}
```

**POST /api/configuracion/intereses/feriados/generar**

Request:
```json
{ "anio": 2027, "empresa_id": 1 }
```

Response (201):
```json
{
  "message": "Feriados móviles del 2027 generados",
  "data": {
    "anio": 2027,
    "generados": 5,
    "feriados": [
      { "id": 101, "fecha": "2027-03-01", "descripcion": "Día de los Héroes (trasladado)", "origen": "traslado_heroes" },
      { "id": 102, "fecha": "2027-03-25", "descripcion": "Jueves Santo", "origen": "jueves_santo" },
      { "id": 103, "fecha": "2027-03-26", "descripcion": "Viernes Santo", "origen": "viernes_santo" },
      { "id": 104, "fecha": "2027-06-14", "descripcion": "Paz del Chaco (trasladado)", "origen": "traslado_paz_chaco" },
      { "id": 105, "fecha": "2027-08-15", "descripcion": "Fundación de Asunción", "origen": "traslado_fundacion_asuncion" }
    ]
  }
}
```

El endpoint elimina (soft delete) los feriados móviles existentes del año y los regenera con las fechas calculadas. Si un feriado ya existe para la misma fecha, se restaura/actualiza (UPSERT) en lugar de duplicarlo. Errores: `400` si `anio` no es un entero entre 2000 y 2100.

**Reglas de cálculo** (servicio `interesService.js`):
- `inicio = fecha_vencimiento + dias_gracia + 1` (primer día que corre interés).
- `dias_efectivos` = cantidad de días entre `inicio` y la fecha de corte (hoy por defecto), **excluyendo domingos** si `contar_domingos = 0` y **excluyendo feriados** registrados si `contar_feriados = 0`.
- `interes_acumulado = saldo_cuota × (porcentaje_interes_diario / 100) × dias_efectivos` (redondeado a 2 decimales).
- Si la empresa tiene `generar_interes = 0`, el recálculo pone `interes_acumulado = 0` y `dias_retraso = 0` en las cuotas pendientes/vencidas.

**POST /api/usuarios**

Request:
```json
{
  "nombre": "María",
  "apellido": "González",
  "cedula": "1234567",
  "telefono": "0981123456",
  "email": "maria@xyz.com",
  "rol_id": 3,
  "empresa_id": 1
}
```

Response (201):
```json
{
  "message": "Usuario creado exitosamente",
  "data": {
    "id": 5,
    "passwordTemporal": "distribuidoraxyz2026"
  }
}
```

**POST /api/cambiar-password**

Request:
```json
{
  "passwordActual": "distribuidoraxyz2026",
  "passwordNueva": "MiNuevaPassword123"
}
```

---

### 6.4 Endpoints planificados (pendientes)

> Los endpoints de creación de empresas, clientes, gestión de cobranzas y reportes ya
> están implementados (ver sección 6.3). Los siguientes quedan pendientes de desarrollo:

| Método | Endpoint | Descripción |
|---|---|---|
| `PUT` | `/api/empresas/:id` | Actualizar datos de la empresa (el código existe comentado) |
| `POST` | `/api/creditos` | Crear crédito y generar cuotas automáticamente |
| `GET` | `/api/creditos/:id` | Ver detalle de un crédito y sus cuotas |
| `POST` | `/api/asignaciones` | Asignar cuota(s) a un cobrador |
| `GET` | `/api/asignaciones` | Listar asignaciones (filtrado por cobrador/supervisor) |
| `POST` | `/api/visitas` | Registrar una visita de cobro manualmente desde el panel (pendiente) |
| `POST` | `/api/pagos` | Registrar un pago manual |

> Nota: las visitas de cobro se registran desde la app móvil vía
> `POST /api/cobrador/visitas` (implementado) y desde el panel vía `registrarCobro`
> (que escribe en `visitas_cobro`). El registro manual dedicado (`POST /api/visitas`)
> sigue pendiente. La generación de comprobantes PDF
> (`GET /api/visitas/:id/comprobante` y `GET /api/cobros/:id/comprobante`) también
> está pendiente, aunque pdfkit ya está integrado en el backend.

---

## 7. Frontend Web

### 7.1 Framework y configuración

El panel web está construido con **Next.js 15** usando el **App Router**, lo que proporciona:
- Renderizado en servidor (SSR) para mejor SEO y performance.
- Layouts compartidos mediante `layout.tsx`.
- Navegación optimizada con el componente `<Link>`.
- Generación de páginas por sistema de archivos (cada carpeta en `app/` es una ruta).

### 7.2 Rutas del panel web

| Ruta | Componente | Descripción | Protegida |
|---|---|---|---|
| `/` | `page.tsx` | Página de bienvenida con links | No |
| `/login` | `login/page.tsx` | Formulario de inicio de sesión | No |
| `/register` | `register/page.tsx` | Registro de empresa y admin | No |
| `/dashboard` | `dashboard/page.tsx` | Métricas generales | Sí |
| `/empresas` | `empresas/page.tsx` | Gestión de empresas | Sí |
| `/clientes` | `clientes/page.tsx` | Gestión de clientes | Sí |
| `/cobranzas` | `cobranzas/page.tsx` | Gestión de cobranzas | Sí |
| `/gestiones` | `gestiones/page.tsx` | Historial de gestiones/visitas de cobro | Sí |
| `/horarios` | `horarios/page.tsx` | Gestión de horarios de cobradores | Sí |
| `/descansos` | `descansos/page.tsx` | Gestión de descansos de cobradores | Sí |
| `/zonas` | `zonas/page.tsx` | Gestión de zonas geográficas | Sí |
| `/facturas` | `facturas/page.tsx` | Configuración de facturación y timbrados | Sí |
| `/medios-pago` | `medios-pago/page.tsx` | Gestión de medios de pago | Sí |
| `/configuracion-cobranzas` | `configuracion-cobranzas/page.tsx` | Timbrados, cajas y numeradores (V12) | Sí |
| `/configuracion-intereses` | `configuracion-intereses/page.tsx` | Intereses por mora y feriados | Sí |
| `/reportes` | `reportes/page.tsx` | Reportes (cobrador, cartera, período, KPIs) | Sí |
| `/reportes/cobrador` | `reportes/cobrador/page.tsx` | Eficiencia de cobradores | Sí |
| `/reportes/cartera` | `reportes/cartera/page.tsx` | Cartera vencida | Sí |
| `/reportes/periodo` | `reportes/periodo/page.tsx` | Cobranza por período | Sí |
| `/reportes/kpis` | `reportes/kpis/page.tsx` | Los 6 KPIs del marco teórico con exportación CSV | Sí |
| `/usuarios` | `usuarios/page.tsx` | Gestión de usuarios | Sí |
| `/perfil` | `perfil/page.tsx` | Perfil del usuario autenticado | Sí |
| `/cambiar-password` | `cambiar-password/page.tsx` | Cambio obligatorio de contraseña | Sí |
| `/importar` | `importar/page.tsx` | Importación masiva de clientes y créditos desde Excel | Sí |
| `/mensajes` | `mensajes/page.tsx` | Chat interno entre supervisores y cobradores | Sí |
| `/mapa` | `mapa/page.tsx` | Mapa de visitas georreferenciadas por cobrador | Sí |

### 7.3 Componentes principales

#### `PanelShell`
Componente de layout que envuelve todas las páginas protegidas del panel. Incluye:
- **Sidebar izquierdo** con logo de cobrApp y navegación (Dashboard, Empresas, Clientes, Cobranzas, Usuarios).
- **Header superior** con título de página y descripción.
- **Botón de cierre de sesión** que limpia localStorage y redirige al login.
- Indicador visual de ruta activa en el menú.

#### `useAuth` (hook)
Hook personalizado que protege las rutas del panel con dos capas de control:

1. **Autenticación:** Si no existe un token JWT en `localStorage` y la ruta no es pública (`/`, `/login`, `/register`), redirige al usuario a `/login`.
2. **Autorización por rol (RBAC):** Verifica que el rol del usuario tenga permiso para acceder a la ruta actual según la siguiente tabla:

| Ruta | Roles con acceso |
|---|---|
| `/empresas` | ADMIN |
| `/importar` | ADMIN, SUPERVISOR |
| `/zonas` | ADMIN, SUPERVISOR |
| `/clientes` | ADMIN, SUPERVISOR |
| Resto de rutas protegidas | Todos los roles autenticados |

Si un usuario intenta acceder por URL a una ruta fuera de sus permisos, se muestra un **toast de error** (`sonner`) con el mensaje *"No tenés permisos para acceder a esa sección"* y es redirigido automáticamente al `/dashboard`.

#### `useInactivityLogout` (hook)
Hook de seguridad que cierra la sesión automáticamente tras **60 minutos de inactividad** del usuario. Funciona en dos etapas:

1. **Durante la sesión:** Escucha eventos de actividad (`mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `wheel`). Cada vez que el usuario interactúa, reinicia el contador y actualiza el timestamp en `localStorage` bajo la clave `cobrapp_last_activity`.
2. **Al recargar o volver a abrir el navegador:** Al montar el hook, compara el timestamp guardado con el momento actual. Si han pasado más de 60 minutos, limpia la sesión (`cobrapp_token`, `cobrapp_user`, `cobrapp_last_activity`) y redirige al `/login` antes de renderizar contenido.

Esto garantiza el cierre de sesión incluso cuando el navegador fue cerrado y reabierto luego de que expiró el tiempo. El hook está integrado en `PanelShell`, por lo que aplica globalmente a todas las páginas protegidas.

#### `api.ts` (servicio)
Configura una instancia de Axios con:
- `baseURL`: `http://localhost:5000`
- Interceptor de request que adjunta automáticamente el token Bearer en cada petición.
- Tipos TypeScript exportados para todas las entidades (Empresa, Cliente, Cobranza, Usuario, Rol, etc.).
- Funciones agrupadas en objetos `authApi` y `panelApi`.

### 7.4 Gestión del estado de autenticación

El estado del usuario autenticado se persiste en `localStorage` bajo tres claves:
- `cobrapp_token` — Token JWT para autorizar peticiones.
- `cobrapp_user` — Objeto JSON con datos del usuario (nombre, email, rol, empresaId).
- `cobrapp_last_activity` — Timestamp Unix de la última actividad del usuario (usado por `useInactivityLogout`).

Al hacer logout (manual o por inactividad), las tres claves se eliminan y se redirige al login.

---

## 8. Aplicación Móvil

### 8.1 Estado actual

La aplicación móvil está **parcialmente implementada**. La carpeta `mobile/` contiene código funcional con las pantallas principales del cobrador: login, agenda, mapa de ruta, gestión de visitas, mensajería, caja (apertura/cierre), descansos y perfil.

### 8.2 Tecnología utilizada

**React Native con Expo** por las siguientes razones:
- Permite reutilizar conocimiento de React (mismo paradigma que el frontend web).
- Expo facilita el acceso a APIs nativas: GPS, notificaciones push, cámara.
- Un solo código base genera apps para Android e iOS.
- Compatible con el mismo backend Node.js existente.

| Tecnología | Uso |
|---|---|
| **React Native + Expo** | Framework para apps iOS y Android |
| **Expo Location** | Acceso al GPS del dispositivo |
| **react-native-maps** | Mapa nativo con marcadores y polilíneas de ruta |

### 8.3 Módulos de la app móvil

| Módulo | Pantalla | Estado |
|---|---|---|
| **Login** | `LoginScreen.tsx` | Implementado |
| **Agenda del día** | `AgendaScreen.tsx` | Implementado |
| **Mapa de ruta** | `MapaRutaScreen.tsx` | Implementado |
| **Registrar visita** | `VisitaScreen.tsx` | Implementado |
| **Caja** | `CajaScreen.tsx` | Implementado (apertura/cierre de caja, arqueo y gastos) |
| **Mensajería** | `MensajesScreen.tsx` | Implementado |
| **Descansos** | `DescansoScreen.tsx` | Implementado |
| **Perfil** | `PerfilScreen.tsx` | Implementado |

### 8.4 Flujo del cobrador en la app móvil

```
1. Login con email y contraseña
2. Ver lista de asignaciones del día
3. Seleccionar una cuota asignada
4. Ver datos del cliente y monto a cobrar
5. Ir a la dirección del cliente
6. Registrar gestión:
   a. Resultado: Cobrado / No encontrado / Promesa de pago / etc.
   b. Observación en texto libre
   c. Captura automática de coordenadas GPS
   d. (Opcional) Foto de comprobante si pagó
7. Si cobró: registrar monto y método de pago
8. La cuota cambia de estado en tiempo real
```

---

## 9. Sistema de Autenticación y Autorización

### 9.1 Autenticación con JWT

**JWT (JSON Web Token)** es un estándar abierto (RFC 7519) para transmitir información de forma segura como un objeto JSON firmado digitalmente.

El token tiene tres partes separadas por puntos:
```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB4eXouY29tIn0.firma
      Header                         Payload                         Signature
```

**Payload del token en cobrApp:**
```json
{
  "id": 1,
  "email": "admin@xyz.com",
  "empresaId": 1,
  "rol_id": 1,
  "rol": "ADMIN",
  "iat": 1747612800,
  "exp": 1747699200
}
```

**Configuración:**
- Algoritmo de firma: `HS256`
- Tiempo de expiración: `24 horas`
- Clave secreta: definida en variable de entorno `JWT_SECRET`

### 9.2 Flujo de autenticación

```
Cliente                   Backend                  BD
  │                          │                      │
  │── POST /auth/login ──────►│                      │
  │   { email, password }     │── SELECT usuario ───►│
  │                          │◄── datos usuario ────│
  │                          │                      │
  │                          │─── bcrypt.compare() ──(interno)
  │                          │                      │
  │◄── 200 OK ───────────────│                      │
  │   { token, user,          │                      │
  │     debeCambiarPassword } │                      │
  │                          │                      │
  │── GET /api/dashboard ────►│                      │
  │   Authorization: Bearer   │── jwt.verify() ──────(interno)
  │                          │                      │
  │◄── 200 OK ───────────────│                      │
```

### 9.3 Encriptación de contraseñas

Se utiliza **bcrypt** con un factor de trabajo de 10 salt rounds. Esto significa:
- La contraseña nunca se almacena en texto plano.
- Cada hash es único incluso para contraseñas idénticas (gracias al salt).
- Es computacionalmente costoso de romper por fuerza bruta.

### 9.4 Control de acceso por roles (RBAC)

El sistema implementa **Role-Based Access Control**:

| Acción | ADMIN | SUPERVISOR | COBRADOR |
|---|---|---|---|
| Ver todas las empresas | ✅ | ❌ (solo la suya) | ❌ (solo la suya) |
| Crear/editar empresas | ✅ | ❌ | ❌ |
| Crear usuarios ADMIN | ✅ | ❌ | ❌ |
| Crear usuarios SUPERVISOR | ✅ | ✅ (solo en su empresa) | ❌ |
| Crear usuarios COBRADOR | ✅ | ✅ (solo en su empresa) | ❌ |
| Asignar cobranzas | ✅ | ✅ | ❌ |
| Registrar gestiones | ✅ | ✅ | ✅ |
| Ver reportes | ✅ | ✅ (solo su empresa) | ❌ |

### 9.5 Sistema de cambio obligatorio de contraseña

Al crear un usuario, el sistema:
1. Genera automáticamente una contraseña temporal con el formato: `{nombreEmpresa}{año}` (ej: `distribuidoraxyz2026`)
2. Encripta la contraseña con bcrypt.
3. Marca el campo `debe_cambiar_password = TRUE` en la BD.

Al hacer login:
1. El backend detecta `debe_cambiar_password = TRUE`.
2. Retorna `debeCambiarPassword: true` en la respuesta.
3. El frontend redirige automáticamente a `/cambiar-password`.
4. El usuario no puede acceder a ninguna otra ruta hasta cambiar su contraseña.
5. Al cambiar la contraseña, el campo se actualiza a `debe_cambiar_password = FALSE`.

---

## 10. Módulos del Sistema

### 10.1 Módulo de Empresas

Gestiona las empresas clientes del sistema. En arquitectura multiempresa, cada empresa es un "tenant" con sus propios clientes, créditos y usuarios.

**Parcialmente implementado.**

**Funcionalidades implementadas:**
- Registro de empresa junto con su usuario ADMIN inicial (`POST /api/auth/register` o página `/register`).
- Listado de empresas (`GET /api/empresas`).
- Activación/desactivación de empresas (`PATCH /api/empresas/:id/estado`).
- Visualización de métricas por empresa (desde el dashboard).

**Funcionalidades planificadas:**
- Edición de datos de la empresa (nombre, RUC, dirección, teléfono, email) — `PUT /api/empresas/:id` (el código existe comentado en `panelRoutes.js`).

### 10.2 Módulo de Clientes

Gestiona los deudores de cada empresa.

**Parcialmente implementado.**

**Funcionalidades implementadas:**
- Registro con datos personales y de contacto (`POST /api/clientes` o desde la página `/clientes`).
- Actualización de cliente (`PUT /api/clientes/:id`).
- Registro de ubicación GPS (`PATCH /api/clientes/:id/ubicacion`).
- Importación masiva desde Excel (ver 10.2.1).
- Estado del cliente (activo/inactivo).

**Funcionalidades planificadas:**
- Historial de créditos por cliente en una vista dedicada.

### 10.2.1 Módulo de Importación (Excel)

Permite la carga masiva de clientes y créditos desde un archivo Excel (`.xlsx`).

**Implementado.** Accesible desde `/importar` para roles ADMIN y SUPERVISOR.

**Flujo técnico:**
1. El usuario sube un archivo `.xlsx` desde el formulario web.
2. El frontend envía el archivo como `multipart/form-data` al endpoint `POST /api/clientes/importar`.
3. El backend recibe el archivo en memoria usando **multer** (sin guardarlo en disco).
4. La librería **xlsx** parsea el archivo y convierte las filas en objetos JSON.
5. Por cada fila se crea o actualiza el cliente (upsert por cédula), y si contiene datos de crédito se genera el crédito con sus cuotas automáticamente.
6. La respuesta incluye contadores: `total`, `importados`, `actualizados`, `sinUbicacion`, `creditosCreados`, `errores`.

**Columnas reconocidas en el Excel:**

| Grupo | Columnas |
|---|---|
| **Cliente** (obligatorio) | `cedula*`, `nombre*`, `apellido`, `telefono`, `email`, `direccion` |
| **Ubicación** (opcional, una opción) | `url_maps` — ó bien — `latitud` + `longitud` |
| **Crédito** (opcional) | `numero_credito`, `descripcion`, `precio_contado`, `entrega_inicial`, `monto_total`, `cantidad_cuotas`, `cuotas_pagadas`, `monto_cuota`, `dia_pago`, `periodicidad` (SEMANAL/QUINCENAL/MENSUAL), `tasa_interes`, `fecha_otorgamiento` |

Una plantilla de ejemplo descargable está disponible en `GET /api/clientes/plantilla`.

### 10.3 Módulo de Créditos y Cuotas

Núcleo financiero del sistema.

**Funcionalidades planificadas:**
- Crear un crédito: monto, plazo, tasa de interés, fecha inicio.
- Generación automática de cuotas con fechas de vencimiento.
- Cálculo de saldo pendiente.
- Marcado automático de cuotas como VENCIDAS cuando superen la fecha límite (cron job).

### 10.4 Módulo de Asignaciones

Vincula cobradores con cuotas específicas.

**Funcionalidades planificadas:**
- Asignación manual por parte del supervisor.
- Prevención de doble asignación (una cuota no puede estar asignada a dos cobradores simultáneamente).
- Reasignación en caso de ausencia del cobrador.
- Vista de carga de trabajo por cobrador.

### 10.5 Módulo de Gestiones (Visitas de Cobro)

Historial de actividad de los cobradores en campo. La fuente de verdad única es la
tabla `visitas_cobro` (migración v17/v18: se eliminó la duplicación con la tabla
`gestiones`, que ya no existe).

**Implementado.**

**Funcionalidades implementadas:**
- Registro de cada intento de cobro desde la app móvil con resultado (`cobrado`/`ausente`/`reagendado`), observación, GPS y foto opcional (`POST /api/cobrador/visitas` + `POST /api/cobrador/visitas/:id/foto`).
- Registro de cobros desde el panel web (`registrarCobro` escribe en `visitas_cobro`).
- Listado del historial de visitas (`GET /api/gestiones`, consulta `visitas_cobro`) y vista web en `/gestiones`.

**Funcionalidades planificadas:**
- Registro manual de visitas desde el panel web (`POST /api/visitas`).
- Línea de tiempo de visitas por cuota.

### 10.6 Módulo de Mensajería

Chat interno entre supervisores y cobradores de la misma empresa.

**Implementado.** Accesible desde `/mensajes` en el panel web y desde `MensajesScreen` en la app móvil.

**Características:**
- Solo disponible para roles **SUPERVISOR** y **COBRADOR** (el ADMIN no tiene acceso).
- Cada usuario solo puede chatear con usuarios del rol opuesto dentro de su propia empresa (un supervisor ve sus cobradores, un cobrador ve sus supervisores).
- Los mensajes se almacenan en la tabla `mensajes` de MySQL.
- La actualización de mensajes se realiza mediante **polling REST** (sin WebSocket): el frontend consulta periódicamente los nuevos mensajes con `setInterval`.
- Muestra contador de mensajes no leídos por conversación.

**Tabla `mensajes`:**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Identificador único |
| `emisor_id` | INT FK | Usuario que envió el mensaje |
| `receptor_id` | INT FK | Usuario destinatario |
| `contenido` | TEXT NOT NULL | Texto del mensaje |
| `leido` | TINYINT(1) DEFAULT 0 | 0 = no leído, 1 = leído |
| `created_at` | DATETIME DEFAULT NOW() | Fecha y hora de envío |

### 10.7 Módulo de Geolocalización y Mapas

Organización geográfica del trabajo de cobranza. El sistema usa dos implementaciones de mapas según la plataforma.

#### Mapa web — Supervisión de visitas (`/mapa`)

**Implementado.** Muestra en un mapa interactivo todas las visitas (gestiones) georreferenciadas del día, filtradas por cobrador y resultado.

- **Tecnología:** `react-leaflet` + `leaflet` con tiles de **OpenStreetMap** (gratuito, sin API key).
- Los marcadores tienen colores según resultado: verde (cobrado), rojo (ausente), amarillo (reagendado).
- Carga diferida con `dynamic` import (SSR deshabilitado) para evitar errores de servidor con Leaflet.
- Centrado automático según los puntos disponibles.

#### Mapa móvil — Ruta del cobrador (`MapaRutaScreen`)

**Implementado.** Muestra la ruta optimizada del cobrador para el día, con navegación punto a punto.

- **Tecnología:** `react-native-maps` + `expo-location`.
- **Optimización de ruta:** algoritmo **Nearest Neighbor TSP** implementado en `mobile/src/utils/tsp.ts`.
  - Calcula distancias con la fórmula de **Haversine** (distancia real sobre la esfera terrestre).
  - Parte desde la ubicación GPS actual del cobrador y elige iterativamente el punto más cercano no visitado.
  - Complejidad O(n²) — suficiente para la cantidad típica de paradas por cobrador.
- **Trazado por calles:** consume la API pública de **OSRM** (`router.project-osrm.org`) para obtener la polilínea real por calles. Gratuito, sin API key requerida. Si no hay conexión, cae a línea recta entre puntos.
- El cobrador puede reordenar manualmente las paradas y abrir la navegación en **Google Maps** con un toque.

### 10.8 Módulo de Reportes

Información para la toma de decisiones.

**Parcialmente implementado.**

**Reportes implementados:**
- Eficiencia de cobradores (`GET /api/reportes/cobrador/eficiencia`, página `/reportes/cobrador`): cuotas asignadas vs cobradas por cobrador.
- Cartera vencida (`GET /api/reportes/cartera/vencida`, página `/reportes/cartera`): antigüedad de saldos con DATEDIFF.
- Cobranza por período (`GET /api/reportes/periodo/cobranza`, página `/reportes/periodo`): agrupación diaria, semanal y mensual con DATE_FORMAT.

**Reportes planificados:**
- Rendimiento por empresa.
- Gestión de cartera.
- Visitas por cobrador.
- Morosidad por cliente.
- Cobradores del día.
- Ranking de cobradores.
- Exportación a PDF y Excel.

### 10.9 Módulo de Intereses por Mora

Permite que **cada empresa** decida de forma independiente si genera intereses por mora, después de cuántos días de retraso empiezan a correr, qué porcentaje diario aplica y cómo se cuentan los días (domingos y feriados).

**Configuración por empresa** (tabla `empresas_intereses_config`, una fila por empresa):

| Campo | Descripción |
|---|---|
| `generar_interes` | Activa/desactiva el cálculo de intereses para la empresa |
| `dias_gracia` | Días de luz: cantidad de días posteriores al vencimiento sin interés |
| `porcentaje_interes_diario` | Porcentaje de interés por día de retraso, aplicado sobre el saldo de la cuota |
| `contar_domingos` | Si los domingos cuentan como días de retraso |
| `contar_feriados` | Si los feriados cuentan como días de retraso |

**Feriados locales** (tabla `empresas_feriados`): cada empresa registra sus propios feriados (ej: feriados paraguayos). No se puede duplicar la misma fecha para la misma empresa (UNIQUE `empresa_id` + `fecha`). Se excluyen del conteo cuando `contar_feriados = 0`.

**Reglas de cálculo** (`backend/src/services/cobranzas/interesService.js`):

1. **Inicio del cómputo:** `inicio = fecha_vencimiento + dias_gracia + 1`. Durante los días de luz no se acumula interés.
2. **Días efectivos de retraso:** se cuentan los días entre `inicio` y la fecha de corte (por defecto hoy), recorriendo día por día:
   - Se **excluyen los domingos** si `contar_domingos = 0`.
   - Se **excluyen los feriados** registrados de la empresa si `contar_feriados = 0`.
3. **Interés acumulado:** `interes_acumulado = saldo_cuota × (porcentaje_interes_diario / 100) × dias_efectivos`, redondeado a 2 decimales.
4. **Desactivación:** si `generar_interes = 0`, al recalcular se resetean `interes_acumulado = 0` y `dias_retraso = 0` en las cuotas pendientes/vencidas de la empresa.

El resultado del cálculo se persiste en las columnas `interes_acumulado` y `dias_retraso` de la tabla `cuotas`.

**Archivos del módulo:**
- Backend: `backend/src/services/cobranzas/interesService.js` (cálculo), `backend/src/controllers/interesesConfigController.js` (API), `backend/src/routes/interesesConfigRoutes.js` (rutas).
- Migración: `backend/scripts/applyMigrationV13.js` (crea tablas y columnas).
- Frontend: `web/src/app/configuracion-intereses/page.tsx` (pantalla de configuración) y `web/src/components/PanelShell.tsx` (acceso desde el menú para ADMIN y SUPERVISOR).

---

## 11. Variables de Entorno

El archivo `.env` en la carpeta `backend/` contiene la configuración sensible del servidor. **No debe subirse al repositorio Git.**

```env
# Puerto del servidor
PORT=5000

# Configuración de base de datos MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cobrApp

# Configuración de bcrypt
BCRYPT_SALT_ROUNDS=10

# Configuración de JWT
JWT_SECRET=cobrApp_secret_key_2026_change_in_production
JWT_EXPIRES_IN=24h
```

> ⚠️ **Importante para producción:** El valor de `JWT_SECRET` debe ser una cadena aleatoria larga y compleja. Se puede generar con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 12. Flujos Principales del Sistema

### 12.1 Flujo de registro de empresa nueva

```
1. Empresa completa formulario en /register
   → nombre empresa, email, contraseña, nombre y apellido del admin

2. Backend:
   → Verifica que el email no esté registrado
   → Crea registro en tabla `empresas`
   → Crea o recupera el rol ADMIN en tabla `roles`
   → Encripta la contraseña con bcrypt
   → Crea el usuario ADMIN en tabla `usuarios`

3. Frontend:
   → Muestra mensaje de éxito
   → Redirige al login
```

### 12.2 Flujo de cobro en campo (implementado) y asignación (planificado)

**Asignación de cuotas a cobradores (planificado):**
```
SUPERVISOR (web):
1. Ingresa al módulo de Cobranzas
2. Filtra cuotas pendientes o vencidas
3. Selecciona cuota(s) y asigna a un cobrador
4. El sistema registra la asignación y notifica al cobrador
```

**Cobro en campo (implementado en la app móvil):**
```
COBRADOR (móvil):
1. Abre la app y consulta su agenda del día (GET /api/cobrador/agenda)
2. Apertura la caja diaria (POST /api/cobrador/caja/abrir)
3. Va a la dirección del cliente
4. Registra la gestión (POST /api/cobrador/visitas):
   → Resultado, observación, GPS automático
5. Si cobró: registra monto y medio de pago (POST /api/cobrador/cobros)
   → Opcionalmente adjunta foto del comprobante (POST /api/cobrador/visitas/:id/foto)
6. Puede registrar gastos de la jornada (POST /api/cobrador/caja/:id/gastos)
7. Al finalizar, cierra la caja (POST /api/cobrador/caja/cerrar)

SUPERVISOR (web):
8. Ve las visitas del día en el mapa (/mapa) y en /gestiones
9. Confirma la rendición del arqueo (POST /api/arqueos/:id/rendicion)
10. Genera reportes (eficiencia, cartera vencida, cobranza por período)
```

### 12.3 Flujo de cambio de contraseña obligatorio

```
1. Supervisor/Admin crea nuevo usuario
   → Sistema genera contraseña: nombreEmpresa + año
   → Sistema muestra contraseña temporal en pantalla (una sola vez)

2. Nuevo usuario hace login con contraseña temporal
   → Backend retorna { debeCambiarPassword: true }
   → Frontend redirige a /cambiar-password

3. Usuario ingresa:
   → Contraseña actual (la temporal)
   → Nueva contraseña (mínimo 6 caracteres)
   → Confirmación de nueva contraseña

4. Backend:
   → Verifica contraseña actual
   → Encripta nueva contraseña con bcrypt
   → Actualiza password en BD
   → Marca debe_cambiar_password = FALSE

5. Frontend redirige al dashboard
```

---

## 13. Seguridad

### 13.1 Medidas implementadas

| Medida | Implementación |
|---|---|
| Contraseñas encriptadas | bcrypt con 10 rounds |
| Autenticación stateless | JWT con expiración |
| Consultas parametrizadas | MySQL2 con placeholders `?` (previene SQL Injection) |
| Validación de token | Middleware en todas las rutas protegidas |
| Variables sensibles en `.env` | No hardcodeadas en el código |

### 13.2 Medidas pendientes para producción

| Medida | Descripción | Prioridad |
|---|---|---|
| **CORS restrictivo** | Limitar orígenes permitidos a los dominios de la app | Alta |
| **Rate limiting** | Máximo N intentos de login por IP/minuto | Alta |
| **HTTPS** | Certificado SSL/TLS en el servidor | Alta |
| **Refresh tokens** | Renovación de tokens sin re-login | Media |
| **Validación de entrada** | Sanitización con `express-validator` o `joi` | Media |
| **Helmet.js** | Headers HTTP de seguridad | Media |
| **Logs de auditoría** | Registro de acciones críticas (quien hizo qué y cuándo) | Media |

### 13.3 Vulnerabilidades OWASP Top 10 consideradas

| OWASP | Riesgo | Estado en cobrApp |
|---|---|---|
| A01 Broken Access Control | Usuarios acceden a datos de otras empresas | ⚠️ Parcialmente mitigado |
| A02 Cryptographic Failures | Contraseñas en texto plano | ✅ Mitigado con bcrypt |
| A03 Injection | SQL Injection | ✅ Mitigado con consultas parametrizadas |
| A05 Security Misconfiguration | CORS abierto, sin rate limit | ⚠️ Pendiente |
| A07 Authentication Failures | Sin límite de intentos de login | ⚠️ Pendiente |

---

## 14. Guía de Instalación y Ejecución

### 14.1 Requisitos previos

- Node.js 18 o superior
- MySQL 8.x (o Laragon en Windows)
- npm o yarn
- Git

### 14.2 Configuración del Backend

```bash
# 1. Entrar al directorio del backend
cd cobrApp/backend

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env (copiar del ejemplo)
# Editar los valores según tu entorno local

# 4. Crear la base de datos en MySQL
# En DBeaver, phpMyAdmin o MySQL Workbench:
CREATE DATABASE cobrApp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 5. Ejecutar las migraciones en orden
#    Scripts SQL de la carpeta /database/ (en orden de versión):
#    - migracion_v2.sql
#    - migracion_v3_clientes_global.sql
#    - migracion_v4_cobrador.sql
#    - migracion_v5_descansos.sql
#    - migracion_v6_horarios.sql
#    - migracion_v7_mensajes.sql
#    - migracion_v8_mensajes_imagen.sql
#    - migracion_v9_facturas_config.sql
#    - migracion_v10_anulaciones.sql
#    - migracion_v10_empresa_logo.sql
#    - migracion_v11_arqueos_caja.sql
#    - migracion_v12_cobranzas_erp_multientidad.sql
#    - migracion_v13_intereses_config_empresa.sql
#    - migracion_v14_feriados_origen.sql
#    - migracion_v15_feriados_anuales.sql
#    - agregar_campo_debe_cambiar_password.sql
#
#    Alternativa: scripts Node.js en backend/scripts/ (aplican las migraciones v6 a v15):
#      node scripts/applyMigrationV6.js
#      node scripts/applyMigrationV12.js
#      node scripts/applyMigrationV13.js
#      node scripts/applyMigrationV14.js
#      node scripts/applyMigrationV15.js
#      node scripts/fixFeriadosFijos.js
#      node scripts/backfillCobranzasV12.js          # con --commit para confirmar

# 6. Iniciar el servidor
npm run dev
# (equivalente a: nodemon src/app.js)
# O en producción:
node src/app.js
```

### 14.3 Configuración del Frontend Web

```bash
# 1. Entrar al directorio web
cd cobrApp/web

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev

# La aplicación estará disponible en: http://localhost:3000
```

### 14.4 Verificación de funcionamiento

1. Abrir `http://localhost:3000` — debe mostrar la página de bienvenida.
2. Ir a `/register` y crear una empresa de prueba.
3. Hacer login con las credenciales creadas.
4. Verificar que redirige al Dashboard con métricas.
5. Verificar en la consola del navegador que no hay errores de conexión con el backend.

---

*Documentación técnica del proyecto de investigación — cobrApp v1.0*  
*Universidad Católica Nuestra Señora de la Asunción — Unidad Pedagógica Carapeguá, 2026*
