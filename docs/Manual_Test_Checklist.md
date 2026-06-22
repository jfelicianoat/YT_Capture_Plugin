# Checklist manual de fase 4

Registrar versión del navegador, URL del vídeo, resultado y captura del error si un caso falla. No marcar un caso como superado solo porque exista una prueba unitaria equivalente.

## Preparación

- [ ] Ejecutar `npm run verify` sin errores.
- [ ] Cargar la extensión sin empaquetar siguiendo `docs/Installation.md`.
- [ ] Abrir las herramientas del popup mediante clic derecho → **Inspeccionar** y confirmar que no aparecen errores al iniciarlo.

## Chrome — flujo principal

- [ ] Vídeo con subtítulos manuales en el idioma de la interfaz: el popup indica `Manual` y descarga un Markdown válido.
- [ ] Vídeo únicamente con subtítulos automáticos: el popup indica `Automática`.
- [ ] Vídeo con varios idiomas: se elige primero la pista manual del idioma de la interfaz.
- [ ] Vídeo sin subtítulos: se descarga con `has_transcript: false`, `transcript_source: null` y sección vacía.
- [ ] Navegación SPA a otro vídeo con el popup abierto: cambian título, canal y estado sin reutilizar la captura anterior.
- [ ] Segunda captura del mismo título: no sobrescribe la primera y utiliza `[video_id]` cuando se detecta la colisión.

## Chrome — errores y límites

- [ ] Página que no es un vídeo: botón deshabilitado y mensaje informativo.
- [ ] Vídeo privado, eliminado o no disponible: botón deshabilitado y error claro, sin fichero.
- [ ] Bloquear temporalmente `*timedtext*` desde **Network request blocking**: tras un máximo de 15 segundos se permite capturar sin transcripción.
- [ ] Denegar o cancelar la descarga: se muestra el error y el popup permite reintentar.
- [ ] Confirmar que un nombre con Unicode se conserva y no contiene caracteres Windows inválidos.
- [ ] Abrir el fichero como UTF-8 y confirmar frontmatter cerrado, `contract_version: "1.0"`, `status: "pending"` y transcripción sin traducción ni resumen.

## Edge — comprobación secundaria

- [ ] La extensión carga sin advertencias de manifiesto.
- [ ] Un vídeo con subtítulos muestra metadata y descarga el Markdown.
- [ ] Una página no YouTube mantiene el botón deshabilitado.
- [ ] El fichero se guarda bajo `Downloads/YT-Knowledge-Inbox/`.

## Cierre

- [ ] Adjuntar el SHA-256 del ZIP probado.
- [ ] Confirmar que el validador del Orchestrator acepta al menos un fichero con transcripción y uno sin ella cuando esté implementado.
- [ ] Registrar incidencias pendientes antes de marcar las fases 2, 3 y 4 como cerradas.
