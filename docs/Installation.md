# Instalación y empaquetado

> Para una instalación directa y breve desde Windows, consulta también `INSTALAR_EN_NAVEGADOR.md`.

## Requisitos de desarrollo

- Node.js 20 o superior.
- Chrome 102 o superior, o una versión actual de Microsoft Edge.

## Verificación

Desde la raíz del proyecto:

```powershell
npm run verify
```

Este comando ejecuta la suite completa, valida el manifiesto, comprueba sus referencias y analiza la sintaxis de los scripts sin ejecutar el popup.

## Carga sin empaquetar en Chrome

No hay que compilar la extensión ni instalar dependencias. La propia raíz del proyecto es la carpeta instalable.

1. Abrir `chrome://extensions/`.
2. Activar **Modo desarrollador**.
3. Pulsar **Cargar extensión sin empaquetar**.
4. Seleccionar la raíz de `YT_Capture_Plugin`, donde está `manifest.json`.
5. Después de cada cambio, pulsar **Recargar** en la tarjeta de la extensión.

Para usarla en incógnito hay que abrir **Detalles** y activar **Permitir en incógnito**. Chrome no concede este permiso automáticamente.

## Carga sin empaquetar en Edge

1. Abrir `edge://extensions/`.
2. Activar **Modo de desarrollador**.
3. Pulsar **Cargar desempaquetada**.
4. Seleccionar la raíz del proyecto.

## ZIP reproducible

```powershell
npm run package
```

La salida predeterminada es `dist/yt-capture-plugin-<version>.zip`. El ZIP contiene exclusivamente `manifest.json`, `popup/` y `src/`, usa rutas ordenadas y timestamps fijos, por lo que el mismo contenido produce el mismo SHA-256.

Para elegir otro directorio de salida:

```powershell
$env:YT_CAPTURE_PACKAGE_DIR = "$env:TEMP"
npm run package
```

Chrome y Edge no cargan este ZIP directamente en modo desarrollador: hay que extraerlo y seleccionar la carpeta que contiene `manifest.json`.

Para comprobar el hash:

```powershell
Get-FileHash -Algorithm SHA256 .\dist\yt-capture-plugin-0.1.0.zip
```
