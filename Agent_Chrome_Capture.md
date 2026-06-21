# Agent: Chrome Capture Plugin (YT Capture Agent)

> **Precedencia:** la sección `Contrato Normativo del MVP` es la fuente de verdad; el código anterior es ilustrativo.



## Especificaciones Técnicas



**Tipo:** Chrome Extension Manifest V3

**Permisos:** activeTab, downloads, scripting

**Host permissions:** `https://www.youtube.com/*`

**Compatibilidad:** Chrome (primario), Edge/Firefox (secundario)

**Tamaño UI:** Popup 350x500px



## Estrategia de Extracción Resiliente (3 Niveles)



### Nivel 1: Schema.org JSON-LD (Más Estable - 95% éxito)

```javascript

function extractFromSchema() {

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {

        try {

            const data = JSON.parse(script.textContent);

            const videoData = Array.isArray(data) ? 

                data.find(d => d['@type'] === 'VideoObject') : 

                (data['@type'] === 'VideoObject' ? data : null);

            

            if (videoData) {

                return {

                    title: videoData.name,

                    channel: videoData.author?.name,

                    duration: parseDuration(videoData.duration),

                    publishDate: videoData.uploadDate,

                    method: 'schema_jsonld'

                };

            }

        } catch (e) { continue; }

    }

    return null;

}

```



### Nivel 2: Variables Globales YouTube (Estable - 85% éxito)

```javascript

function extractFromGlobals() {

    try {

        const playerResponse = window.ytInitialPlayerResponse;

        if (playerResponse?.videoDetails) {

            const vd = playerResponse.videoDetails;

            return {

                title: vd.title,

                channel: vd.author,

                duration: parseInt(vd.lengthSeconds),

                publishDate: playerResponse.microformat?.playerMicroformatRenderer?.publishDate,

                method: 'yt_globals'

            };

        }

    } catch (e) { }

    return null;

}

```



### Nivel 3: Selectores DOM (Fallback - 70% éxito)

```javascript

function extractFromDOM() {

    const titleSelectors = [

        'h1.ytd-videoPrimaryInfoRenderer',

        'h1[class*="title"]',

        '.watch-main-col h1'

    ];

    

    const channelSelectors = [

        '#channel-name a',

        '.ytd-channel-name a',

        '[class*="channel"] a'

    ];

    

    return {

        title: getTextFromSelectors(titleSelectors),

        channel: getTextFromSelectors(channelSelectors),

        method: 'dom_selectors'

    };

}

```



## UI/UX del Popup



### Estados Visuales del Botón

- **Inicial:** `📥 CAPTURAR VIDEO` (bg-blue-600)

- **Procesando:** `⏳ Capturando...` (bg-gray-500, animado)

- **Éxito:** `✅ ¡Capturado!` (bg-green-600, 2s)

- **Sin transcripción:** `⚠️ Capturado sin TX` (bg-orange-500, 3s)

- **Error:** `❌ Error al capturar` (bg-red-600, con detalle)



### Layout del Popup

```

┌─────────────────────────────────────┐

│  🎬  YT Knowledge Capture           │

├─────────────────────────────────────┤

│  📺 Título detectado                │

│  Canal: Nombre del canal            │

│  Duración: 28:45                    │

│  Publicado: 10 mayo 2024            │

│  Transcripción: ✅ Disponible       │

│                                     │

│  ┌─────────────────────────────┐    │

│  │     📥 CAPTURAR VIDEO       │    │

│  └─────────────────────────────┘    │

│                                     │

│  Estado: Listo para capturar        │

└─────────────────────────────────────┘

```



## Formato del Archivo Generado



### Nomenclatura

```

Patrón: [YYYY-MM-DD] - [Titulo-Sanitizado].md

Ejemplo: "2024-06-20 - Cómo Configurar Ollama para Modelos Locales de IA.md"

Colisión: "2024-06-20 - Título Duplicado [VideoID].md"

Límites: 200 caracteres, caracteres Windows inválidos eliminados

```



### Estructura del Markdown

```markdown

---

capture_id: "yt_20240620_143022_dQw4w9WgXcQ"

source_type: "youtube"

video_id: "dQw4w9WgXcQ"

url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

title: "Cómo Configurar Ollama para Modelos Locales de IA"

channel: "TechChannel Pro"

channel_url: "https://www.youtube.com/@techchannelpro"

duration_seconds: 1725

published_date: "2024-05-10"

captured_at: "2024-06-20T14:30:22Z"

transcript_language: "es"

has_transcript: true

extraction_method: "schema_jsonld"

plugin_version: "1.0.0"

status: "pending"

---



# Cómo Configurar Ollama para Modelos Locales de IA



**Canal:** TechChannel Pro  

**Duración:** 28:45  

**Publicado:** 10 mayo 2024  

**Capturado:** 20 junio 2024, 14:30  



## Transcripción



[00:00] Bienvenidos a este tutorial completo sobre Ollama...

[00:23] Primero vamos a ver los requisitos de sistema...

[01:15] El proceso de instalación es bastante directo...

```



