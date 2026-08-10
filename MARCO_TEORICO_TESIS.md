# Marco Teórico — cobrApp
## Sistema de Gestión de Cobranzas Multiempresa
    
> **Autor:** Rivaldo Andrés Zarate Samaniego  
> **Tutor:** Ing. Aldo Federico Ávalos  
> **Institución:** Universidad Católica Nuestra Señora de la Asunción — Unidad Pedagógica Carapeguá  
> **Carrera:** Ingeniería Informática  
> **Año:** 2026

---

## Tabla de Contenidos

1. [Sistemas de Información](#1-sistemas-de-información)
2. [Gestión de Cobranzas](#2-gestión-de-cobranzas)
3. [Arquitectura de Software](#3-arquitectura-de-software)
4. [Arquitectura Multiempresa (Multi-Tenant)](#4-arquitectura-multiempresa-multi-tenant)
5. [Tecnologías de Desarrollo Web](#5-tecnologías-de-desarrollo-web)
6. [Desarrollo de Aplicaciones Móviles](#6-desarrollo-de-aplicaciones-móviles)
7. [Bases de Datos Relacionales](#7-bases-de-datos-relacionales)
8. [APIs REST](#8-apis-rest)
9. [Seguridad Informática en Aplicaciones Web](#9-seguridad-informática-en-aplicaciones-web)
10. [Geolocalización y Mapas](#10-geolocalización-y-mapas)
11. [Control de Acceso Basado en Roles (RBAC)](#11-control-de-acceso-basado-en-roles-rbac)
12. [Notificaciones y Comunicación en Tiempo Real](#12-notificaciones-y-comunicación-en-tiempo-real)
13. [Optimización de Rutas y Problema del Viajante](#13-optimización-de-rutas-y-problema-del-viajante)
14. [Estado del Arte](#14-estado-del-arte)
15. [Definición de Términos Básicos](#15-definición-de-términos-básicos)
16. [Marco Metodológico](#capítulo-iii-marco-metodológico)

---

## 1. Sistemas de Información

### 1.1 Definición

Un sistema de información (SI) es un conjunto de componentes interrelacionados que recolectan, procesan, almacenan y distribuyen información para apoyar la toma de decisiones, la coordinación y el control en una organización (Laudon & Laudon, 2020). En el contexto empresarial moderno, los SI se han convertido en herramientas indispensables para la gestión eficiente de los procesos operativos y estratégicos.

### 1.2 Componentes de un Sistema de Información

Según Kendall & Kendall (2019), todo sistema de información está compuesto por cinco elementos fundamentales:

1. **Hardware:** Equipos físicos necesarios para el funcionamiento del sistema (servidores, dispositivos móviles, estaciones de trabajo).
2. **Software:** Programas y aplicaciones que procesan los datos (sistemas operativos, aplicaciones empresariales, middleware).
3. **Datos:** Hechos en bruto que son procesados para generar información útil.
4. **Procedimientos:** Reglas y políticas que definen cómo debe operar el sistema.
5. **Personas:** Usuarios finales, administradores y personal de soporte que interactúan con el sistema.

### 1.3 Sistemas de Información en la Gestión Empresarial

Los sistemas de información empresariales se clasifican según el nivel organizacional al que sirven (O'Brien & Marakas, 2018):

- **Sistemas de Procesamiento de Transacciones (TPS):** Registran las transacciones diarias del negocio. En cobrApp, el registro de cobros y la gestión de visitas constituyen TPS.
- **Sistemas de Información Gerencial (MIS):** Proveen reportes resumidos para la toma de decisiones. El dashboard y los reportes de cobranzas de cobrApp pertenecen a esta categoría.
- **Sistemas de Soporte a Decisiones (DSS):** Ayudan en decisiones semiestructuradas mediante análisis de datos. Los reportes de desempeño de cobradores y análisis de morosidad son ejemplos de DSS.

### 1.4 Importancia en el Sector de Cobranzas

En el sector de cobranzas, los sistemas de información permiten:

- Centralizar la información de deudores y créditos.
- Automatizar el cálculo de intereses y saldos.
- Registrar el historial completo de gestiones de cobro.
- Generar reportes de eficiencia por cobrador.
- Reducir errores humanos en el registro manual de pagos.
- Proveer visibilidad en tiempo real a la gerencia.

---

## 2. Gestión de Cobranzas

### 2.1 Definición y Alcance

La gestión de cobranzas es el conjunto de procesos administrativos y operativos destinados a recuperar los créditos otorgados por una organización a sus clientes, minimizando la morosidad y optimizando el flujo de caja (Bragg, 2019). Esta función es crítica para la salud financiera de cualquier empresa que opere con ventas a crédito.

### 2.2 Ciclo de Vida de una Cobranza

El proceso de cobranza atraviesa las siguientes etapas (Sagner, 2020):

1. **Otorgamiento del crédito:** Evaluación y aprobación del financiamiento al cliente.
2. **Generación de cuotas:** División del monto total en pagos periódicos con fechas de vencimiento.
3. **Asignación:** Distribución de las cuotas entre los cobradores según zona geográfica o cartera.
4. **Gestión de cobro:** Ejecución de las visitas o llamadas para recuperar el dinero.
5. **Registro de pago:** Actualización del sistema cuando el cliente abona total o parcialmente.
6. **Seguimiento:** Monitoreo de cuotas vencidas y acciones de recuperación.
7. **Cierre:** Cancelación del crédito una vez pagadas todas las cuotas.

### 2.3 Modalidades de Cobranza

Existen diversas modalidades de cobranza que pueden combinarse en un mismo sistema:

| Modalidad | Descripción | Ventajas | Desventajas |
|---|---|---|---|
| **Cobranza en campo** | Cobrador visita al deudor en su domicilio o negocio | Contacto personal, mayor tasa de cobro | Alto costo operativo, menor productividad |
| **Cobranza telefónica** | Gestión a través de llamadas | Bajo costo, alta cobertura | Menor efectividad, fácil de evadir |
| **Cobranza digital** | Recordatorios por SMS, email o notificaciones push | Mínimo costo, automatizable | Baja personalización |
| **Cobranza judicial** | Acciones legales para recuperar la deuda | Alta efectividad | Alto costo, proceso lento |

### 2.4 Indicadores Clave de Desempeño (KPIs)

Los principales indicadores en la gestión de cobranzas son (Cárdenas, 2021):

- **Índice de Morosidad (IM):** Porcentaje de cuotas vencidas sobre el total de cuotas activas.
- **Efectividad de Cobro (EC):** Porcentaje de cuotas cobradas sobre las cuotas gestionadas en un período.
- **Rotación de Cartera:** Velocidad con que se recuperan los créditos otorgados.
- **Cobertura de Cobro:** Porcentaje de cuotas asignadas que efectivamente reciben una visita de gestión.
- **Costo por Gestión:** Costo operativo dividido entre el número de gestiones realizadas.
- **Tasa de Reagendamiento:** Porcentaje de visitas que resultan en una reprogramación.

### 2.5 Desafíos de la Gestión de Cobranzas en Paraguay

En el contexto paraguayo, la gestión de cobranzas enfrenta desafíos particulares:

- **Alta informalidad:** Muchas pequeñas y medianas empresas llevan registros manuales o en planillas electrónicas sin sistematizar.
- **Baja penetración bancaria:** Una porción significativa de la población no tiene acceso a medios de pago electrónicos, lo que obliga a la cobranza en efectivo en campo.
- **Dispersión geográfica:** Los clientes deudores pueden estar distribuidos en zonas rurales o periurbanas de difícil acceso.
- **Ausencia de burós de crédito integrados:** La información crediticia no siempre está centralizada, lo que dificulta la evaluación de riesgos.
- **Estacionalidad económica:** Los ciclos agrícolas y comerciales afectan la capacidad de pago de los deudores.

---

## 3. Arquitectura de Software

### 3.1 Definición

La arquitectura de software es la estructura fundamental de un sistema de software, compuesta por sus componentes, las relaciones entre ellos y las propiedades externas visibles de esos componentes (Bass, Clements & Kazman, 2022). Define cómo se organiza el sistema para cumplir con los requisitos funcionales y no funcionales.

### 3.2 Arquitectura Cliente-Servidor en Tres Capas

cobrApp implementa una **arquitectura cliente-servidor en tres capas**, que es uno de los patrones arquitectónicos más utilizados en aplicaciones empresariales modernas (Fowler, 2018).

```
┌──────────────────────────────────────────────────────────┐
│                CAPA DE PRESENTACIÓN (Cliente)            │
│  ● Panel Web (Next.js) — Administradores y supervisores │
│  ● App Móvil (React Native) — Cobradores en campo       │
├──────────────────────────────────────────────────────────┤
│                CAPA DE NEGOCIO (Servidor)                 │
│  ● API REST (Node.js + Express)                         │
│  ● Controladores, servicios, middlewares                │
│  ● Lógica de autenticación y autorización               │
├──────────────────────────────────────────────────────────┤
│                CAPA DE DATOS                              │
│  ● MySQL 8.x                                             │
│  ● Pool de conexiones con consultas parametrizadas      │
└──────────────────────────────────────────────────────────┘
```

#### Ventajas de este enfoque:

1. **Separación de responsabilidades:** Cada capa tiene una función específica y bien definida.
2. **Escalabilidad:** Las capas pueden escalarse de forma independiente según la demanda.
3. **Mantenibilidad:** Los cambios en una capa no afectan directamente a las otras.
4. **Reutilización:** La capa de negocio puede servir a múltiples clientes (web y móvil).
5. **Seguridad:** La capa de datos no es accesible directamente desde los clientes.

### 3.3 Patrón MVC (Modelo-Vista-Controlador)

El backend de cobrApp adapta el patrón **MVC (Model-View-Controller)** al contexto de APIs REST (Gamma et al., 1994):

- **Modelo (M):** Representa los datos y la lógica de negocio. En cobrApp, las tablas de MySQL gestionadas mediante consultas SQL parametrizadas.
- **Vista (V):** En una API REST, la "vista" es la representación JSON que se envía al cliente. La vista real está en los frontends web y móvil.
- **Controlador (C):** Archivos en `controllers/` que manejan las peticiones HTTP, ejecutan la lógica de negocio y devuelven respuestas.

### 3.4 Principios SOLID en cobrApp

El sistema aplica implícitamente varios principios SOLID (Martin, 2017):

- **Responsabilidad Única (SRP):** Cada controlador se enfoca en una entidad del dominio (usuarios, clientes, cobranzas).
- **Abierto/Cerrado (OCP):** El middleware de autenticación permite extender validaciones sin modificar su estructura base.
- **Segregación de Interfaces (ISP):** Las rutas se separan por módulo funcional (auth, panel, cobrador).
- **Inversión de Dependencias (DIP):** El pool de conexiones a la base de datos se inyecta como dependencia en los controladores.

---

## 4. Arquitectura Multiempresa (Multi-Tenant)

### 4.1 Definición

La arquitectura multiempresa (multi-tenant) es un enfoque de diseño de software donde una única instancia del sistema sirve a múltiples organizaciones (tenants) de forma simultánea, manteniendo el aislamiento de datos entre ellas (Bond, 2021).

### 4.2 Estrategias de Aislamiento

Existen tres estrategias principales para implementar multi-tenancy:

| Estrategia | Descripción | Ventajas | Desventajas |
|---|---|---|---|
| **Base de datos separada** | Cada tenant tiene su propia BD | Máximo aislamiento, fácil backup | Alto costo de infraestructura |
| **Esquema separado** | Misma BD, esquemas separados | Aislamiento medio, administración centralizada | Complejidad en migraciones |
| **Fila compartida** | Misma BD y mismas tablas, filas identificadas por `tenant_id` | Mínimo costo, fácil escalabilidad | Mayor complejidad en consultas |

cobrApp implementa la estrategia de **fila compartida** con la columna `empresa_id` como identificador de tenant en todas las tablas relevantes. Esta estrategia fue seleccionada porque:

1. Minimiza los costos de infraestructura al utilizar una sola base de datos.
2. Facilita las migraciones y actualizaciones del esquema.
3. Permite escalar horizontalmente con relativa facilidad.
4. Es la estrategia más adecuada para un sistema SaaS dirigido a PyMEs.

### 4.3 Desafíos de la Arquitectura Multiempresa

La implementación de multi-tenancy presenta desafíos técnicos importantes:

1. **Aislamiento de datos:** Garantizar que un tenant no acceda a datos de otro. En cobrApp, se resuelve filtrando todas las consultas por `empresa_id` del usuario autenticado.
2. **Personalización:** Cada tenant puede requerir configuraciones específicas (tipos de descanso, horarios, medios de pago).
3. **Rendimiento:** Las consultas deben ejecutarse eficientemente a pesar del volumen agregado de todos los tenants. Se utilizan índices compuestos que incluyen `empresa_id`.
4. **Backup y recuperación:** Al compartir la misma BD, la recuperación de un tenant afecta a todos. Se requiere una estrategia de backup regular.

### 4.4 Multiempresa en el Contexto de Cobranzas

En cobrApp, el modelo multiempresa permite:

- Que una misma instalación del sistema sea utilizada por múltiples empresas crediticias.
- Que los cobradores trabajen exclusivamente para la empresa que los contrató.
- Que los supervisores gestionen únicamente los cobradores de su empresa.
- Que el administrador global (ADMIN) pueda supervisar todas las empresas desde un mismo panel.

---

## 5. Tecnologías de Desarrollo Web

### 5.1 Node.js

Node.js es un entorno de ejecución de JavaScript del lado del servidor, construido sobre el motor V8 de Google Chrome. Utiliza un modelo de E/S sin bloqueo y orientado a eventos, lo que lo hace ligero y eficiente para aplicaciones en tiempo real con muchos datos (Tilkov & Vinoski, 2020).

**Características relevantes para cobrApp:**

- **Modelo asíncrono:** Maneja múltiples peticiones simultáneas sin bloquear el hilo principal, ideal para un sistema que atiende a múltiples cobradores en campo.
- **npm (Node Package Manager):** El ecosistema de paquetes más grande del mundo, con más de 2 millones de módulos disponibles.
- **Event Loop:** Permite manejar operaciones de E/S (base de datos, archivos, red) de forma no bloqueante.
- **Streaming:** Procesamiento eficiente de archivos grandes, como la importación de Excel de clientes.

### 5.2 Express.js

Express.js es un framework web minimalista y flexible para Node.js que proporciona un conjunto robusto de características para construir aplicaciones web y APIs (Mardan, 2019). Es el framework más popular del ecosistema Node.js.

**Funcionalidades implementadas en cobrApp:**

- **Enrutamiento:** Definición de rutas REST mediante verbos HTTP (GET, POST, PUT, DELETE).
- **Middleware:** Pipeline de procesamiento de peticiones (autenticación, logs, CORS, subida de archivos).
- **Manejo de errores:** Captura centralizada de excepciones.
- **Servicio de archivos estáticos:** Publicación de imágenes de evidencias subidas desde el móvil.

### 5.3 Next.js

Next.js es un framework de React para producción que proporciona renderizado del lado del servidor (SSR), generación de sitios estáticos (SSG) y renderizado del lado del cliente (CSR), todo en un mismo proyecto (Vercel, 2024).

**Ventajas para cobrApp:**

- **App Router:** Sistema de enrutamiento basado en el sistema de archivos, intuitivo y escalable.
- **Server-Side Rendering (SSR):** Las páginas se renderizan en el servidor, mejorando el SEO y la velocidad de carga inicial.
- **Renderizado híbrido:** Combina SSR para páginas dinámicas (dashboard) con CSR para componentes interactivos (mapas, formularios).
- **TypeScript nativo:** Soporte completo para TypeScript sin configuración adicional.
- **Optimizaciones automáticas:** Code splitting, lazy loading de imágenes y componentes.

### 5.4 React

React es una biblioteca de JavaScript para construir interfaces de usuario, desarrollada por Meta (Facebook). Se basa en el concepto de componentes reutilizables y un DOM virtual que optimiza las actualizaciones de la interfaz (Banks & Porcello, 2022).

**Conceptos fundamentales aplicados en cobrApp:**

- **Componentes:** Unidades independientes y reutilizables de la interfaz (PanelShell, MapaVisitas, MapPolygonPicker).
- **Hooks:** Funciones que permiten usar estado y otras características de React sin escribir clases (useAuth, useInactivityLogout).
- **Estado:** Manejo de datos que cambian en el tiempo, combinando estado local y persistencia en localStorage.
- **Efectos secundarios:** Operaciones como peticiones HTTP, temporizadores y suscripciones.

### 5.5 TypeScript

TypeScript es un superconjunto de JavaScript que añade tipado estático opcional. Permite detectar errores en tiempo de compilación, mejorar la documentación del código y facilitar el mantenimiento en proyectos grandes (Cherny, 2019).

**Beneficios en cobrApp:**

- **Interfaces y tipos:** Definen la forma de los datos (Empresa, Cliente, Usuario, Cuota) evitando errores de estructura.
- **Autocompletado:** Los editores de código pueden sugerir propiedades y métodos válidos.
- **Refactorización segura:** Los cambios en tipos se propagan automáticamente, detectando inconsistencias.
- **Documentación viva:** Los tipos sirven como documentación ejecutable del modelo de datos.

### 5.6 Tailwind CSS

Tailwind CSS es un framework de CSS utilitario que permite construir interfaces personalizadas rápidamente mediante clases predefinidas en el HTML/JSX (Tailwind Labs, 2024).

**Ventajas en cobrApp:**

- **Desarrollo rápido:** Las interfaces se construyen combinando clases utilitarias sin escribir CSS personalizado.
- **Consistencia visual:** Sistema de diseño unificado (colores, espaciados, tipografía) aplicado en todo el panel.
- **Responsive design:** Clases prefijadas para diferentes tamaños de pantalla.
- **Tamaño de producción mínimo:** Purge automático de clases no utilizadas en build de producción.

---

## 6. Desarrollo de Aplicaciones Móviles

### 6.1 React Native

React Native es un framework de desarrollo de aplicaciones móviles creado por Meta que permite construir apps nativas para iOS y Android utilizando JavaScript y React (Eisenman, 2020). A diferencia de las aplicaciones híbridas (web views), React Native compila a componentes nativos reales.

**Arquitectura de React Native:**

```
JavaScript (React)
      │
      ▼
  Bridge (comunicación asíncrona)
      │
      ▼
  Hilos nativos (iOS/Android)
      │
      ▼
  Componentes nativos (UIView, Activity, etc.)
```

### 6.2 Expo Framework

Expo es un conjunto de herramientas y servicios construidos alrededor de React Native que simplifica significativamente el desarrollo de aplicaciones móviles (Expo, 2025).

**Ventajas de Expo para cobrApp:**

- **SDK unificado:** Acceso a APIs nativas (GPS, cámara, notificaciones, sistema de archivos) sin configuración nativa.
- **Expo Go:** Aplicación sandbox que permite probar cambios en tiempo real sin compilar.
- **Over-the-air updates:** Actualización de la app sin pasar por las tiendas de aplicaciones.
- **Ecosistema integrado:** Build, deploy y actualizaciones gestionados desde una misma plataforma.
- **Comunidad activa:** Documentación extensa y paquetes mantenidos por el equipo de Expo.

### 6.3 Exposición de APIs Nativas

cobrApp utiliza las siguientes APIs nativas a través de Expo:

| API | Uso en cobrApp |
|---|---|
| **expo-location** | Captura de coordenadas GPS al registrar una visita. Verificación de que el cobrador está en la ubicación del cliente. |
| **expo-image-picker** | Toma de fotos de comprobantes de pago desde la cámara del dispositivo. |
| **expo-notifications** | Envío de notificaciones locales para recordatorios de visitas reagendadas. |
| **react-native-maps** | Visualización de mapa con marcadores de clientes y ruta optimizada del cobrador. |
| **AsyncStorage** | Almacenamiento seguro del token JWT y datos de sesión en el dispositivo. |

### 6.4 Navegación en Aplicaciones Móviles

La navegación en la app móvil se gestiona mediante **@react-navigation/native-stack**, que proporciona una experiencia de navegación por pilas (stack) similar a la navegación nativa de iOS y Android (React Navigation, 2024). El flujo de pantallas en cobrApp es:

```
LoginScreen
    │
    ▼
AgendaScreen (lista de visitas del día)
    │
    ├──► VisitaScreen (registrar gestión de cobro)
    │
    ├──► MapaRutaScreen (ruta optimizada del cobrador)
    │
    ├──► MensajesScreen (chat con supervisores)
    │
    └──► DescansoScreen (gestión de descansos)
```

---

## 7. Bases de Datos Relacionales

### 7.1 Definición

Una base de datos relacional (RDBMS) es un conjunto de datos organizados en tablas relacionadas entre sí mediante claves primarias y foráneas. El modelo relacional fue propuesto por Edgar F. Codd en 1970 y sigue siendo el paradigma dominante para aplicaciones empresariales (Date, 2019).

### 7.2 MySQL

MySQL es un sistema de gestión de bases de datos relacional de código abierto, ampliamente utilizado en aplicaciones web. Desde la versión 8, MySQL incluye mejoras significativas en rendimiento, seguridad y soporte para JSON (Oracle, 2023).

**Características clave para cobrApp:**

- **Transacciones ACID:** Atomicidad, Consistencia, Aislamiento y Durabilidad garantizados con InnoDB.
- **Consultas parametrizadas:** Prevención de SQL Injection mediante placeholders `?` en las consultas.
- **Índices:** Optimización de búsquedas mediante índices compuestos y únicos.
- **ENUMs:** Tipos de datos restringidos para campos con valores predefinidos (estados de cuotas, roles).
- **FOREIGN KEY:** Integridad referencial entre tablas relacionadas.
- **Pool de conexiones:** Gestión eficiente de conexiones concurrentes mediante `mysql2/promise`.

### 7.3 Modelo Entidad-Relación de cobrApp

El modelo de datos de cobrApp se estructura en torno a las siguientes entidades principales:

```
empresas ──── usuarios ──── roles
    │
    ├── clientes_empresas ──── clientes (global)
    ├── zonas
    ├── creditos ──── cuotas ──── asignaciones ──── visitas_cobro
    ├── tipos_descanso ──── descansos_cobrador
    ├── horarios_cobrador ──── excepciones_horario
    └── mensajes
```

### 7.4 Normalización de Base de Datos

El diseño de la base de datos de cobrApp aplica los principios de normalización para minimizar la redundancia y evitar anomalías (Date, 2019):

- **Primera Forma Normal (1FN):** Todos los atributos son atómicos. No hay grupos repetitivos.
- **Segunda Forma Normal (2FN):** Cada atributo no clave depende completamente de la clave primaria.
- **Tercera Forma Normal (3FN):** No hay dependencias transitivas entre atributos no clave.

Un ejemplo de diseño normalizado es la separación de `clientes` (tabla global de personas) y `clientes_empresas` (relación cliente-empresa con datos específicos), que evita la duplicación de datos personales cuando un cliente tiene créditos en múltiples empresas.

### 7.5 Índices y Optimización de Consultas

Los índices son estructuras de datos que mejoran la velocidad de las operaciones de búsqueda a costa de espacio adicional en disco y tiempo de escritura (Schwartz et al., 2019). En cobrApp, los índices críticos incluyen:

- `idx_asignacion_cobrador_fecha`: Búsqueda rápida de asignaciones por cobrador y fecha.
- `idx_visita_asignacion`: Recuperación eficiente del historial de visitas por asignación.
- `idx_cuota_estado_vencimiento`: Identificación de cuotas vencidas para reportes y alertas.

---

## 8. APIs REST

### 8.1 Definición y Principios

REST (Representational State Transfer) es un estilo arquitectónico para diseñar servicios web que utilizan el protocolo HTTP de forma nativa (Fielding, 2000). Una API RESTful expone recursos del sistema como URLs y permite operar sobre ellos mediante los verbos HTTP estándar.

### 8.2 Principios REST aplicados en cobrApp

1. **Recursos identificados por URLs:** Cada entidad tiene una URL única (`/api/usuarios`, `/api/clientes`, `/api/cobranzas`).
2. **Verbos HTTP estándar:** GET (leer), POST (crear), PUT (actualizar), DELETE (eliminar).
3. **Representaciones:** Los recursos se representan en formato JSON.
4. **Stateless:** Cada petición contiene toda la información necesaria para ser procesada (el token JWT en el header).
5. **HATEOAS (parcial):** Las respuestas incluyen enlaces a recursos relacionados cuando corresponde.

### 8.3 Estructura de Endpoints

La API de cobrApp se organiza en los siguientes grupos de endpoints:

| Grupo | Prefijo | Propósito |
|---|---|---|
| Autenticación | `/api/auth` | Registro y login de usuarios |
| Panel web | `/api/` | CRUD de entidades y reportes |
| Móvil | `/api/mobile/` | Endpoints específicos para la app de cobradores |

### 8.4 Formato de Respuestas

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

### 8.5 Middleware en Express

El middleware es una función que se ejecuta durante el ciclo de petición-respuesta de Express. En cobrApp se implementan:

- **authenticateToken:** Verifica la validez del token JWT en cada ruta protegida.
- **roleCheck:** Middleware factory que valida que el usuario tenga el rol requerido.
- **cors:** Habilita el intercambio de recursos entre orígenes (configurable por entorno).
- **multer:** Procesa archivos subidos (fotos de comprobantes, importación Excel).

---

## 9. Seguridad Informática en Aplicaciones Web

### 9.1 Principios Fundamentales

La seguridad en aplicaciones web se basa en tres principios fundamentales conocidos como la **tríada CIA** (Whitman & Mattord, 2021):

1. **Confidencialidad:** La información solo debe ser accesible por quienes están autorizados.
2. **Integridad:** Los datos no deben ser modificados por personas no autorizadas.
3. **Disponibilidad:** El sistema debe estar accesible cuando los usuarios autorizados lo necesiten.

### 9.2 JWT (JSON Web Tokens)

JWT es un estándar abierto (RFC 7519) que define una forma compacta y autónoma de transmitir información entre partes como un objeto JSON firmado digitalmente (Jones et al., 2015).

```
[Header] . [Payload] . [Signature]
```

**Estructura del token en cobrApp:**

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

**Ventajas del JWT en cobrApp:**

- **Stateless:** No se requiere almacenamiento en servidor de sesiones activas.
- **Portable:** Puede ser utilizado tanto por el panel web como por la app móvil.
- **Seguro:** Firmado con HMAC-SHA256 (HS256) usando una clave secreta.
- **Expiración:** El token tiene una validez limitada (24 horas), tras la cual el usuario debe re-autenticarse.

### 9.3 Bcrypt y Hash de Contraseñas

Bcrypt es una función de hash de contraseñas diseñada por Niels Provos y David Mazières (1999). Se basa en el cifrado Blowfish e incluye un salt integrado para proteger contra ataques de arcoíris (rainbow tables).

**Características de bcrypt:**

- **Salt automático:** Genera un salt aleatorio único para cada contraseña.
- **Costo computacional ajustable:** El factor de trabajo (salt rounds) puede incrementarse para compensar el aumento en la capacidad de cómputo.
- **Hash de longitud fija:** Siempre produce un string de 60 caracteres.

En cobrApp, se utilizan **10 salt rounds**, lo que representa un equilibrio entre seguridad y rendimiento. Cada hash toma aproximadamente 0.1 segundos en hardware moderno, lo suficiente para dificultar ataques de fuerza bruta sin afectar la experiencia del usuario.

### 9.4 Prevención de SQL Injection

La inyección SQL (SQL Injection) es una técnica de ataque en la que un atacante inserta código SQL malicioso en los parámetros de entrada de una aplicación (OWASP, 2023). Es una de las vulnerabilidades más críticas en aplicaciones web.

**Mecanismos de prevención en cobrApp:**

- **Consultas parametrizadas:** Uso de placeholders `?` que separan los datos del código SQL.
- **mysql2 con Promises:** El driver maneja automáticamente el escape de parámetros.
- **Validación en backend:** Verificación de tipos y formatos antes de ejecutar consultas.

**Ejemplo de consulta parametrizada:**
```javascript
const [usuario] = await pool.query(
  'SELECT * FROM usuarios WHERE email = ? AND estado = 1',
  [email]
);
```

### 9.5 OWASP Top 10 y Mitigaciones

| Categoría OWASP | Riesgo | Mitigación en cobrApp |
|---|---|---|
| A01: Broken Access Control | Acceso no autorizado a datos | Middleware de roles, filtrado por `empresa_id` |
| A02: Cryptographic Failures | Exposición de datos sensibles | bcrypt para contraseñas, JWT firmado |
| A03: Injection | SQL, NoSQL, OS injection | Consultas parametrizadas |
| A04: Insecure Design | Fallos en diseño de seguridad | Arquitectura multiempresa con aislamiento |
| A05: Security Misconfiguration | Configuraciones inseguras | Variables de entorno, CORS configurable |
| A06: Vulnerable Components | Dependencias desactualizadas | npm audit, actualizaciones periódicas |
| A07: Authentication Failures | Fallos de autenticación | JWT con expiración, cambio obligatorio de contraseña |
| A08: Data Integrity Failures | Manipulación de datos | Firma JWT, transacciones ACID |
| A09: Logging Failures | Falta de auditoría | Logs de peticiones (morgan) |
| A10: SSRF | Falsificación de peticiones del lado del servidor | Validación de URLs en importaciones |

---

## 10. Geolocalización y Mapas

### 10.1 Sistemas de Información Geográfica (SIG)

Un Sistema de Información Geográfica (SIG) es un conjunto de herramientas que integra hardware, software y datos para capturar, gestionar, analizar y visualizar información georreferenciada (Longley et al., 2015). En el contexto de cobrApp, los SIG permiten asociar cada visita de cobro con coordenadas geográficas precisas.

### 10.2 Coordenadas GPS y Fórmula de Haversine

El Sistema de Posicionamiento Global (GPS) proporciona coordenadas geográficas (latitud y longitud) que representan la ubicación exacta de un punto sobre la superficie terrestre.

La **fórmula de Haversine** calcula la distancia entre dos puntos en una esfera a partir de sus latitudes y longitudes (Veness, 2010):

$$d = 2r \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$

Donde:
- $d$ = distancia entre los puntos
- $r$ = radio de la Tierra (6,371 km)
- $\phi_1, \phi_2$ = latitudes de los puntos (en radianes)
- $\lambda_1, \lambda_2$ = longitudes de los puntos (en radianes)
- $\Delta\phi = \phi_2 - \phi_1$
- $\Delta\lambda = \lambda_2 - \lambda_1$

### 10.3 Leaflet y OpenStreetMap

Leaflet es una biblioteca de mapas interactivos de código abierto para el lado del cliente. Utiliza tiles de OpenStreetMap, un proyecto colaborativo que crea y distribuye datos geográficos gratuitos (Agafonkin, 2024).

**Uso en cobrApp (Panel Web):**

- Visualización de visitas georreferenciadas en `/mapa`.
- Marcadores con colores según el resultado de la gestión (cobrado, ausente, reagendado).
- Popups con información detallada de cada visita.
- Carga diferida con `dynamic import` para evitar errores de SSR en Next.js.

### 10.4 react-native-maps

react-native-maps es un componente que proporciona mapas nativos tanto en iOS (Apple Maps) como en Android (Google Maps) para aplicaciones React Native (Miller, 2024).

**Uso en cobrApp (App Móvil):**

- Visualización de la ruta del cobrador con marcadores de clientes.
- Navegación punto a punto con integración a Google Maps.
- Visualización de la ubicación actual del cobrador mediante `expo-location`.

### 10.5 OSRM (Open Source Routing Machine)

OSRM es un motor de enrutamiento de código abierto que calcula rutas por calles utilizando datos de OpenStreetMap (Luxen & Vetter, 2011). Ofrece una API pública gratuita para proyectos de pequeña escala.

**Uso en cobrApp:**
- Cálculo de la ruta real por calles entre las paradas del cobrador.
- Obtención de polilíneas (polyline) para dibujar la ruta en el mapa.
- Fallback a líneas rectas entre puntos cuando no hay conexión a OSRM.

---

## 11. Control de Acceso Basado en Roles (RBAC)

### 11.1 Definición

El Control de Acceso Basado en Roles (RBAC) es un enfoque de control de acceso en el que los permisos se asignan a roles en lugar de a usuarios individuales. Cada usuario recibe uno o más roles, y a través de ellos hereda los permisos correspondientes (Sandhu et al., 1996).

### 11.2 Modelo RBAC en cobrApp

cobrApp implementa un modelo RBAC con tres roles, siguiendo el principio de **privilegio mínimo** (least privilege):

```
                           ┌─────────────────┐
                           │     ADMIN       │
                           │  Acceso total   │
                           └────────┬────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
            ┌─────────────────┐           ┌─────────────────┐
            │   SUPERVISOR    │           │    COBRADOR     │
            │  Gestión local  │           │  Solo operativo │
            └─────────────────┘           └─────────────────┘
```

### 11.3 Matriz de Permisos

| Recurso | ADMIN | SUPERVISOR | COBRADOR |
|---|---|---|---|
| Todas las empresas | ✅ | ❌ (solo la suya) | ❌ (solo la suya) |
| Crear/editar empresas | ✅ | ❌ | ❌ |
| Usuarios ADMIN | Crear/editar | ❌ | ❌ |
| Usuarios SUPERVISOR | Crear/editar | ✅ (su empresa) | ❌ |
| Usuarios COBRADOR | Crear/editar | ✅ (su empresa) | ❌ |
| Asignar cobranzas | ✅ | ✅ | ❌ |
| Registrar gestiones | ✅ | ✅ | ✅ |
| Ver reportes | ✅ | ✅ (su empresa) | ❌ |
| App móvil (gestiones) | ❌ | ❌ | ✅ |

### 11.4 Implementación Técnica

La verificación de roles se implementa mediante un **middleware factory** en Express:

```javascript
const roleCheck = (...rolesPermitidos) => {
    return (req, res, next) => {
        const userRole = req.user.rol;
        if (!rolesPermitidos.includes(userRole)) {
            return res.status(403).json({
                message: 'No tenés permisos para realizar esta acción'
            });
        }
        next();
    };
};
```

Además del middleware, cada controlador ejecuta las consultas filtrando por `empresa_id` del usuario autenticado, lo que garantiza el aislamiento de datos incluso a nivel de base de datos.

---

## 12. Notificaciones y Comunicación en Tiempo Real

### 12.1 Modelo Pull vs. Push

Existen dos modelos principales para la comunicación entre cliente y servidor:

| Modelo | Descripción | Ventajas | Desventajas |
|---|---|---|---|
| **Pull (Polling)** | El cliente consulta periódicamente al servidor | Simple de implementar, compatible con REST | Mayor tráfico de red, latencia |
| **Push (WebSocket/SSE)** | El servidor envía datos al cliente cuando cambian | Tiempo real, menor tráfico | Mayor complejidad, requiere conexión persistente |

### 12.2 Polling en cobrApp

El sistema de mensajería de cobrApp utiliza **polling REST** para la actualización de mensajes. El frontend ejecuta un `setInterval` que consulta periódicamente los mensajes no leídos. Esta decisión se basó en:

1. **Simplicidad técnica:** No requiere infraestructura adicional (WebSocket, Socket.io).
2. **Compatibilidad:** Funciona sin problemas en todos los entornos (web y móvil).
3. **Volumen manejable:** La frecuencia de mensajes en el contexto de cobranzas no requiere latencia de milisegundos.

### 12.3 Node-Cron

node-cron es una librería que permite programar tareas (cron jobs) en Node.js. Se utiliza en cobrApp para:

- **Activación automática de descansos:** A la hora configurada, el sistema activa el descanso de almuerzo del cobrador si no lo ha iniciado manualmente.
- **Tareas planificadas:** Potencialmente, marcado automático de cuotas como vencidas al superar la fecha límite.

### 12.4 Notificaciones Push en Móvil

expo-notifications permite el envío de notificaciones locales y remotas en aplicaciones Expo (Expo, 2025). En cobrApp, se utiliza para:

- Recordatorios de visitas reagendadas (notificaciones locales programadas).
- (Planificado) Alertas de nuevas asignaciones desde el panel web.

---

## 13. Optimización de Rutas y Problema del Viajante

### 13.1 Problema del Viajante (TSP)

El Problema del Viajante (Traveling Salesman Problem, TSP) es un problema clásico de optimización combinatoria en el que se busca encontrar la ruta más corta que visite un conjunto de puntos exactamente una vez y regrese al punto de origen (Lawler et al., 1985). Es un problema NP-difícil, lo que significa que no existe una solución exacta eficiente para un número grande de puntos.

### 13.2 Algoritmo del Vecino Más Cercano

cobrApp implementa el algoritmo **Nearest Neighbor (Vecino Más Cercano)** como heurística para resolver el TSP en el contexto del cobrador:

1. Comenzar desde la ubicación actual del cobrador.
2. Marcar todas las paradas como "no visitadas".
3. Mientras haya paradas no visitadas:
   a. Encontrar la parada no visitada más cercana.
   b. Agregarla a la ruta.
   c. Marcarla como visitada.
4. Retornar la secuencia de paradas.

**Complejidad:** $O(n^2)$, donde $n$ es el número de paradas.

**Ventajas en el contexto de cobranzas:**
- Ejecución rápida incluso con 50-100 paradas.
- Solución "suficientemente buena" para rutas de cobro.
- No requiere infraestructura de servidor (se ejecuta en el dispositivo móvil).

### 13.3 Fórmula de Haversine

Para calcular la distancia entre dos puntos geográficos en el algoritmo TSP, se utiliza la fórmula de Haversine (ver sección 10.2), que proporciona una aproximación precisa de la distancia real sobre la superficie terrestre sin necesidad de conexión a internet.

---

## 14. Estado del Arte

### 14.1 Sistemas de Gestión de Cobranzas en el Mercado

Existen diversas soluciones comerciales y de código abierto para la gestión de cobranzas:

| Producto | Tipo | Plataforma | Multiempresa | Precio |
|---|---|---|---|---|
| **CobrApp** | SaaS propio | Web + Móvil (Expo) | ✅ | - |
| **Gestión de Cobranzas SAP** | ERP | Web | ✅ | $$$ |
| **Cobranzas Oracle** | ERP | Web | ✅ | $$$ |
| **Mambu** | Core bancario | Cloud | ✅ | $$$ |
| **Credit Management (Odoo)** | ERP OSS | Web | ✅ | Gratis/$$ |
| **DebtBook** | SaaS | Web | ✅ | $$ |
| **Kobranza** | SaaS | Web + Móvil | ✅ | $$ |
| **Sheet + WhatsApp** | Manual | - | ❌ | $ |

### 14.2 Limitaciones de las Soluciones Actuales

1. **Alto costo:** Los ERPs corporativos (SAP, Oracle) tienen costos prohibitivos para PyMEs paraguayas.
2. **Complejidad excesiva:** Sistemas como SAP requieren equipos especializados para su implementación y mantenimiento.
3. **Falta de soporte móvil:** Muchas soluciones web no ofrecen app móvil para cobradores en campo.
4. **Escasa personalización local:** Los sistemas internacionales no siempre contemplan las particularidades del mercado paraguayo (medios de pago, moneda, regulaciones).
5. **Dependencia de conexión:** La mayoría requiere conectividad permanente, lo que es problemático en zonas rurales.

### 14.3 Aportación de cobrApp

cobrApp se posiciona como una solución que aborda estas limitaciones mediante:

1. **Arquitectura SaaS multiempresa:** Una sola instalación sirve a múltiples PyMEs, reduciendo costos.
2. **App móvil nativa:** El cobrador puede registrar gestiones, fotos y coordenadas GPS desde su dispositivo.
3. **Optimización de rutas:** Algoritmo TSP integrado que reduce tiempos y costos de traslado.
4. **Operación offline (planificado):** Capacidad de registrar gestiones sin conexión y sincronizar posteriormente.
5. **Tecnología moderna:** Node.js + React Native + Next.js, stack con amplia comunidad y documentación.
6. **Código abierto (potencial):** Posibilidad de auditoría, personalización y mejora continua.

---

## 15. Definición de Términos Básicos

| Término | Definición |
|---|---|
| **API REST** | Interfaz de programación que sigue los principios de Representational State Transfer, permitiendo la comunicación entre sistemas mediante HTTP. |
| **Asignación** | Relación que vincula una cuota específica con un cobrador responsable de gestionar su cobro. |
| **Bcrypt** | Algoritmo de hash de contraseñas que incorpora salt aleatorio y un factor de costo ajustable para proteger contra ataques de fuerza bruta. |
| **Cobrador** | Usuario del sistema que opera desde la aplicación móvil y es responsable de ejecutar las visitas de cobro en campo. |
| **CORS** | Cross-Origin Resource Sharing, mecanismo de seguridad del navegador que controla qué orígenes pueden acceder a los recursos de un servidor. |
| **Cuota** | Cada uno de los pagos periódicos en que se divide un crédito, con un monto, fecha de vencimiento y estado específico. |
| **ENUM** | Tipo de dato en MySQL que restringe los valores de una columna a un conjunto predefinido. |
| **GPS** | Global Positioning System, sistema de navegación por satélite que proporciona información de geolocalización. |
| **JWT** | JSON Web Token, estándar para la transmisión segura de información entre partes mediante tokens firmados digitalmente. |
| **Middleware** | Función en Express.js que se ejecuta durante el ciclo de petición-respuesta, utilizada para autenticación, logs, validación, etc. |
| **Multiempresa (Multi-tenant)** | Arquitectura donde una sola instancia del sistema sirve a múltiples organizaciones manteniendo el aislamiento de datos. |
| **Polling** | Técnica de comunicación en la que el cliente consulta periódicamente al servidor para obtener actualizaciones. |
| **RBAC** | Role-Based Access Control, modelo de seguridad donde los permisos se asignan a roles y los usuarios heredan permisos a través de los roles que poseen. |
| **SaaS** | Software as a Service, modelo de distribución de software donde las aplicaciones son alojadas por un proveedor y puestas a disposición de los clientes a través de internet. |
| **SIG** | Sistema de Información Geográfica, herramienta que integra datos georreferenciados para su captura, análisis y visualización. |
| **SQL Injection** | Vulnerabilidad de seguridad que permite a un atacante ejecutar código SQL malicioso a través de las entradas de una aplicación. |
| **SSR** | Server-Side Rendering, técnica que renderiza las páginas web en el servidor en lugar del navegador del cliente. |
| **TSP** | Traveling Salesman Problem (Problema del Viajante), problema de optimización que busca la ruta más corta para visitar un conjunto de puntos. |
| **Tenant** | Cliente o inquilino en una arquitectura multiempresa, con sus propios datos y configuración aislados de otros tenants. |

---

## Referencias Bibliográficas

Agafonkin, V. (2024). *Leaflet: An Open-Source JavaScript Library for Interactive Maps*. https://leafletjs.com/

Banks, A., & Porcello, E. (2022). *Learning React: Modern Patterns for Developing React Apps* (2nd ed.). O'Reilly Media.

Bass, L., Clements, P., & Kazman, R. (2022). *Software Architecture in Practice* (4th ed.). Addison-Wesley Professional.

Bond, C. (2021). *Multi-Tenant SaaS Patterns*. O'Reilly Media.

Bragg, S. (2019). *Credit and Collection Guidebook* (4th ed.). Accounting Tools.

Cárdenas, L. (2021). *Indicadores de Gestión en Cobranzas*. Editorial Planeta.

Cherny, B. (2019). *Programming TypeScript*. O'Reilly Media.

Date, C. J. (2019). *An Introduction to Database Systems* (8th ed.). Addison-Wesley.

Eisenman, B. (2020). *Learning React Native* (2nd ed.). O'Reilly Media.

Expo. (2025). *Expo Documentation SDK 54*. https://docs.expo.dev/

Fielding, R. T. (2000). *Architectural Styles and the Design of Network-based Software Architectures* [Doctoral dissertation, University of California, Irvine].

Fowler, M. (2018). *Patterns of Enterprise Application Architecture*. Addison-Wesley Professional.

Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.

Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT)*. RFC 7519, IETF.

Kendall, K. E., & Kendall, J. E. (2019). *Systems Analysis and Design* (10th ed.). Pearson.

Laudon, K. C., & Laudon, J. P. (2020). *Management Information Systems: Managing the Digital Firm* (16th ed.). Pearson.

Lawler, E. L., Lenstra, J. K., Rinnooy Kan, A. H. G., & Shmoys, D. B. (1985). *The Traveling Salesman Problem: A Guided Tour of Combinatorial Optimization*. Wiley.

Longley, P. A., Goodchild, M. F., Maguire, D. J., & Rhind, D. W. (2015). *Geographic Information Science and Systems* (4th ed.). Wiley.

Luxen, D., & Vetter, C. (2011). Real-time routing with OpenStreetMap data. *Proceedings of the 19th ACM SIGSPATIAL International Conference on Advances in Geographic Information Systems*, 513-516.

Mardan, A. (2019). *Express.js: A Complete Guide*. Apress.

Martin, R. C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.

Miller, T. (2024). *react-native-maps: React Native Map Components*. https://github.com/react-native-maps/react-native-maps

O'Brien, J. A., & Marakas, G. M. (2018). *Management Information Systems* (10th ed.). McGraw-Hill.

Oracle. (2023). *MySQL 8.0 Reference Manual*. https://dev.mysql.com/doc/refman/8.0/en/

OWASP. (2023). *OWASP Top Ten Web Application Security Risks*. https://owasp.org/www-project-top-ten/

Provos, N., & Mazières, D. (1999). A Future-Adaptable Password Scheme. *Proceedings of the 1999 USENIX Annual Technical Conference*.

React Navigation. (2024). *React Navigation Documentation*. https://reactnavigation.org/

Sagner, J. (2020). *Credit and Collection: A Practical Guide*. Institute of Financial Operations.

Sandhu, R. S., Coyne, E. J., Feinstein, H. L., & Youman, C. E. (1996). Role-Based Access Control Models. *IEEE Computer*, 29(2), 38-47.

Schwartz, B., Zaitsev, P., & Tkachenko, V. (2019). *High Performance MySQL* (4th ed.). O'Reilly Media.

Tailwind Labs. (2024). *Tailwind CSS Documentation*. https://tailwindcss.com/docs

Tilkov, S., & Vinoski, S. (2020). Node.js: Using JavaScript to Build High-Performance Network Programs. *IEEE Internet Computing*, 14(6), 80-83.

Veness, C. (2010). *Calculate distance, bearing and more between Latitude/Longitude points*. Movable Type Scripts.

Vercel. (2024). *Next.js Documentation*. https://nextjs.org/docs

Whitman, M. E., & Mattord, H. J. (2021). *Principles of Information Security* (7th ed.). Cengage Learning.

---

# Capítulo III: Marco Metodológico

## 1. Enfoque de Investigación

El presente trabajo de investigación adopta un **enfoque mixto**, combinando elementos cuantitativos y cualitativos que se complementan para abordar la complejidad del problema de investigación (Hernández, Fernández & Baptista, 2018).

### 1.1 Componente Cuantitativo

El componente cuantitativo se manifiesta en la recolección y análisis de datos numéricos relacionados con:

- **Indicadores de gestión de cobranzas:** Montos recuperados, tasas de morosidad, promedios de cobro por cobrador, cantidad de gestiones realizadas en un período determinado.
- **Métricas de rendimiento del sistema:** Tiempos de respuesta de la API, consumo de recursos del servidor, cantidad de transacciones procesadas concurrentemente.
- **Encuestas estructuradas:** Aplicación de cuestionarios a usuarios del sistema para medir niveles de satisfacción, usabilidad y percepción de utilidad mediante escalas Likert.

El uso de métodos cuantitativos permite establecer relaciones causa-efecto entre las variables del estudio y generalizar los hallazgos a contextos similares (Creswell & Creswell, 2018). En el caso de cobrApp, estos métodos facilitan la evaluación objetiva del impacto del sistema en la eficiencia operativa de las empresas de cobranzas.

### 1.2 Componente Cualitativo

El componente cualitativo se enfoca en la comprensión profunda de los procesos y experiencias de los actores involucrados en la gestión de cobranzas:

- **Entrevistas semiestructuradas:** Realizadas a administradores de empresas de cobranzas, supervisores y cobradores para comprender sus flujos de trabajo, necesidades no cubiertas y expectativas respecto al sistema.
- **Observación directa:** Registro de las prácticas actuales de gestión de cobranzas en empresas del sector, identificando puntos de dolor y oportunidades de mejora.
- **Análisis documental:** Revisión de registros, planillas y reportes existentes en las empresas para comprender el estado actual de sus procesos.

La combinación de ambos enfoques responde al principio de **triangulación metodológica**, que permite contrastar y validar los hallazgos desde múltiples perspectivas, aumentando la validez y confiabilidad de los resultados (Denzin, 2017).

---

## 2. Tipo de Investigación

### 2.1 Investigación Aplicada

Esta investigación se clasifica como **investigación aplicada**, también llamada tecnológica o práctica, ya que tiene como objetivo la solución de un problema concreto del mundo real: la ineficiencia en la gestión de cobranzas debido a la falta de herramientas digitales integradas y multiempresa (Lozada, 2014).

A diferencia de la investigación básica, que busca generar conocimiento por sí mismo, la investigación aplicada en el ámbito de la ingeniería informática se orienta a la creación de productos tecnológicos que resuelvan necesidades específicas de la sociedad o la industria. En este caso, el producto es cobrApp: un sistema de gestión de cobranzas multiempresa.

### 2.2 Investigación Descriptiva

Se emplea la **investigación descriptiva** para caracterizar el estado actual de la gestión de cobranzas en las empresas objeto de estudio. Según Hernández, Fernández y Baptista (2018), los estudios descriptivos buscan especificar propiedades, características y rasgos importantes de cualquier fenómeno que se analice.

En este contexto, la investigación descriptiva permite:

- Describir los procesos manuales o semiautomatizados que utilizan actualmente las empresas de cobranzas en Paraguay.
- Identificar las funcionalidades mínimas que debe tener un sistema de gestión de cobranzas para ser viable en el mercado local.
- Caracterizar el perfil tecnológico de los cobradores de campo (acceso a internet, tipo de dispositivo móvil, familiaridad con aplicaciones).

### 2.3 Investigación Correlacional

Se incluye un **componente correlacional** para analizar la relación entre la implementación del sistema y las variables de eficiencia operativa. Específicamente, se busca determinar si existe una correlación positiva entre el uso de cobrApp y:

- La reducción de la morosidad en las carteras gestionadas.
- El aumento en la cantidad de gestiones de cobro realizadas por cobrador por día.
- La mejora en la precisión de los reportes de cierre y rendición de cuentas.

### 2.4 Investigación Documental y de Campo

La investigación se sustenta en dos fuentes principales de información:

| Tipo | Descripción | Instrumentos |
|---|---|---|
| **Documental** | Revisión de literatura académica, manuales técnicos, documentación de frameworks y normativas legales aplicables | Fichas bibliográficas, matrices de análisis documental |
| **De campo** | Recolección de datos directamente de la realidad de las empresas de cobranzas | Entrevistas, encuestas, observación directa |

---

## 3. Diseño de Investigación

### 3.1 Diseño No Experimental

El diseño de esta investigación es **no experimental**, ya que no se manipulan deliberadamente las variables independientes. En lugar de crear situaciones controladas en laboratorio, se observan los fenómenos en su contexto natural y se analizan los datos tal como se presentan en la realidad (Kerlinger & Lee, 2002).

La justificación de este diseño radica en la naturaleza del objeto de estudio: un sistema de software que se desarrolla para ser implementado en entornos productivos reales, donde la manipulación artificial de variables no sería ética ni práctica.

### 3.2 Diseño Transaccional o Transversal

El estudio es de tipo **transaccional (transversal)**, ya que la recolección de datos se realiza en un momento único del tiempo. Esto permite:

- Obtener una "fotografía" del estado actual de la gestión de cobranzas antes de la implementación del sistema.
- Evaluar el impacto inicial del sistema después de su puesta en producción.
- Comparar los indicadores pre y post implementación en un período definido.

### 3.3 Diseño de Investigación-Acción en el Desarrollo de Software

Para el proceso de desarrollo del sistema propiamente dicho, se adopta un enfoque de **investigación-acción** (Avison et al., 2018), donde el investigador no es un observador externo sino un participante activo en la construcción de la solución. Este diseño se caracteriza por:

1. **Ciclos iterativos:** Planificación, acción, observación y reflexión se repiten en cada sprint de desarrollo.
2. **Participación colaborativa:** Los usuarios finales (administradores, supervisores, cobradores) participan activamente en la validación de cada incremento del producto.
3. **Generación de conocimiento:** Cada ciclo produce aprendizaje tanto sobre el dominio del problema como sobre la efectividad de las soluciones implementadas.

```
┌──────────────────────────────────────────────────────────┐
│              CICLO DE INVESTIGACIÓN-ACCIÓN                │
│                                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│   │ PLANIFICAR│──▶│  ACTUAR  │──▶│ OBSERVAR │             │
│   └─────────┘    └─────────┘    └─────────┘             │
│        │                                  │              │
│        └──────────────────────────────────┘              │
│                        │                                 │
│                   ┌────┴────┐                            │
│                   │ REFLEXIONAR│                          │
│                   └─────────┘                            │
│                        │                                 │
│                        ▼                                 │
│               Siguiente ciclo                            │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Metodología de Desarrollo de Software

### 4.1 Metodología Ágil: Scrum

El desarrollo de cobrApp se rige por la metodología **Scrum**, un marco de trabajo ágil que permite la entrega incremental de funcionalidades con alta adaptabilidad a los cambios (Schwaber & Sutherland, 2020). Scrum fue seleccionado por las siguientes razones:

1. **Requisitos evolutivos:** Las necesidades de las empresas de cobranzas pueden cambiar durante el desarrollo. Scrum permite adaptarse rápidamente sin perder el rumbo del proyecto.
2. **Entregas tempranas:** Cada sprint produce un incremento de software funcional que puede ser probado por los usuarios finales.
3. **Transparencia:** Los roles definidos (Product Owner, Scrum Master, Development Team) y las ceremonias (Daily, Sprint Review, Retrospective) garantizan visibilidad total del progreso.
4. **Mejora continua:** Las retrospectivas permiten identificar oportunidades de mejora en cada ciclo.

#### Roles Asignados

| Rol Scrum | Persona/Equipo | Responsabilidades |
|---|---|---|
| **Product Owner** | Tutor/Autor del proyecto | Define prioridades del backlog, valida funcionalidades, representa al cliente |
| **Scrum Master** | Autor del proyecto | Facilita el proceso, elimina impedimentos, asegura que Scrum se cumpla |
| **Development Team** | Autor del proyecto | Diseña, desarrolla, prueba y despliega el software |

#### Estructura de los Sprints

Cada sprint tiene una duración de **2 semanas** (10 días hábiles) y sigue la siguiente estructura:

| Día | Actividad | Artefactos generados |
|---|---|---|
| Día 1 | Sprint Planning: definición del objetivo y selección de ítems del backlog | Sprint Backlog, Sprint Goal |
| Días 2-9 | Desarrollo, pruebas, integración continua | Incremento de software |
| Día 9 | Sprint Review: demostración del incremento al Product Owner | Feedback documentado |
| Día 10 | Sprint Retrospective: análisis del proceso | Action items para mejora |

### 4.2 Prácticas de Programación Extrema (XP)

Complementariamente, se incorporan prácticas de **Programación Extrema (XP)** (Beck, 2004) que fortalecen la calidad del código:

- **Desarrollo guiado por pruebas (TDD):** Antes de escribir la lógica de negocio, se escriben las pruebas unitarias que validan el comportamiento esperado.
- **Integración continua:** Cada commit se integra y prueba automáticamente para detectar regresiones.
- **Refactorización constante:** El código se mejora continuamente sin cambiar su comportamiento externo, reduciendo la deuda técnica.
- **Propiedad colectiva del código:** Cualquier desarrollador puede modificar cualquier parte del código base para mejorarlo.
- **Estándares de codificación:** Se siguen guías de estilo consistentes (ESLint para JavaScript/TypeScript, Prettier para formateo).

### 4.3 Arquitectura de Desarrollo

El ciclo de vida del desarrollo sigue el modelo de **Arquitectura Dirigida por Pruebas (ATDD)** combinado con **Domain-Driven Design (DDD)** (Evans, 2003):

1. **Análisis del dominio:** Comprensión profunda del negocio de cobranzas mediante entrevistas y observación.
2. **Modelado conceptual:** Definición de entidades, agregados y bounded contexts (Usuarios, Créditos, Cobranzas, Reportes).
3. **Diseño técnico:** Definición de la arquitectura, selección de tecnologías, diseño de API y esquema de base de datos.
4. **Implementación:** Codificación siguiendo TDD.
5. **Pruebas:** Pruebas unitarias, de integración, de sistema y de aceptación.
6. **Despliegue:** Puesta en producción en el entorno del cliente piloto.

---

## 5. Población y Muestra

### 5.1 Población Objetivo

La población objetivo de esta investigación está conformada por:

1. **Empresas de cobranzas** que operan en la región de Carapeguá y áreas circundantes del Departamento de Paraguarí, Paraguay. Se estima que existen aproximadamente 30 empresas que realizan actividades de gestión de cobranzas (formalmente constituidas) en la zona de influencia del estudio.
2. **Usuarios del sistema**, clasificados en:
   - Administradores/gerentes de empresas de cobranzas.
   - Supervisores de campo.
   - Cobradores que realizan la gestión en terreno.

### 5.2 Muestra

Dado que el proyecto corresponde a un desarrollo tecnológico con implementación en empresas reales, se utiliza un **muestreo no probabilístico intencional** (Otzen & Manterola, 2017). La muestra está compuesta por:

| Estrato | Cantidad | Criterio de selección |
|---|---|---|
| Empresas piloto | 2 | Empresas que manifestaron interés en participar del proyecto, con procesos de cobranza activos y disposición a adoptar nuevas tecnologías |
| Administradores | 2 | Dueños o gerentes generales de las empresas piloto |
| Supervisores | 3 | Encargados de coordinar equipos de cobradores en las empresas piloto |
| Cobradores | 8 | Cobradores de campo activos, con experiencia mínima de 6 meses en el puesto |

#### Criterios de Inclusión

- Empresas con al menos 6 meses de operación continua en el rubro de cobranzas.
- Empresas que actualmente gestionan sus procesos de forma manual o con herramientas básicas (planillas electrónicas, cuadernos de registro).
- Usuarios con disponibilidad para participar en entrevistas y pruebas del sistema.
- Cobradores que realizan gestión de cobro presencial (visitas domiciliarias).

#### Criterios de Exclusión

- Empresas que ya utilizan un sistema de gestión de cobranzas comercial.
- Usuarios sin experiencia previa en el uso de aplicaciones móviles.
- Empresas con menos de 100 cuotas activas en su cartera (volumen insuficiente para medir impacto).

### 5.3 Caracterización de la Muestra

La muestra queda caracterizada de la siguiente manera:

**Empresas participantes:**
- Empresa A: Cartera de ~1.500 cuotas activas, 3 supervisores, 5 cobradores.
- Empresa B: Cartera de ~2.000 cuotas activas, 2 supervisores, 4 cobradores.

**Perfil de los participantes:**
- Administradores: Edad 35-55 años, nivel educativo universitario.
- Supervisores: Edad 28-45 años, experiencia en cobranzas 3+ años.
- Cobradores: Edad 22-50 años, educación secundaria/técnica, experiencia en cobranzas 6 meses - 10 años.

---

## 6. Técnicas e Instrumentos de Recolección de Datos

### 6.1 Entrevista Semiestructurada

Se aplica una **entrevista semiestructurada** a administradores y supervisores de las empresas participantes. Este instrumento permite explorar en profundidad las necesidades del negocio y las expectativas sobre el sistema.

**Guía de entrevista para administradores:**

1. ¿Cómo gestionan actualmente las cobranzas en su empresa?
2. ¿Qué herramientas utilizan para el registro de pagos y control de cartera?
3. ¿Cuáles son los principales problemas que enfrentan en la gestión diaria?
4. ¿Qué información considera indispensable en un reporte de cobranzas?
5. ¿Cómo miden la eficiencia de sus cobradores actualmente?
6. ¿Qué funcionalidades le gustaría que tuviera un sistema de gestión de cobranzas?

**Guía de entrevista para supervisores:**

1. ¿Cómo asignan las cuotas a los cobradores actualmente?
2. ¿Qué información reciben sobre el desempeño diario de sus cobradores?
3. ¿Cómo manejan las novedades (clientes ausentes, reagendamientos, descansos)?
4. ¿Qué problemas de comunicación tienen con los cobradores en campo?
5. ¿Cómo realizan la rendición de cuentas al final de la jornada?

### 6.2 Encuesta de Satisfacción y Usabilidad

Se aplica un **cuestionario estructurado** a todos los usuarios del sistema después del período de prueba. El cuestionario utiliza la **Escala de Usabilidad del Sistema (SUS)** (Brooke, 1996), complementada con preguntas específicas del dominio.

| Sección | Ítems | Escala |
|---|---|---|
| Datos demográficos | 5 preguntas | Opción múltiple |
| Experiencia con tecnología | 3 preguntas | Likert 1-5 |
| Usabilidad del sistema (SUS) | 10 preguntas | Likert 1-5 |
| Utilidad percibida | 8 preguntas | Likert 1-5 |
| Satisfacción general | 3 preguntas | Likert 1-5 |
| Comentarios abiertos | 3 preguntas | Texto libre |

### 6.3 Observación Directa

Se realiza **observación directa no participante** de las siguientes actividades:

- Jornada completa de trabajo de un cobrador (desde la salida hasta la rendición).
- Proceso de asignación de cuotas por parte del supervisor.
- Cierre de caja y arqueo al final de la jornada.
- Reuniones de coordinación del equipo de cobranzas.

Las observaciones se registran en un **diario de campo** estructurado con los siguientes campos:

- **Fecha:** Día de la observación.
- **Hora:** Intervalo de tiempo registrado.
- **Actividad observada:** Descripción de la tarea.
- **Participantes:** Personas involucradas.
- **Descripción detallada:** Narración de lo observado.
- **Problemas identificados:** Incidencias o dificultades detectadas.
- **Notas del investigador:** Comentarios y reflexiones.

### 6.4 Análisis Documental

Se revisan y analizan los siguientes documentos proporcionados por las empresas participantes:

- **Registros de cobranza:** Planillas, cuadernos o archivos Excel donde se registran los pagos.
- **Reportes de morosidad:** Documentos que identifican cuotas vencidas y acciones de recuperación.
- **Liquidaciones de cobradores:** Cálculos de comisiones y rendiciones.
- **Contratos de crédito:** Formatos y cláusulas utilizadas.
- **Registros de clientes:** Bases de datos de deudores (anonimizadas para el análisis).

### 6.5 Registros del Sistema (Logs y Métricas)

El propio sistema cobrApp genera datos que son utilizados como fuente de información:

- **Logs de acceso:** Registro de inicios de sesión, horas de actividad y sesiones concurrentes.
- **Métricas de uso:** Frecuencia de uso de cada funcionalidad, tiempo promedio por tarea, tasa de errores.
- **Datos de gestión:** Cantidad de cobros registrados, montos procesados, visitas realizadas.

---

## 7. Procedimiento de Investigación

El estudio se desarrolla en las siguientes fases secuenciales:

### Fase 1: Diagnóstico (Semanas 1-3)

- Revisión bibliográfica y análisis del estado del arte.
- Entrevistas iniciales con administradores y supervisores.
- Observación directa de procesos actuales.
- Análisis documental de registros existentes.
- Identificación de requisitos funcionales y no funcionales.
- Elaboración del documento de especificación de requisitos.

**Producto entregable:** Documento de Requisitos del Sistema (DRS) validado por las empresas participantes.

### Fase 2: Diseño (Semanas 4-6)

- Diseño de la arquitectura del sistema (3 capas).
- Modelado de la base de datos (diagrama entidad-relación).
- Diseño de la API REST (contrato de endpoints).
- Diseño de las interfaces de usuario (wireframes y prototipos).
- Validación de prototipos con usuarios finales.

**Producto entregable:** Documento de Arquitectura y Diseño del Sistema (DADS) + prototipos navegables.

### Fase 3: Desarrollo (Semanas 7-16)

- Sprint 1: Configuración del proyecto, autenticación y RBAC.
- Sprint 2: Gestión de clientes y créditos.
- Sprint 3: Asignación de cuotas y agenda del cobrador.
- Sprint 4: Registro de cobros y gestión de visitas.
- Sprint 5: Reportes y dashboard de supervisión.
- Sprint 6: Mensajería, descansos y geolocalización.
- Sprint 7: Arqueo de caja y módulo de caja.
- Sprint 8: Pruebas integrales y correcciones.

### Fase 4: Implementación (Semanas 17-18)

- Configuración del entorno de producción.
- Migración de datos desde sistemas anteriores.
- Capacitación de usuarios (administradores, supervisores, cobradores).
- Implementación piloto en la Empresa A.
- Período de pruebas en producción (1 semana).
- Ajustes post-implementación.
- Implementación en la Empresa B.

**Producto entregable:** Sistema en producción operativo en ambas empresas piloto.

### Fase 5: Evaluación (Semanas 19-20)

- Aplicación de encuestas de satisfacción y usabilidad.
- Recolección de métricas de uso del sistema.
- Comparación de indicadores pre vs. post implementación.
- Entrevistas de cierre con administradores.
- Análisis de resultados y elaboración de conclusiones.

**Producto entregable:** Informe de Evaluación del Sistema.

---

## 8. Técnicas de Análisis de Datos

### 8.1 Análisis Cuantitativo

Los datos cuantitativos recolectados (encuestas, métricas del sistema, indicadores de gestión) se procesan mediante **estadística descriptiva e inferencial**:

- **Medidas de tendencia central:** Media, mediana y moda para resumir los datos de usabilidad y satisfacción.
- **Medidas de dispersión:** Desviación estándar y rango intercuartílico para evaluar la variabilidad de las respuestas.
- **Prueba t de Student:** Para comparar los indicadores de eficiencia antes y después de la implementación del sistema (α = 0.05).
- **Coeficiente de correlación de Pearson:** Para analizar la relación entre la frecuencia de uso del sistema y la mejora en los indicadores de cobranza.
- **Análisis de varianza (ANOVA):** Para comparar la percepción de usabilidad entre los diferentes roles (administradores, supervisores, cobradores).

Los datos se tabulan y procesan utilizando **Microsoft Excel** y **SPSS** (Statistical Package for the Social Sciences).

### 8.2 Análisis Cualitativo

Los datos cualitativos (entrevistas, observaciones, comentarios abiertos) se analizan mediante la **técnica de análisis de contenido** (Krippendorff, 2018), siguiendo estos pasos:

1. **Transcripción:** Digitalización de entrevistas y notas de campo.
2. **Codificación abierta:** Identificación de conceptos y categorías emergentes en los textos.
3. **Codificación axial:** Establecimiento de relaciones entre las categorías identificadas.
4. **Codificación selectiva:** Integración de categorías en temas centrales.
5. **Interpretación:** Construcción de significados a partir de los patrones identificados.

### 8.3 Triangulación de Resultados

Para garantizar la validez de los hallazgos, se aplica **triangulación metodológica** (Denzin, 2017) contrastando:

- Los resultados cuantitativos de las encuestas con los hallazgos cualitativos de las entrevistas.
- La percepción de los usuarios con las métricas objetivas del sistema.
- Los datos reportados por administradores con los registros automáticos del sistema.

---

## 9. Aspectos Éticos

### 9.1 Consentimiento Informado

Todos los participantes en el estudio firman un **consentimiento informado** que especifica:

- El propósito de la investigación.
- El carácter voluntario de la participación.
- La confidencialidad de los datos proporcionados.
- El derecho a retirarse del estudio en cualquier momento sin consecuencias.
- El uso exclusivo de los datos para fines académicos y de investigación.

### 9.2 Confidencialidad y Anonimización

Se garantiza la **confidencialidad** de los datos de las empresas participantes mediante:

- Anonimización de los nombres comerciales en los reportes de investigación.
- Omisión de datos sensibles de clientes (nombres, cédulas, direcciones) en los análisis publicados.
- Almacenamiento seguro de los datos recolectados en repositorios con acceso restringido.
- Destrucción de los datos personales una vez concluida la investigación.

### 9.3 Protección de Datos Personales

El manejo de datos personales se alinea con la **Ley N° 1682/01 "De Protección de Datos de Carácter Personal"** del Paraguay y con los principios establecidos en el Reglamento General de Protección de Datos (GDPR) de la Unión Europea:

- **Finalidad:** Los datos se recolectan únicamente para los fines declarados.
- **Proporcionalidad:** Solo se recolectan los datos estrictamente necesarios.
- **Calidad:** Los datos deben ser exactos y actualizados.
- **Seguridad:** Se implementan medidas técnicas y organizativas para proteger los datos.

---

## 10. Limitaciones del Estudio

### 10.1 Limitaciones de la Muestra

- El tamaño reducido de la muestra (2 empresas, 13 participantes) limita la generalización de los resultados a otras empresas del sector.
- El muestreo intencional (no probabilístico) puede introducir sesgos de selección, ya que las empresas participantes son las que voluntariamente aceptaron formar parte del estudio.

### 10.2 Limitaciones Temporales

- El período de evaluación (2 semanas en producción) puede ser insuficiente para capturar el impacto completo del sistema en los procesos de cobranza.
- La estacionalidad del negocio de cobranzas (picos en ciertos meses del año) puede no estar representada en el período de estudio.

### 10.3 Limitaciones Tecnológicas

- Los resultados están condicionados a la infraestructura tecnológica disponible en las empresas participantes (calidad de conexión a internet, dispositivos móviles disponibles).
- Las conclusiones sobre el rendimiento del sistema pueden variar en entornos con mayor carga de datos o mayor número de usuarios concurrentes.

### 10.4 Limitaciones del Alcance

- El estudio se enfoca en el proceso de cobranza en campo, excluyendo otros procesos relacionados como la gestión de créditos inicial o la cobranza judicial.
- No se evalúa el módulo de facturación electrónica ni la integración con sistemas contables externos, que quedan fuera del alcance de esta investigación.

---

## 11. Cronograma de Actividades

| Fase | Actividad | Semana 1-3 | Semana 4-6 | Semana 7-10 | Semana 11-14 | Semana 15-16 | Semana 17-18 | Semana 19-20 |
|---|---|---|---|---|---|---|---|---|
| **Fase 1** | Diagnóstico y relevamiento | ███████ | | | | | | |
| **Fase 1** | Especificación de requisitos | ███████ | ███ | | | | | |
| **Fase 2** | Diseño de arquitectura | | ███████ | ███ | | | | |
| **Fase 2** | Prototipado de interfaces | | ███████ | ███████ | | | | |
| **Fase 3** | Sprint 1-2 (Base del sistema) | | | ███████ | | | | |
| **Fase 3** | Sprint 3-4 (Cobranzas) | | | | ███████ | | | |
| **Fase 3** | Sprint 5-6 (Reportes y comunicación) | | | | ███████ | ███████ | | |
| **Fase 3** | Sprint 7-8 (Caja y pruebas) | | | | | ███████ | ███ | |
| **Fase 4** | Implementación piloto | | | | | | ███████ | |
| **Fase 4** | Capacitación | | | | | | ███████ | ███ |
| **Fase 5** | Evaluación y análisis | | | | | | | ███████ |
| **Fase 5** | Elaboración de informe final | | | | | | | ███████ |

---

## 12. Matriz de Operacionalización de Variables

| Variable | Definición Conceptual | Dimensión | Indicador | Instrumento | Escala |
|---|---|---|---|---|---|
| **Eficiencia operativa** | Capacidad del sistema para optimizar los procesos de gestión de cobranzas | Productividad | Gestiones por cobrador por día | Registros del sistema | Razón |
| | | Tiempo | Tiempo promedio de registro de cobro | Registros del sistema | Razón (minutos) |
| | | Cobertura | % de cuotas gestionadas vs. asignadas | Registros del sistema | Porcentaje |
| **Usabilidad del sistema** | Grado en que el sistema puede ser utilizado con efectividad, eficiencia y satisfacción | Efectividad | Tasa de finalización de tareas | Pruebas de usabilidad | Porcentaje |
| | | Eficiencia | Tiempo por tarea | Registros del sistema | Razón (segundos) |
| | | Satisfacción | Puntuación SUS | Cuestionario SUS | Intervalo (0-100) |
| **Satisfacción del usuario** | Percepción positiva del usuario respecto al sistema | Utilidad percibida | Promedio en escala de utilidad | Encuesta | Likert (1-5) |
| | | Facilidad de uso | Promedio en escala de facilidad | Encuesta | Likert (1-5) |
| | | Intención de uso | % de usuarios que recomendarían el sistema | Encuesta | Porcentaje |
| **Reducción de morosidad** | Disminución del % de cuotas vencidas sobre el total de la cartera | Mora temprana | % cuotas con 1-30 días de atraso | Reportes del sistema | Porcentaje |
| | | Mora media | % cuotas con 31-60 días de atraso | Reportes del sistema | Porcentaje |
| | | Mora tardía | % cuotas con más de 60 días de atraso | Reportes del sistema | Porcentaje |

---

## 13. Recursos del Proyecto

### 13.1 Recursos Humanos

| Rol | Cantidad | Dedicación |
|---|---|---|
| Investigador / Desarrollador | 1 | Tiempo completo (20 semanas) |
| Tutor / Asesor metodológico | 1 | 4 horas semanales |
| Administradores (empresas piloto) | 2 | 2 horas semanales |
| Supervisores | 3 | 1 hora semanal |
| Cobradores | 8 | 30 minutos semanales |

### 13.2 Recursos Tecnológicos

| Recurso | Especificación | Propósito |
|---|---|---|
| Servidor de desarrollo | Laptop personal (16 GB RAM, SSD 512 GB) | Desarrollo y pruebas locales |
| Servidor de producción | VPS Linux (4 vCPU, 8 GB RAM, 100 GB SSD) | Hosting del sistema en producción |
| Dispositivos móviles | Smartphones Android (3 unidades) | Pruebas de la aplicación móvil |
| Conexión a internet | Fibra óptica 100 Mbps | Desarrollo, pruebas y despliegue |
| Software de desarrollo | VS Code, Node.js 22.x, MySQL 8.x | Entorno de desarrollo |

### 13.3 Recursos Bibliográficos

| Tipo | Cantidad | Fuente |
|---|---|---|
| Libros académicos | 25 | Biblioteca física y digital |
| Artículos científicos | 15 | IEEE Xplore, ACM, SciELO |
| Documentación técnica | 10 | Documentación oficial de frameworks |
| Normativas legales | 3 | Legislación paraguaya aplicable |

---

## 14. Presupuesto Estimado

| Rubro | Descripción | Costo Estimado (USD) |
|---|---|---|
| Servidor VPS | Hosting en la nube (12 meses) | $240 |
| Dominio web | Registro de dominio (.com.py, 12 meses) | $50 |
| Dispositivos móviles | Smartphones para pruebas (3 unidades) | $450 |
| Certificado SSL | Certificado digital para HTTPS | $0 (Let's Encrypt) |
| Conectividad | Plan de internet (12 meses) | $— |
| Imprevistos | 10% del subtotal | $74 |
| **Total estimado** | | **$814** |

> **Nota:** Los rubros con "—" corresponden a recursos ya disponibles (equipo personal, conexión existente) que no representan un desembolso adicional.

---

## Referencias del Marco Metodológico

Avison, D., Lau, F., Myers, M., & Nielsen, P. A. (2018). Action research. *Communications of the ACM*, 42(1), 94-97.

Beck, K. (2004). *Extreme Programming Explained: Embrace Change* (2nd ed.). Addison-Wesley.

Brooke, J. (1996). SUS: A "quick and dirty" usability scale. En P. W. Jordan, B. Thomas, B. A. Weerdmeester, & I. L. McClelland (Eds.), *Usability Evaluation in Industry* (pp. 189-194). Taylor & Francis.

Creswell, J. W., & Creswell, J. D. (2018). *Research Design: Qualitative, Quantitative, and Mixed Methods Approaches* (5th ed.). SAGE Publications.

Denzin, N. K. (2017). *The Research Act: A Theoretical Introduction to Sociological Methods*. Routledge.

Evans, E. (2003). *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley.

Hernández, R., Fernández, C., & Baptista, P. (2018). *Metodología de la Investigación* (6a ed.). McGraw-Hill.

Kerlinger, F. N., & Lee, H. B. (2002). *Investigación del Comportamiento* (4a ed.). McGraw-Hill.

Krippendorff, K. (2018). *Content Analysis: An Introduction to Its Methodology* (4th ed.). SAGE Publications.

Lozada, J. (2014). Investigación aplicada: Definición, propiedad intelectual e industria. *CienciAmérica*, 3(1), 34-39.

Otzen, T., & Manterola, C. (2017). Técnicas de muestreo sobre una población a estudio. *International Journal of Morphology*, 35(1), 227-232.

Schwaber, K., & Sutherland, J. (2020). *The Scrum Guide: The Definitive Guide to Scrum*. https://scrumguides.org/

---

> *Documento de Marco Teórico y Metodológico — Proyecto de Investigación cobrApp*  
> *Universidad Católica Nuestra Señora de la Asunción — Unidad Pedagógica Carapeguá, 2026*
