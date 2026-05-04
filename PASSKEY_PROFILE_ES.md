# Funcionalidad de Gestión de Passkeys en Perfil

## Descripción General
La funcionalidad de gestión de passkeys permite a los usuarios administrar de forma segura sus credenciales WebAuthn/Passkey desde su página de perfil de usuario en `/profile`.

## Características

### Agregar Passkey
Los usuarios pueden registrar nuevos passkeys a través del botón "Add Passkey":
1. Abre un diálogo con entrada opcional de nombre de dispositivo
2. Activa el flujo de registro WebAuthn
3. Utiliza el método biométrico o de seguridad del dispositivo (Face ID, Touch ID, Windows Hello, etc.)
4. Almacena el passkey de forma segura en la base de datos

### Ver Passkeys
Los usuarios pueden ver todos sus passkeys registrados con:
- Nombre del dispositivo
- Fecha de creación
- Última fecha de uso (si aplica)
- Lista de transportes de autenticación disponibles

### Eliminar Passkey
Los usuarios pueden eliminar passkeys que ya no necesitan:
- Hacer clic en el botón de eliminar en cualquier passkey
- El passkey se elimina inmediatamente de la base de datos
- El usuario cierra sesión si elimina su único método de autenticación

## Detalles Técnicos

### Endpoints de API

#### GET `/api/user/passkeys`
Recupera todos los passkeys del usuario autenticado.

**Respuesta:**
```json
{
  "passkeys": [
    {
      "id": "uuid",
      "device_name": "iPhone 15",
      "created_at": "2026-05-04T10:30:00Z",
      "last_used_at": "2026-05-04T14:20:00Z",
      "transports": ["internal", "ble"]
    }
  ]
}
```

#### DELETE `/api/user/passkeys`
Elimina un passkey específico por ID.

**Solicitud:**
```json
{
  "credentialId": "uuid"
}
```

#### GET `/api/user/profile`
Recupera la información de perfil del usuario.

**Respuesta:**
```json
{
  "userId": "uuid",
  "email": "usuario@ejemplo.com",
  "displayName": "Juan Pérez",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

#### POST `/api/auth/logout`
Cierra la sesión actual del usuario.

### Tablas de Base de Datos

#### passkey_credentials
- `id`: UUID - Clave primaria
- `user_id`: UUID - Clave foránea a la tabla users
- `credential_id`: String - Identificador único de credencial
- `credential_public_key`: String - Clave pública codificada en Base64
- `counter`: Integer - Contador para detección de credencial clonada
- `transports`: Array - Transportes de autenticación disponibles
- `device_name`: String - Nombre del dispositivo fácil de usar
- `created_at`: Timestamp - Cuándo se registró el passkey
- `last_used_at`: Timestamp - Última vez que se utilizó para autenticación

#### passkey_challenges
- `id`: UUID - Clave primaria
- `user_id`: UUID - Clave foránea a la tabla users
- `challenge`: String - Desafío WebAuthn
- `challenge_type`: String - 'registration' o 'authentication'
- `created_at`: Timestamp - Hora de creación del desafío
- `expires_at`: Timestamp - Expiración del desafío (10 minutos)

### Seguridad a Nivel de Fila (RLS)
- Los usuarios solo pueden leer sus propios passkeys
- Los usuarios solo pueden insertar passkeys para su propia cuenta
- Los usuarios solo pueden actualizar sus propios passkeys
- Los usuarios solo pueden eliminar sus propios passkeys

## Componentes

### PasskeyManager (`components/profile/passkey-manager.tsx`)
Componente cliente principal para la gestión de passkeys:
- Muestra lista de passkeys registrados
- Proporciona diálogo para agregar passkey
- Maneja eliminación con confirmación
- Muestra estados de carga y mensajes de error
- Se integra con utilidades WebAuthn

### Página de Perfil (`app/profile/page.tsx`)
Página de perfil del usuario que contiene:
- Sección de información de cuenta
- Componente PasskeyManager
- Funcionalidad de cerrar sesión
- Ruta protegida (redirige a login si no está autorizado)

## Flujo de Uso

1. **Usuario navega al perfil**: Hace clic en "Perfil" en el menú desplegable del encabezado
2. **La página carga**: Obtiene el perfil del usuario y los passkeys existentes
3. **Agregar passkey**:
   - El usuario hace clic en "Add Passkey"
   - Ingresa el nombre del dispositivo (opcional)
   - Hace clic en "Register Passkey"
   - El dispositivo solicita verificación biométrica/de seguridad
   - El passkey se registra y se almacena
4. **Ver passkeys**: El usuario puede ver todos sus passkeys registrados
5. **Eliminar passkey**: El usuario puede eliminar cualquier passkey con el botón de eliminar

## Manejo de Errores
- Desafíos inválidos o expirados
- Verificación fallida de credencial
- Campos requeridos faltantes
- Intentos de acceso no autorizado
- Errores de base de datos

Todos los errores se registran y se muestran al usuario con notificaciones toast apropiadas.

## Consideraciones de Seguridad
- WebAuthn maneja todas las operaciones criptográficas
- Solo se almacenan claves públicas, no privadas
- Los desafíos expiran después de 10 minutos
- Detección de credencial clonada basada en contador
- Las políticas RLS hacen cumplir el aislamiento de datos
- HTTPS requerido para WebAuthn en producción

## Mejoras Futuras
- [ ] Renombrar passkey después del registro
- [ ] Seguimiento y visualización de última fecha de uso
- [ ] Códigos de copia de seguridad de passkey
- [ ] Opciones de recuperación de cuenta
- [ ] Gestión de passkey de administrador
- [ ] Gestión de sesiones (ver sesiones activas)
