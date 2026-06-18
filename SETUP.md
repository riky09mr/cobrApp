# cobrApp — Guía de instalación y ejecución

Sistema SaaS de gestión de cobranzas multiempresa.  
Stack: **Node.js + Express** (backend) · **Next.js 16** (web) · **React Native + Expo SDK 54** (mobile)

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 18 LTS o superior | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Incluido con Node.js |
| Laragon (Windows) | Cualquiera | MySQL 8 + Apache |
| Expo Go (iOS/Android) | SDK 54 | Instalar desde App Store / Play Store |

---

## Estructura del proyecto

```
cobrApp/
├── backend/          Node.js + Express  (puerto 5000)
├── web/              Next.js 16         (puerto 3000)
├── mobile/           React Native + Expo SDK 54
└── database/         Scripts SQL de migración
```

---

## 1. Base de datos (MySQL via Laragon)

### Crear base de datos
Abrir **HeidiSQL** (incluido en Laragon) o la terminal MySQL y ejecutar:

```sql
CREATE DATABASE cobrapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Ejecutar migraciones en orden
```sql
-- 1. Estructura base (tablas principales)
SOURCE database/migracion_v2.sql;

-- 2. Clientes globales
SOURCE database/migracion_v3_clientes_global.sql;

-- 3. Módulo cobrador (visitas_cobro, agenda)
SOURCE database/migracion_v4_cobrador.sql;

-- 4. Módulo descansos (tipos_descanso, descansos_cobrador)
SOURCE database/migracion_v5_descansos.sql;

-- 5. Campo de cambio obligatorio de contraseña
SOURCE database/agregar_campo_debe_cambiar_password.sql;
```

O desde HeidiSQL: **Archivo → Ejecutar archivo SQL** seleccionando cada `.sql` en orden.

---

## 2. Backend (Node.js + Express)

### Variables de entorno
Crear `backend/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cobrapp
JWT_SECRET=tu_clave_secreta_muy_larga
```

### Instalar dependencias
```powershell
cd backend
npm install
```

### Dependencias instaladas

| Paquete | Versión | Uso |
|---|---|---|
| express | ^5.2.1 | Framework HTTP |
| mysql2 | ^3.15.3 | Cliente MySQL con promesas |
| jsonwebtoken | ^9.0.2 | Autenticación JWT |
| bcryptjs | ^3.0.2 | Hash de contraseñas |
| dotenv | ^17.3.1 | Variables de entorno |
| cors | ^2.8.6 | Cabeceras CORS |
| multer | ^2.1.1 | Subida de archivos (fotos visita) |
| morgan | ^1.10.1 | Logger HTTP |
| node-cron | ^4.2.1 | Cron jobs (descanso almuerzo automático) |
| xlsx | ^0.18.5 | Importación de Excel de clientes |
| nodemon *(dev)* | ^3.1.14 | Recarga automática en desarrollo |

### Ejecutar

**Desarrollo (con recarga automática):**
```powershell
cd backend
npm run dev
```

**Producción:**
```powershell
cd backend
node src/app.js
```

El backend queda escuchando en `http://localhost:5000`.

---

## 3. Web (Next.js 16)

### Instalar dependencias
```powershell
cd web
npm install
```

### Dependencias instaladas

| Paquete | Versión | Uso |
|---|---|---|
| next | 16.1.6 | Framework React SSR/SSG |
| react | 19.2.3 | UI |
| react-dom | 19.2.3 | Renderizado DOM |
| axios | ^1.13.6 | Llamadas HTTP al backend |
| lucide-react | ^1.16.0 | Iconos vectoriales profesionales |
| leaflet | ^1.9.4 | Mapas (selector de polígono de zonas) |
| react-leaflet | ^5.0.0 | Wrapper React para Leaflet |
| @types/leaflet | ^1.9.21 | Tipos TypeScript para Leaflet |
| tailwindcss *(dev)* | ^4 | Estilos utilitarios |
| typescript *(dev)* | ^5 | TypeScript |

### Ejecutar

**Desarrollo:**
```powershell
cd web
npm run dev
```

Abre `http://localhost:3000` en el navegador.

**Build de producción:**
```powershell
npm run build
npm start
```

---

## 4. Mobile (React Native + Expo SDK 54)

### Requisitos específicos
- **Expo Go** instalado en el dispositivo (App Store / Play Store) — **debe ser SDK 54**
- PC y dispositivo en la **misma red** (o dispositivo como hotspot del PC)

### Instalar dependencias
```powershell
cd mobile
npm install --legacy-peer-deps
```

> **Nota:** `--legacy-peer-deps` es necesario por compatibilidades entre versiones de React Native.

### Dependencias instaladas

