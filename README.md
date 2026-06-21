# YT Capture Plugin

Extensión de Chrome (Manifest V3) que captura metadatos y transcripciones de videos de YouTube y los guarda como archivos Markdown estructurados.

## Cómo funciona

1. Navegás a un video de YouTube
2. Hacés clic en el ícono de la extensión
3. El popup muestra los datos detectados (título, canal, duración, transcripción disponible)
4. Presionás **CAPTURAR VIDEO** y se genera un archivo `.md` en `YT-Knowledge-Inbox/`

Antes de descargar, la extensión valida el objeto completo contra el contrato de captura v1. Un error de versión, campo o tipo bloquea la descarga y se muestra claramente en el popup.

## Estrategia de extracción (3 niveles)

La extensión intenta extraer metadatos en este orden:

| Nivel | Método | Tasa de éxito |
|-------|--------|---------------|
| 1 | **Schema.org JSON-LD** — `application/ld+json` | ~95% |
| 2 | **Variables globales YT** — `ytInitialPlayerResponse` | ~85% |
| 3 | **Selectores DOM** — selectores de título/canal | ~70% |

### Transcripciones

Busca `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks` y prioriza:
1. Pista manual del idioma del usuario
2. Pista automática del mismo idioma
3. Primera pista disponible

Convierte el `baseUrl` (formato `json3`) a formato legible `[HH:MM:SS] texto`.

## Formato de salida

El archivo generado sigue esta nomenclatura:

```
[YYYY-MM-DD] - [Título-Sanitizado].md
```

Ejemplo: `2024-06-20 - Cómo Configurar Ollama para Modelos Locales de IA.md`

Incluye frontmatter YAML con metadatos completos y la transcripción en formato cronológico.

## Instalación

1. Abrí `chrome://extensions/`
2. Activá **Modo desarrollador**
3. Clic en **Cargar extensión sin empaquetar**
4. Seleccioná la carpeta del proyecto

> La extensión funciona en modo normal e incógnito. No requiere configuración adicional.

## Permisos

| Permiso | Propósito |
|---------|-----------|
| `activeTab` | Acceder a la pestaña activa de YouTube |
| `downloads` | Guardar el archivo `.md` en `YT-Knowledge-Inbox/` |
| `scripting` | Ejecutar scripts de extracción en el contexto de la página |
| `host_permissions` | Solo `https://www.youtube.com/*` |

## Seguridad y privacidad

- **Sin llamadas externas**: todo el procesamiento es local en el navegador
- **Permisos mínimos**: solo lo necesario para capturar metadatos y descargar el archivo
- **Cero telemetría**: no se envía información a servidores externos

## Stack

- Chrome Extension Manifest V3
- JavaScript (Service Worker + Popup)
- Tailwind CSS (popup UI)
- Formato: Markdown con frontmatter YAML

## Compatibilidad

- Chrome (primario)
- Edge (secundario)
- Firefox (secundario)

## Licencia

MIT
