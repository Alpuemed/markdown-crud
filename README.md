# Markdown CRUD

Desktop application for Windows 11 (Electron) that provides **CRUD** (create, read, update and delete) operations for Markdown files, with a **stylized live preview**, **text search** and **HTML/PDF export**.

## Features

- **Create / Open / Edit / Rename / Delete** `.md` / `.markdown` / `.mdown` files
- **Live preview** styled with GitHub CSS (`github-markdown-css`)
- **Syntax highlighting** for code blocks (`highlight.js`)
- **Text search** within the open document, with highlighting and navigation between matches
- **Folder explorer** that lists Markdown files for quick access
- **Export to HTML** and **Export to PDF**
- View modes: Split / Editor only / Preview only
- Light theme with readable dark text (including tables and bold text)

## Requirements

- [Node.js](https://nodejs.org) 18 or higher
- Windows 10/11

## Getting started (development)

```bash
npm install
npm start
```

## Build Windows installer

```bash
npm run build:win
```

The `.exe` installer (NSIS) will be generated in the `dist/` folder.

## Project structure

```
markdown-crud/
├─ package.json          # dependencies + electron-builder config
├─ src/
│  ├─ main/main.js       # main process (window, file CRUD, export)
│  ├─ preload.js         # safe API between main and renderer (contextBridge)
│  └─ renderer/          # UI (editor + preview + search)
```

## Security

- `contextIsolation: true` and `nodeIntegration: false`
- Communication through a restricted IPC (`ipcMain.handle` / `ipcRenderer.invoke`) exposed via `contextBridge`

## License

MIT