| Paquete | Versión | Uso |
|---|---|---|
| expo | ~54.0.34 | SDK base |
| react | 19.1.0 | UI |
| react-native | 0.81.5 | Framework móvil nativo |
| @react-navigation/native | ^7.2.4 | Navegación entre pantallas |
| @react-navigation/native-stack | ^7.15.1 | Stack navigator |
| expo-location | ~19.0.8 | GPS para registrar visitas |
| expo-image-picker | ~17.0.11 | Cámara para fotos de evidencia |
| expo-notifications | ~0.32.17 | Notificaciones locales (reagendados) |
| expo-status-bar | ~3.0.9 | Barra de estado |
| react-native-maps | 1.20.1 | Mapa de ruta de cobrador |
| react-native-screens | ~4.16.0 | Optimización de pantallas nativas |
| react-native-safe-area-context | ~5.6.0 | Espaciado seguro en notch/barra |
| @react-native-async-storage/async-storage | 2.2.0 | Almacenamiento local (token JWT) |
| axios | ^1.16.1 | Llamadas HTTP al backend |
| @expo/vector-icons *(incluido en expo)* | ^15.x | Iconos Ionicons |
| @expo/ngrok *(dev)* | ^4.1.3 | Tunnel opcional |
| typescript *(dev)* | ~5.8.0 | TypeScript |

### Configurar IP del backend

Editar `mobile/src/api/client.ts` y poner la IP de tu PC en la red:

```typescript
// Dispositivo físico en la misma red Wi-Fi:
export const BASE_URL = 'http://192.168.X.X:5000';

// Dispositivo como hotspot del PC (iPhone Personal Hotspot):
export const BASE_URL = 'http://172.20.10.2:5000';
```

Para saber tu IP actual (PowerShell):
```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } |
  Select-Object IPAddress, InterfaceAlias
```

### Ejecutar

**Desde PowerShell dentro de `mobile/`:**
```powershell
cd C:\laragon\www\cobrApp\mobile
$env:REACT_NATIVE_PACKAGER_HOSTNAME='172.20.10.2'   # <-- tu IP
.\node_modules\.bin\expo start --lan
```

**Desde CMD dentro de `mobile/`:**
```cmd
cd C:\laragon\www\cobrApp\mobile
set REACT_NATIVE_PACKAGER_HOSTNAME=172.20.10.2
.\node_modules\.bin\expo start --lan
```

> **Importante:** Usar siempre `.\node_modules\.bin\expo` en lugar de `npx expo` para evitar que npm descargue una versión global diferente del SDK.

Luego **escanear el QR** con la app de Cámara (iOS) o con Expo Go (Android).

### Firewall de Windows
Si el dispositivo no puede conectarse, crear una regla de entrada en el Firewall:
1. `Win + R` → `wf.msc`
2. **Reglas de entrada** → Nueva regla → **Puerto**
3. TCP, puerto `8081`
4. Permitir la conexión → Aplicar a todos los perfiles

---

## 5. Orden de arranque completo

```
1. Iniciar Laragon (MySQL)
2. cd backend  →  node src/app.js          (puerto 5000)
3. cd web      →  npm run dev              (puerto 3000)
4. cd mobile   →  .\node_modules\.bin\expo start --lan
5. Abrir http://localhost:3000 en el navegador
6. Escanear QR con Expo Go en el dispositivo
```

---

## 6. Credenciales por defecto

El primer usuario ADMIN se crea directamente en la base de datos:

```sql
-- Contraseña: Admin123! (hashear con bcrypt antes de insertar en producción)
INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id, empresa_id, activo)
VALUES ('Admin', 'Sistema', 'admin@cobrapp.com', '$2b$10$...hash...', 1, 1, 1);
```

O usar el endpoint de registro en `/register` si está habilitado.

---

## 7. Variables de entorno resumen

### `backend/.env`
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cobrapp
JWT_SECRET=cobrapp_jwt_secret_2024_muy_largo
```

### `mobile/src/api/client.ts`
```typescript
export const BASE_URL = 'http://<IP_DE_TU_PC>:5000';
```

---

## 8. Solución de problemas frecuentes

| Problema | Causa | Solución |
|---|---|---|
| `expo: no reconocido` | Se usa `npx expo` globalmente (SDK distinto) | Usar `.\node_modules\.bin\expo start --lan` |
| `SDK incompatible` en Expo Go | Versión del proyecto ≠ Expo Go instalado | Verificar que el proyecto use SDK 54 (`package.json`) |
| `PlatformConstants not found` | react-native en package.json no coincide con Expo Go | Ejecutar `npm install --legacy-peer-deps` con versiones correctas del `bundledNativeModules.json` |
| `Error interno del servidor` al confirmar cobro | Tablas de base de datos no creadas | Ejecutar las migraciones v4 y v5 |
| Dispositivo no conecta al metro | Firewall bloquea puerto 8081 | Crear regla de entrada TCP 8081 en `wf.msc` |
| IP incorrecta en QR | PC tiene múltiples interfaces de red | Setear `$env:REACT_NATIVE_PACKAGER_HOSTNAME` con la IP correcta |
| Error 401 en web | Token JWT vencido | Cerrar sesión y volver a ingresar |
