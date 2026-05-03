# Sistema de Logging Integrado con Vercel

Este documento describe la arquitectura completa del sistema de logging que captura y registra todos los errores y eventos en la aplicación FeedReader.

## Descripción General

El sistema de logging está diseñado para:
- Capturar errores en diferentes niveles (cliente, servidor, API)
- Enviar errores a Vercel para monitoreo en tiempo real
- Proporcionar interfaz visual para depuración durante desarrollo
- Almacenar historial de logs para análisis posterior
- Capturar errores globales no manejados

## Arquitectura

### 1. Logger Centralizado (`lib/logger.ts`)

El `Logger` es una clase singleton que:
- Captura información de errores con contexto completo
- Almacena logs en memoria (máximo 1000 entradas)
- Envía errores a Vercel automáticamente
- Proporciona métodos de consulta y exportación

**Métodos principales:**

```typescript
// Registrar información
logger.info('module', 'message', { details })

// Registrar advertencia
logger.warn('module', 'message', { details }, error?)

// Registrar error (enviado a Vercel)
logger.error('module', 'message', error, { details })

// Consultar logs
logger.getLogs({ module?: string, level?: LogLevel, since?: number })

// Resumen de errores recientes
logger.getErrorSummary(minutes: 5)

// Exportar todos los logs
logger.exportLogs() // Retorna JSON
```

### 2. Captura Global de Errores

#### Cliente (`components/logger-provider.tsx`)

El `LoggerProvider` inicializa:
- Captura de errores no controlados (`window.error`)
- Captura de promesas rechazadas (`unhandledrejection`)
- Monitoreo de performance
- Verificación de salud del API de logging

#### Servidor (`middleware.ts`)

Middleware captura:
- Solicitudes HTTP entrantes
- Respuestas del servidor
- Errores en el flujo de middleware

#### React Error Boundary (`app/error.tsx`)

Componente error boundary que:
- Captura errores durante rendering
- Registra con identificador único (digest)
- Proporciona UI de recuperación

### 3. API de Logging (`app/api/logs/route.ts`)

Endpoint que:
- Recibe logs del cliente
- Registra en stderr para Vercel
- Valida datos de entrada
- Proporciona health check

**Endpoints:**

```
POST /api/logs
  - Recibe logs del cliente
  - Valida y registra en Vercel

GET /api/logs/health
  - Verifica que el servicio funciona
```

### 4. Monitor Visual (`components/log-monitor.tsx`)

Componente disponible en desarrollo que:
- Muestra contador de errores en tiempo real
- Abre diálogo con detalles de errores
- Permite exportar logs a JSON
- Permite limpiar historial

## Integración con Vercel

### Flujo de Errores

1. **Cliente**: Error ocurre → Logger captura → Envía a `/api/logs` via `sendBeacon`
2. **API**: Recibe log → Registra en stderr → Vercel captura automáticamente
3. **Vercel**: Almacena en sistema de logging → Visible en dashboard

### Formatos de Log en Vercel

```
[v0] ERROR ModuleName: Message
[CLIENT_ERROR] { timestamp, module, message, error, details, ... }
[SERVER_ERROR] (desde API routes)
[VERCEL_ERROR] (desde middleware)
```

## Uso en la Aplicación

### Registrar Errores

```typescript
import { logger } from '@/lib/logger'

try {
  // Operación
} catch (error) {
  logger.error('MyModule', 'Operación falló', error, {
    userId: user.id,
    action: 'createItem'
  })
}
```

### Registrar Información

```typescript
logger.info('Auth', 'Usuario autenticado', {
  userId: user.id,
  timestamp: Date.now()
})
```

### Registrar Advertencias

```typescript
logger.warn('FeedSync', 'Sincronización lenta', {
  duration: 5000,
  itemsCount: 100
}, error)
```

## Depuración

### Durante Desarrollo

1. Abre la aplicación
2. Busca el botón rojo en la esquina inferior derecha (muestra `[n]` con número de errores)
3. Haz clic para ver detalles de errores
4. Usa "Exportar" para obtener JSON completo
5. Usa "Limpiar" para reiniciar el contador

### Accediendo Console

```javascript
// En browser console:

// Ver logs recientes
window.logger?.getLogs()

// Ver errores últimas 10 minutos
window.logger?.getLogs({ level: 'error', since: Date.now() - 10*60*1000 })

// Resumen de errores
window.logger?.getErrorSummary(10)

// Exportar logs
copy(window.logger?.exportLogs())
```

### En Vercel Dashboard

1. Ve a Project Settings → Logs
2. Busca por `[v0]`, `[CLIENT_ERROR]`, `[SERVER_ERROR]`
3. Filtra por rango de tiempo
4. Analiza patrones de errores

## Mejores Prácticas

### ✅ Hacer

```typescript
// Incluir contexto relevante
logger.error('FeedSync', 'Failed to sync feed', error, {
  sourceId: source.id,
  itemCount: items.length,
  duration: Date.now() - startTime
})

// Usar módulos descriptivos
logger.info('Auth', 'Login successful')
logger.info('FeedSync', 'Sync started')

// Capturar stack traces
logger.error('API', 'Request failed', new Error(errorMessage))
```

### ❌ No Hacer

```typescript
// No omitir contexto
logger.error('Module', 'Error occurred', error) // ❌ Sin detalles

// No usar módulos genéricos
logger.info('App', 'Something happened') // ❌ Muy vago

// No silenciar errores
try { /* ... */ } catch (e) { } // ❌ Sin logging
```

## Niveles de Log

| Nivel | Uso | Ejemplo |
|-------|-----|---------|
| `info` | Eventos normales | Login exitoso, sincronización iniciada |
| `warn` | Situaciones anómalas pero manejables | Operación lenta, reintentos en curso |
| `error` | Errores que impactan funcionalidad | Fallo de API, error de sincronización |

## Almacenamiento y Retención

- **En Memoria**: Máximo 1000 entradas (rotación FIFO)
- **En Vercel**: Configurable en dashboard (típicamente 7-30 días)
- **Export Local**: JSON descargable para análisis offline

## Troubleshooting

### Los errores no aparecen en Vercel

1. Verifica que `/api/logs` esté respondiendo: `curl http://localhost:3000/api/logs/health`
2. Comprueba que `NEXT_PUBLIC_VERCEL_ENABLED` no esté deshabilitado
3. Revisa que los logs estén llegando a `/api/logs`

### Monitor visual no aparece

1. Asegúrate de estar en desarrollo (`NODE_ENV === 'development'`)
2. Verifica que `LogMonitor` esté incluído en `app/layout.tsx`
3. Comprueba que no haya errores en la consola

### Logs antiguos desaparecen

Normal - el logger mantiene máximo 1000 entradas en memoria. Exporta antes de que se rotacionen.

## Performance

- **Overhead**: Mínimo (~1ms por log, solo en errors)
- **Memoria**: ~1MB para 1000 logs
- **Network**: 1 request por error (con sendBeacon, no bloquea)

## Seguridad

- No se registran credenciales o tokens
- Sanitizar datos sensibles antes de loguear
- Los logs en Vercel solo son accesibles al owner del proyecto
- Auditoría disponible en Vercel Activity Log
