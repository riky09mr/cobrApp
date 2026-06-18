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
│   ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│   │  Auth Module │  │ Panel Module  │  │ Notif Module│  │
│   │  JWT + bcrypt│  │ CRUD + Reports│  │ Cron + Email│  │
│   └──────────────┘  └───────────────┘  └─────────────┘  │
│                                                          │
│   Middleware: authenticateToken, roleCheck, rateLimit    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              BASE DE DATOS — MySQL                       │
│                                                          │
│   empresas → usuarios → roles                           │
│   clientes → creditos → cuotas                          │
│   asignaciones → gestiones → pagos                      │
│   notificaciones → zonas → coordenadas                  │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Patrón arquitectónico

El backend implementa el patrón **MVC (Modelo - Vista - Controlador)** adaptado a APIs REST:

- **Modelo:** Las tablas de MySQL gestionadas a través del pool de conexiones.
- **Controlador:** Archivos en `controllers/` que contienen la lógica de negocio.
- **Vista:** No aplica en el backend (la vista es el frontend).
- **Rutas:** Archivos en `routes/` que mapean URLs a controladores.
- **Middlewares:** Funciones intermedias para autenticación y validación.

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
| **Express.js** | 4.x | Framework para construir la API REST |
| **MySQL2** | 3.x | Driver para conectar con MySQL usando Promises |
| **bcryptjs** | 2.x | Encriptación de contraseñas con salt rounds |
| **jsonwebtoken** | 9.x | Generación y verificación de tokens JWT |
| **dotenv** | 16.x | Manejo de variables de entorno desde `.env` |
| **cors** | 2.x | Middleware para habilitar Cross-Origin Resource Sharing |
| **morgan** | 1.x | Logger de peticiones HTTP en desarrollo |
| **multer** | 2.x | Middleware para recibir archivos subidos (`multipart/form-data`) |
| **xlsx** | 0.18.x | Lectura y escritura de archivos Excel (.xlsx) |

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
│   └── src/
│       ├── app.js              # Punto de entrada del servidor
│       ├── config/
│       │   └── db.js           # Configuración del pool de MySQL
│       ├── controllers/        # Lógica de negocio
│       │   ├── authController.js
│       │   ├── clientesController.js   # CRUD + importación Excel
│       │   ├── cobradorController.js   # Agenda, visitas y gestiones (móvil)
│       │   ├── descansosController.js  # Gestión de descansos de cobradores
│       │   ├── horariosController.js   # Horarios laborales
│       │   ├── mensajesController.js   # Chat interno
│       │   ├── panelController.js      # Dashboard y cobranzas
│       │   ├── usuariosController.js   # ABM de usuarios
│       │   └── zonasController.js      # Zonas geográficas
│       ├── middlewares/
│       │   └── authMiddleware.js       # Verificación de JWT
│       ├── models/             # (Reservado)
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── cobradorRoutes.js       # Rutas exclusivas de la app móvil
│       │   ├── descansosRoutes.js
│       │   ├── horariosRoutes.js
│       │   └── panelRoutes.js          # Rutas del panel web
│       ├── services/
│       │   └── descansoCron.js         # Cron job para gestión de descansos
│       └── uploads/
│           └── evidencias/             # Fotos de comprobantes subidas desde móvil
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
│       │   └── cambiar-password/page.tsx
│       ├── components/
│       │   ├── PanelShell.tsx          # Layout del panel (sidebar + header)
│       │   ├── MapaVisitas.tsx         # Mapa Leaflet de gestiones
│       │   └── MapPolygonPicker.tsx    # Selector de polígono para zonas
│       ├── hooks/
│       │   ├── useAuth.ts              # Hook de protección de rutas
│       │   └── useInactivityLogout.ts  # Cierre de sesión por inactividad
│       ├── layouts/            # (Reservado)
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
│       │   └── AuthContext.tsx     # Contexto de autenticación global
│       ├── screens/
│       │   ├── LoginScreen.tsx
│       │   ├── AgendaScreen.tsx    # Lista de visitas del día
│       │   ├── MapaRutaScreen.tsx  # Mapa con ruta TSP optimizada
│       │   ├── VisitaScreen.tsx    # Registro de gestión con GPS y foto
│       │   ├── MensajesScreen.tsx  # Chat con supervisores
│       │   └── DescansoScreen.tsx  # Solicitud y estado de descansos
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
│   └── migracion_v7_mensajes.sql
│
├── ANALISIS_ESTADO_SISTEMA.md
├── DOCUMENTACION_TECNICA.md
└── Protocolo_Rivaldo_Zarate.docx
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
| `GET` | `/api/clientes` | Todos | Lista de clientes |
| `GET` | `/api/cobranzas` | Todos | Lista de cuotas |
| `GET` | `/api/usuarios` | Todos | Lista de usuarios |
| `GET` | `/api/roles` | Todos | Lista de roles disponibles |
| `POST` | `/api/usuarios` | ADMIN, SUPERVISOR | Crear nuevo usuario |
| `PUT` | `/api/usuarios/:id` | ADMIN, SUPERVISOR | Actualizar usuario existente |
| `POST` | `/api/cambiar-password` | Todos | Cambiar contraseña propia |
| `POST` | `/api/clientes/importar` | ADMIN, SUPERVISOR | Importar clientes y créditos desde archivo Excel |
| `GET` | `/api/clientes/plantilla` | No | Descargar plantilla Excel de ejemplo |
| `GET` | `/api/mensajes` | SUPERVISOR, COBRADOR | Lista de conversaciones con último mensaje y no leídos |
| `GET` | `/api/mensajes/no-leidos` | SUPERVISOR, COBRADOR | Contador total de mensajes no leídos |
| `GET` | `/api/mensajes/:usuarioId` | SUPERVISOR, COBRADOR | Historial de mensajes con un usuario específico |
| `POST` | `/api/mensajes` | SUPERVISOR, COBRADOR | Enviar un mensaje a otro usuario |

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

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/empresas` | Crear empresa |
| `PUT` | `/api/empresas/:id` | Actualizar empresa |
| `POST` | `/api/clientes` | Crear cliente |
| `PUT` | `/api/clientes/:id` | Actualizar cliente |
| `POST` | `/api/creditos` | Crear crédito y generar cuotas automáticamente |
| `GET` | `/api/creditos/:id` | Ver detalle de un crédito y sus cuotas |
| `POST` | `/api/asignaciones` | Asignar cuota(s) a un cobrador |
| `GET` | `/api/asignaciones` | Listar asignaciones (filtrado por cobrador/supervisor) |
| `POST` | `/api/gestiones` | Registrar una gestión de cobro |
| `GET` | `/api/gestiones` | Listar historial de gestiones |
| `POST` | `/api/pagos` | Registrar un pago |
| `GET` | `/api/reportes/cobranzas` | Reporte de cobranzas por periodo |
| `GET` | `/api/reportes/cobradores` | Reporte de desempeño por cobrador |

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
| `/usuarios` | `usuarios/page.tsx` | Gestión de usuarios | Sí |
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

La aplicación móvil está **parcialmente implementada**. La carpeta `mobile/` contiene código funcional con las pantallas principales del cobrador: login, agenda, mapa de ruta, gestión de visitas y mensajería.

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
| **Mensajería** | `MensajesScreen.tsx` | Implementado |
| **Descansos** | `DescansoScreen.tsx` | Implementado |

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

**Funcionalidades planificadas:**
- Registro de empresa (nombre, RUC, dirección, teléfono, email).
- Activación/desactivación de empresas.
- Visualización de métricas por empresa.

### 10.2 Módulo de Clientes

Gestiona los deudores de cada empresa.

**Funcionalidades planificadas:**
- Registro con datos personales y de contacto.
- Historial de créditos por cliente.
- Estado del cliente (activo/inactivo/moroso).

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

### 10.5 Módulo de Gestiones

Historial de actividad de los cobradores en campo.

**Funcionalidades planificadas:**
- Registro de cada intento de cobro con resultado, observación y GPS.
- Adjuntar foto de comprobante.
- Línea de tiempo de gestiones por cuota.

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

**Reportes planificados:**
- Cobranzas del período (diario, semanal, mensual).
- Índice de morosidad por empresa.
- Desempeño de cobradores (cuotas asignadas vs cobradas).
- Cuotas por vencer (próximos 7, 15, 30 días).
- Exportación a PDF y Excel.

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

### 12.2 Flujo de asignación y cobro (planificado)

```
SUPERVISOR (web):
1. Ingresa al módulo de Cobranzas
2. Filtra cuotas pendientes o vencidas
3. Selecciona cuota(s) y asigna a un cobrador
4. El sistema registra la asignación y notifica al cobrador

COBRADOR (móvil):
5. Recibe notificación push de nueva asignación
6. Abre la app y ve la cuota en "Mis asignaciones"
7. Va a la dirección del cliente
8. Registra la gestión:
   → Resultado, observación, GPS automático
9. Si cobró: registra monto y método de pago
10. El sistema actualiza el estado de la cuota a PAGADA

SUPERVISOR (web):
11. Ve en tiempo real el estado de las asignaciones
12. Genera reporte al final del día
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

# 5. Ejecutar los scripts SQL de la carpeta /database/

# 6. Iniciar el servidor
node src/app.js
# o con nodemon para desarrollo:
npx nodemon src/app.js
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
