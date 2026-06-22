# Instalar YT Knowledge Capture

La extensión no necesita compilación ni `npm install`. La carpeta raíz del proyecto ya contiene todo lo que Chrome y Edge necesitan:

```text
YT_Capture_Plugin/
├── manifest.json
├── popup/
└── src/
```

## Chrome

1. Escribir `chrome://extensions/` en la barra de direcciones.
2. Activar **Modo desarrollador**, arriba a la derecha.
3. Pulsar **Cargar extensión sin empaquetar**.
4. Seleccionar exactamente esta carpeta:

   ```text
   D:\Desarrollo\Proyectos TFM\YT_Capture_Plugin
   ```

5. Confirmar que aparece **YT Knowledge Capture 0.1.0**.
6. Abrir un vídeo de YouTube y pulsar el icono de la extensión.

No se debe seleccionar `src`, `popup` ni `dist`: Chrome necesita la carpeta que contiene `manifest.json`.

Para verla en la barra del navegador, abrir el menú de extensiones —icono de pieza de puzle— y fijar **YT Knowledge Capture**.

Para usarla en incógnito, abrir **Detalles** y activar **Permitir en incógnito**.

## Microsoft Edge

1. Abrir `edge://extensions/`.
2. Activar **Modo de desarrollador**.
3. Pulsar **Cargar desempaquetada**.
4. Seleccionar `D:\Desarrollo\Proyectos TFM\YT_Capture_Plugin`.

## Actualizar después de modificar el código

Volver a `chrome://extensions/` o `edge://extensions/` y pulsar el botón **Recargar** de la extensión.

## Crear el ZIP de distribución

Ejecutar desde PowerShell:

```powershell
cd "D:\Desarrollo\Proyectos TFM\YT_Capture_Plugin"
.\GENERAR_ZIP.cmd
```

El resultado será:

```text
dist\yt-capture-plugin-0.1.0.zip
```

El ZIP no se carga directamente en modo desarrollador. Primero hay que extraerlo y después seleccionar la carpeta extraída que contiene `manifest.json`.

## Comprobar la instalación

Al abrir el popup sobre un vídeo deben mostrarse título, canal, duración y estado de la transcripción. El botón **Capturar vídeo** descarga el Markdown en:

```text
Descargas\YT-Knowledge-Inbox\
```
