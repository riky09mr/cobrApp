# Módulo de Usuarios - cobrApp

## 📋 Funcionalidades Implementadas

### 1. **Creación de Usuarios con Control de Roles**

#### Backend: `POST /api/usuarios`

**Permisos por Rol:**

- **ADMIN**:
  - ✅ Puede crear usuarios con cualquier rol (ADMIN, SUPERVISOR, COBRADOR)
  - ✅ Puede asignar usuarios a cualquier empresa
  
- **SUPERVISOR**:
  - ✅ Solo puede crear usuarios con rol SUPERVISOR o COBRADOR
  - ❌ NO puede crear usuarios con rol ADMIN
  - 🔒 Los usuarios creados se asignan automáticamente a su misma empresa
  
- **COBRADOR**:
  - ❌ NO puede crear usuarios (error 403)

#### Características:

1. **Contraseña Automática**:
   - Formato: `nombreEmpresa + añoActual`
   - Ejemplo: Si la empresa se llama "Mi Empresa" → contraseña: `miempresa2026`
   - Se remueven espacios y caracteres especiales
   - Se convierte a minúsculas

2. **Cambio Obligatorio de Contraseña**:
   - Todo usuario nuevo recibe flag `debe_cambiar_password = TRUE`
   - Al hacer login, se redirige a página de cambio de contraseña
   - No puede acceder al sistema hasta cambiar la contraseña

3. **Validaciones**:
   - Email único (no permite duplicados)
   - Empresa válida y existente
   - Rol válido y existente
   - Encriptación con bcrypt (10 rounds)

---

### 2. **Frontend - Página de Usuarios**

#### Ubicación: `/usuarios`

**Funcionalidades:**

- ✅ Listado de usuarios con datos:
  - Nombre completo
  - Email
  - Rol
  - Empresa

- ✅ Botón "➕ Nuevo Usuario" para abrir formulario

- ✅ Formulario adaptable según rol:
  - **Para ADMIN**: Muestra select de empresas
  - **Para SUPERVISOR**: Oculta select de empresas (se asigna automático)
  - **Para ambos**: No requiere contraseña (se genera automáticamente)

- ✅ Campos del formulario:
  - Nombre * (requerido)
  - Apellido * (requerido)
  - Cédula (opcional)
  - Teléfono (opcional)
  - Email * (requerido, tipo email)
  - Rol * (select dinámico desde backend)
  - Empresa * (solo para ADMIN)

- ✅ Mensaje informativo sobre contraseña automática

- ✅ Al crear usuario, muestra contraseña temporal en un cuadro destacado:
  ```
  🔑 Contraseña temporal generada:
  miempresa2026
  
  ⚠️ El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
  ```

---

### 3. **Sistema de Cambio de Contraseña**

#### Flujo:

1. Usuario hace login con contraseña temporal
2. Backend retorna `debeCambiarPassword: true`
3. Frontend detecta el flag y redirige a `/cambiar-password`
4. Usuario ingresa:
   - Contraseña actual (temporal)
   - Nueva contraseña (mínimo 6 caracteres)
   - Confirmación de nueva contraseña
5. Backend valida y actualiza:
   - Verifica contraseña actual
   - Encripta nueva contraseña
   - Marca `debe_cambiar_password = FALSE`
6. Usuario es redirigido al dashboard

#### Endpoint: `POST /api/cambiar-password`

**Request Body:**
```json
{
  "passwordActual": "miempresa2026",
  "passwordNueva": "MiNuevaPassword123"
}
```

**Validaciones:**
- Contraseña actual correcta
- Nueva contraseña mínimo 6 caracteres
- Ambos campos requeridos

---

### 4. **Reseteo de Contraseña**

Si un administrador resetea la contraseña de un usuario (volviendo a poner `nombreEmpresa + año`), el sistema automáticamente:

1. Encripta la nueva contraseña temporal
2. Marca `debe_cambiar_password = TRUE`
3. En el próximo login, el usuario debe cambiar la contraseña nuevamente

**Nota:** Esta funcionalidad está preparada en el backend. El frontend necesitaría un botón "Resetear contraseña" en la lista de usuarios.

---

## 🗄️ Cambios en Base de Datos

### Nuevo Campo en Tabla `usuarios`:

```sql
ALTER TABLE usuarios 
ADD COLUMN debe_cambiar_password TINYINT(1) DEFAULT 0 
AFTER password;
```

**Importante:** Ejecutar el script SQL ubicado en:
```
database/agregar_campo_debe_cambiar_password.sql
```

---

## 🔐 Seguridad Implementada

1. ✅ **Contraseñas encriptadas** con bcrypt (10 rounds)
2. ✅ **JWT en todas las peticiones** (middleware `authenticateToken`)
3. ✅ **Validación de permisos** en backend (no confía en frontend)
4. ✅ **Email único** (constraint en base de datos)
5. ✅ **Cambio obligatorio** de contraseña temporal
6. ✅ **Separación de empresas** (SUPERVISOR no puede ver otras empresas)

---

## 📂 Archivos Modificados/Creados

### Backend:

- ✅ `backend/src/controllers/usuariosController.js` (NUEVO)
  - `createUsuario()`: Crear usuarios con lógica de permisos
  - `cambiarPassword()`: Cambiar contraseña con validaciones

