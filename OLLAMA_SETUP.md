# Guía de Instalación de Ollama para FeedReader

## ¿Qué es Ollama?

Ollama es una herramienta que te permite ejecutar modelos de lenguaje de forma local en tu computadora. Esto significa que puedes usar IA sin enviar tus datos a servidores en la nube.

## Instalación

### 1. Descargar Ollama

Ve a [ollama.ai](https://ollama.ai) y descarga la versión para tu sistema operativo:
- **macOS** (Intel o Apple Silicon)
- **Linux** (Ubuntu, Fedora, etc.)
- **Windows** (Preview)

### 2. Instalar

Ejecuta el instalador y sigue las instrucciones en pantalla.

### 3. Descargar el modelo Mistral

Abre una terminal/consola y ejecuta:

```bash
ollama pull mistral
```

Esto descargará el modelo Mistral (7B - 4.7GB). Puede tomar unos minutos dependiendo de tu conexión.

### 4. Iniciar Ollama

Una vez descargado el modelo, Ollama se ejecutará en segundo plano automáticamente. Puedes verificar que esté corriendo visitando:

```
http://localhost:11434/api/tags
```

Si ves una respuesta JSON, ¡Ollama está funcionando!

## Uso en FeedReader

Una vez que Ollama esté corriendo con Mistral descargado:

1. Abre el FeedReader
2. Haz clic en el botón "Asistente IA" en el sidebar
3. En el selector de modelo, aparecerá "Mistral (Local)"
4. Selecciona Mistral para usar el modelo local

### Ventajas del modelo local (Mistral)

✅ **Privacidad**: Tus conversaciones nunca salen de tu computadora  
✅ **Velocidad**: Sin latencia de red  
✅ **Costo**: Completamente gratuito después de descargarlo  
✅ **Multilenguaje**: Soporta español, inglés y muchos idiomas más  
✅ **Eficiente**: Corre bien incluso en computadoras modestas

### Modelos alternativos disponibles en Ollama

Si quieres experimentar con otros modelos:

```bash
ollama pull llama2          # Modelo general
ollama pull neural-chat     # Optimizado para chat
ollama pull dolphin-mixtral # Modelo de mezcla
ollama pull openchat        # Chat optimizado
```

Para usar un modelo diferente, actualiza el código en `/app/api/chat/route.ts` línea 48 y cambia `'mistral'` por el nombre del modelo que quieras.

## Troubleshooting

**P: ¿Cómo sé si Ollama está corriendo?**
R: En tu navegador, ve a `http://localhost:11434/api/tags` - si ves JSON, está activo.

**P: Mistral dice "No disponible" en FeedReader**
R: Asegúrate que:
1. Ollama esté abierto/corriendo
2. Hayas descargado Mistral con `ollama pull mistral`
3. Estés en http://localhost (no funcionará en URLs públicas de v0)

**P: ¿Qué significa "useOllama" en FeedReader?**
R: Es un indicador interno que dice "usa el modelo local si está disponible". Si ves esto, todo está configurado correctamente.

## Gestión de modelos

Ver modelos descargados:
```bash
ollama list
```

Borrar un modelo (libera espacio):
```bash
ollama rm mistral
```

Actualizar Ollama:
```bash
# Windows: Ejecuta el instalador nuevamente
# macOS: brew upgrade ollama
# Linux: sudo apt upgrade ollama
```

---

**¿Problemas?** Visita [ollama.ai/help](https://ollama.ai/help) o reporta un issue en el repositorio.
