# YT Capture Plugin

Extensión de Chrome (Manifest V3) que captura metadatos y transcripciones de videos de YouTube, los valida contra un contrato de datos y los persiste como archivos Markdown estructurados listos para procesamiento por un Orchestrator.

## Cómo funciona

1. Navegás a un video de YouTube
2. Hacés clic en el ícono de la extensión
3. El popup detecta los datos del video (título, canal, duración, transcripción disponible)
4. Presionás **CAPTURAR VIDEO** y la extensión:
   - Extrae metadata y transcripción
   - Valida el objeto completo contra el esquema de captura v1
   - Si es válido → descarga el `.md` en `YT-Knowledge-Inbox/`
   - Si es inválido → muestra el error de contrato en el popup (campo + motivo)

> Sin validación no hay descarga. Un objeto inválido se bloquea en el popup.

## Estrategia de extracción (3 niveles)

| Nivel | Método | Tasa de éxito |
|-------|--------|---------------|
| 1 | **Schema.org JSON-LD** — `application/ld+json` | ~95% |
| 2 | **Variables globales YT** — `ytInitialPlayerResponse` | ~85% |
| 3 | **Selectores DOM** — selectores de título/canal | ~70% |

La extracción que necesita variables de la página se ejecuta con `chrome.scripting.executeScript` en `world: "MAIN"` y devuelve solo un objeto serializable con campos conocidos.

### Transcripciones

Busca `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks` y prioriza:
1. Pista manual del idioma del usuario
2. Pista automática del mismo idioma
3. Primera pista disponible

Convierte el `baseUrl` (formato `json3`) a líneas `[HH:MM:SS] texto` en orden cronológico. Si no hay pistas disponibles, genera el Markdown igual con `has_transcript: false`.

## Formato de salida

```
[YYYY-MM-DD] - [Título-Sanitizado].md
```

Ejemplo: `2024-06-20 - Cómo Configurar Ollama para Modelos Locales de IA.md`

En colisión de nombre se añade `[video_id]`. Límite de 200 caracteres, se eliminan caracteres inválidos de Windows.

### Frontmatter YAML

```yaml
capture_id: "yt_20240620_143022_dQw4w9WgXcQ"
source_type: "youtube"
video_id: "dQw4w9WgXcQ"
title: "Cómo Configurar Ollama para Modelos Locales de IA"
channel: "TechChannel Pro"
channel_url: "https://www.youtube.com/@techchannelpro"
duration_seconds: 1725
published_date: "2024-05-10"
captured_at: "2024-06-20T14:30:22Z"
transcript_language: "es"
has_transcript: true
transcript_source: "manual" | "automatic" | null
extraction_method: "schema_jsonld" | "yt_globals" | "dom_selectors"
plugin_version: "1.0.0"
status: "pending"
```

## Instalación

1. Abrí `chrome://extensions/`
2. Activá **Modo desarrollador**
3. Clic en **Cargar extensión sin empaquetar**
4. Seleccioná la carpeta del proyecto

> Funciona en modo normal e incógnito. Sin configuración adicional.

## Permisos

| Permiso | Propósito |
|---------|-----------|
| `activeTab` | Acceder a la pestaña activa de YouTube |
| `downloads` | Guardar el `.md` en `YT-Knowledge-Inbox/` |
| `scripting` | Ejecutar scripts de extracción en `world: MAIN` |
| `host_permissions` | Solo `https://www.youtube.com/*` |

## Seguridad y privacidad

- Todo el procesamiento se realiza en el navegador; la única petición de red adicional es a los subtítulos del propio dominio de YouTube
- No se envía telemetría ni datos a servidores externos
- Permisos mínimos: solo lo necesario para capturar y descargar

## Pruebas

- Videos con subtítulos manuales, automáticos, varios idiomas y sin subtítulos
- Navegación interna SPA de YouTube sin recargar la pestaña
- Títulos con Unicode, caracteres inválidos, más de 200 caracteres y duplicados
- Página que no sea un video, video privado/no disponible y fallo de descarga
- Validación de fixtures inválidos: campo obligatorio faltante, tipo incorrecto y versión desconocida

## Stack

- Chrome Extension Manifest V3
- JavaScript (Service Worker + Popup)
- CSS local (popup UI 350x500px)
- Salida: Markdown con frontmatter YAML

## Desarrollo

Las fases 1 y 2 incluyen la estructura Manifest V3, el contrato de captura v1, la validación previa a cualquier descarga y la extracción real de metadata y transcripciones de YouTube. La selección de metadata usa JSON-LD, variables globales y DOM en ese orden; la transcripción admite pistas manuales, automáticas y vídeos sin subtítulos.

La generación y descarga del Markdown siguen deshabilitadas hasta la fase 3. Por ese motivo, el botón **CAPTURAR VIDEO** permanece inactivo aunque el popup muestre correctamente los datos detectados.

```powershell
node --test
```

```text
manifest.json
popup/
src/
  contracts/
  extraction/
  markdown/
  download/
tests/
```

## Compatibilidad

- Chrome (primario)
- Edge (secundario)
- Firefox (secundario)

## Licencia

MIT