- ✅ `backend/src/controllers/authController.js` (MODIFICADO)
  - Agregado `rol_id` al token JWT
  - Retorna `debeCambiarPassword` en login

- ✅ `backend/src/controllers/panelController.js` (MODIFICADO)
  - Agregado `getRoles()`: Obtener lista de roles

- ✅ `backend/src/routes/panelRoutes.js` (MODIFICADO)
  - `POST /api/usuarios`
  - `POST /api/cambiar-password`
  - `GET /api/roles`

### Frontend:

- ✅ `web/src/app/usuarios/page.tsx` (MODIFICADO)
  - Formulario adaptable por rol
  - Muestra contraseña temporal
  - Validaciones mejoradas

- ✅ `web/src/app/login/page.tsx` (MODIFICADO)
  - Detecta flag `debeCambiarPassword`
  - Redirige a cambio de contraseña si es necesario

- ✅ `web/src/app/cambiar-password/page.tsx` (NUEVO)
  - Página de cambio obligatorio de contraseña
  - Validaciones frontend/backend

- ✅ `web/src/services/api.ts` (MODIFICADO)
  - Tipo `CreateUsuarioPayload` ahora es parcial
  - Método `createUsuario()` acepta payload parcial
  - Método `changePassword()` agregado
  - Login retorna `debeCambiarPassword`
  - Guarda info de usuario en localStorage

### Base de Datos:

- ✅ `database/agregar_campo_debe_cambiar_password.sql` (NUEVO)
  - Script para agregar campo a tabla usuarios

---

## 🧪 Casos de Prueba

### 1. Crear Usuario como ADMIN:
1. Login como ADMIN
2. Ir a `/usuarios`
3. Click "➕ Nuevo Usuario"
4. Llenar formulario (seleccionar empresa y rol)
5. Crear usuario
6. Copiar contraseña temporal mostrada
7. Hacer logout
8. Login con nuevo usuario y contraseña temporal
9. Debe redirigir a `/cambiar-password`
10. Cambiar contraseña
11. Acceder al dashboard

### 2. Crear Usuario como SUPERVISOR:
1. Login como SUPERVISOR
2. Ir a `/usuarios`
3. Click "➕ Nuevo Usuario"
4. Verificar que NO aparece select de empresa
5. Verificar que empresa se muestra como "Automático"
6. Seleccionar rol COBRADOR o SUPERVISOR
7. NO debe poder seleccionar ADMIN
8. Crear usuario
9. Usuario debe quedar en misma empresa del supervisor

### 3. Intentar Crear Usuario como COBRADOR:
1. Login como COBRADOR
2. Ir a `/usuarios`
3. Click "➕ Nuevo Usuario"
4. Llenar formulario
5. Al intentar crear, debe recibir error 403
6. Mensaje: "No tienes permisos para crear usuarios"

### 4. Validaciones de Formulario:
1. Intentar crear sin nombre → Error
2. Intentar crear sin email → Error
3. Intentar crear sin rol → Error
4. Email duplicado → Error "El email ya está registrado"

---

## 🚀 Para Ejecutar

### 1. Aplicar cambios en Base de Datos:

```sql
-- Ejecutar en DBeaver o MySQL:
ALTER TABLE usuarios 
ADD COLUMN debe_cambiar_password TINYINT(1) DEFAULT 0 
AFTER password;
```

### 2. Iniciar Backend:

```bash
cd backend
npm run dev
```

### 3. Iniciar Frontend:

```bash
cd web
npm run dev
```est

### 4. Acceder:

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

---

## ✅ Checklist de Funcionalidades

- [x] ADMIN puede crear cualquier tipo de usuario
- [x] SUPERVISOR solo puede crear SUPERVISOR/COBRADOR
- [x] SUPERVISOR no puede crear ADMIN
- [x] COBRADOR no puede crear usuarios
- [x] SUPERVISOR asigna usuarios a su misma empresa automáticamente
- [x] Contraseña automática: nombreEmpresa + año
- [x] Email único (sin duplicados)
- [x] Contraseñas encriptadas con bcrypt
- [x] JWT en todas las peticiones
- [x] Flag debe_cambiar_password en usuarios nuevos
- [x] Página de cambio de contraseña obligatorio
- [x] Redirección automática en login si debe cambiar contraseña
- [x] Listar usuarios con rol y empresa
- [x] Formulario adaptable según rol del usuario logueado
- [x] Mostrar contraseña temporal después de crear usuario
- [x] Validaciones frontend y backend

---

## 📝 Notas Adicionales

- La contraseña temporal se muestra una sola vez al crear el usuario
- El administrador debe copiar y enviar la contraseña al nuevo usuario
- Si se pierde la contraseña temporal, se debe implementar función de "Resetear contraseña"
- El sistema es seguro: todas las validaciones están en backend
- El frontend solo es una interfaz, no controla permisos

---

## 🔄 Próximas Mejoras Sugeridas

1. Botón "Resetear contraseña" en lista de usuarios
2. Envío de email automático con contraseña temporal
3. Editar usuarios existentes
4. Desactivar/activar usuarios
5. Historial de cambios de contraseña
6. Política de contraseñas más estricta (mayúsculas, números, símbolos)
7. Expiración de contraseñas temporales (ej: 24 horas)
8. Bloqueo de cuenta después de X intentos fallidos
