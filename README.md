# Markdown CRUD

Aplicación de escritorio para Windows 11 (Electron) que permite hacer **CRUD** (crear, leer, actualizar y eliminar) de archivos Markdown, con **vista previa estilizada en vivo**, **buscador de texto** y **exportación a HTML/PDF**.

## Características

- **Crear / Abrir / Editar / Renombrar / Eliminar** archivos `.md` / `.markdown` / `.mdown`
- **Vista previa en vivo** con estilos de GitHub (`github-markdown-css`)
- **Resaltado de sintaxis** de bloques de código (`highlight.js`)
- **Buscador de texto** dentro del documento abierto, con resaltado y navegación entre coincidencias
- **Explorador de carpeta** que lista los archivos Markdown para abrirlos rápidamente
- **Exportar a HTML** y **Exportar a PDF**
- Modos de vista: Split / Solo editor / Solo vista previa
- Estilo claro con texto oscuro legible (incluidas tablas y negritas)

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior
- Windows 10/11

## Puesta en marcha (desarrollo)

```bash
npm install
npm start
```

## Generar instalador para Windows

```bash
npm run build:win
```

El instalador `.exe` (NSIS) se generará en la carpeta `dist/`.

## Estructura del proyecto

```
markdown-crud/
├─ package.json          # dependencias + configuración electron-builder
├─ src/
│  ├─ main/main.js       # proceso principal (ventana, CRUD en disco, exportación)
│  ├─ preload.js         # API segura entre main y renderer (contextBridge)
│  └─ renderer/          # interfaz (editor + vista previa + buscador)
```

## Seguridad

- `contextIsolation: true` y `nodeIntegration: false`
- Comunicación mediante IPC acotado (`ipcMain.handle` / `ipcRenderer.invoke`) expuesto con `contextBridge`

## Licencia

MIT