## Manejo de Transcripciones



**Estrategia Principal:** Intentar acceso a transcripción automática de YouTube

**Fallback:** Marcar `has_transcript: false`; el Orchestrator lo registrará como error no reintentable

**Nota Importante:** El Orchestrator debe detectar archivos sin transcripción y moverlos a `/failed/`



## Instalación y Deployment



1. **Desarrollo:** Cargar como extensión descomprimida desde `chrome://extensions/`

2. **Distribución:** Empaquetar para Chrome Web Store (futuro)

3. **Configuración:** Sin configuración necesaria; descarga en `YT-Knowledge-Inbox/` dentro de Descargas

4. **Compatibilidad:** Funciona en modo normal e incógnito



## Consideraciones de Seguridad



- **Permisos mínimos:** Solo activeTab y downloads

- **Datos locales:** No envía información a servidores externos

- **Privacidad:** Procesa datos solo localmente en el navegador

## Contrato Normativo del MVP

Esta sección prevalece sobre cualquier ejemplo anterior que resulte ambiguo.

### Estructura mínima de la extensión

- Manifest V3 con `action.default_popup`, service worker y permisos `activeTab`, `downloads` y `scripting`.
- `host_permissions` limitado a `https://www.youtube.com/*`.
- El popup solo muestra los datos detectados, el botón de captura y el resultado. No mantiene historial ni configuración.
- La extracción que necesite variables de la página se ejecuta mediante `chrome.scripting.executeScript` en `world: "MAIN"`; solo se devuelve al contexto aislado un objeto serializable con campos conocidos.
- En páginas que no sean un vídeo de YouTube se deshabilita la captura y se muestra un mensaje informativo.

### Extracción de transcripciones

1. Localizar `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks` en el contexto principal.
2. Seleccionar primero una pista manual del idioma mostrado por YouTube; después una pista automática del mismo idioma; finalmente la primera pista disponible.
3. Solicitar el `baseUrl` de la pista con formato `json3` y convertir sus eventos en líneas `[HH:MM:SS] texto` en orden cronológico.
4. Normalizar espacios y entidades HTML, conservar el texto original y omitir eventos vacíos. No resumir ni traducir.
5. Si no existen pistas, la descarga falla o el contenido no puede analizarse, generar igualmente el Markdown con `has_transcript: false`, `transcript_source: null` y una sección de transcripción vacía.

El fichero debe indicar `transcript_source: "manual" | "automatic" | null` y `transcript_language`. La captura de metadata mantiene la jerarquía JSON-LD, variables globales y DOM ya descrita.

### Descarga y entrega al Orchestrator

- Antes de crear el Blob, validar el objeto completo contra una copia local exacta del esquema de captura v1 definido en `Data_Contracts.md`.
- Si falta un campo, el tipo es incorrecto o la versión no está soportada, no descargar el fichero. Mostrar `Error de contrato: <campo y motivo>` en el popup y registrar el detalle únicamente en la consola de la extensión.
- `chrome.downloads.download()` guardará el fichero en `YT-Knowledge-Inbox/<nombre>.md`, ruta relativa a la carpeta Descargas configurada en el navegador.
- El Orchestrator vigilará esa misma carpeta por defecto. No existe servidor local ni movimiento manual en el flujo normal.
- El nombre será `[YYYY-MM-DD] - [Título sanitizado].md`; la fecha es la de captura. En una colisión se añade `[video_id]`.
- La escritura es UTF-8. El nombre elimina caracteres inválidos de Windows, puntos o espacios finales y queda limitado a 200 caracteres incluyendo extensión.
- `capture_id` y `video_id` permiten al Orchestrator descartar capturas duplicadas.

### Pruebas mínimas

- Vídeo con subtítulos manuales, automáticos, varios idiomas y sin subtítulos.
- Navegación interna de YouTube sin recargar la pestaña.
- Títulos con Unicode, caracteres inválidos, más de 200 caracteres y nombres duplicados.
- Página que no sea un vídeo, vídeo privado/no disponible y fallo de descarga.
- Verificación del fichero contra el contrato v1 definido en `Data_Contracts.md`.
- Fixture inválido por cada campo obligatorio, tipo incorrecto y versión desconocida; ninguno debe producir una descarga.
