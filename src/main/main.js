'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Markdown CRUD',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (isDev) {
    mainWindow.webContents.on('did-finish-load', () => {
      // mainWindow.webContents.openDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo archivo', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:new') },
        { label: 'Abrir archivo...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu:open') },
        { type: 'separator' },
        { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save') },
        { type: 'separator' },
        { label: 'Exportar HTML', click: () => mainWindow.webContents.send('menu:export-html') },
        { label: 'Exportar PDF', click: () => mainWindow.webContents.send('menu:export-pdf') },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------- Helpers ----------------

function safeJoin(baseDir, filename) {
  const resolved = path.resolve(baseDir, filename);
  const base = path.resolve(baseDir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('Ruta fuera de la carpeta permitida');
  }
  return resolved;
}

async function normalizeToMd(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown' || ext === '.mdown') {
    return filePath;
  }
  return filePath + '.md';
}

function readFileText(filePath) {
  return fsp.readFile(filePath, 'utf8');
}

function writeFileText(filePath, content) {
  return fsp.writeFile(filePath, content, 'utf8');
}

// ---------------- IPC: Nuevo ----------------

ipcMain.handle('file:new', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Crear nuevo archivo Markdown',
    defaultPath: 'nuevo.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] }]
  });
  if (result.canceled || !result.filePath) return null;
  const filePath = await normalizeToMd(result.filePath);
  await writeFileText(filePath, '# Nuevo documento\n\nComienza a escribir aquí...\n');
  return { filePath, content: await readFileText(filePath) };
});

// ---------------- IPC: Abrir ----------------

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir archivo Markdown',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return { filePath, content: await readFileText(filePath) };
});

// ---------------- IPC: Guardar ----------------

ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  if (!filePath) return null;
  await writeFileText(filePath, content);
  return { filePath };
});

ipcMain.handle('file:save-as', async (_event, { content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar archivo Markdown como...',
    defaultPath: 'documento.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] }]
  });
  if (result.canceled || !result.filePath) return null;
  const filePath = await normalizeToMd(result.filePath);
  await writeFileText(filePath, content);
  return { filePath, content };
});

// ---------------- IPC: Renombrar ----------------

ipcMain.handle('file:rename', async (_event, { oldPath }) => {
  if (!oldPath) return null;
  const dir = path.dirname(oldPath);
  const oldName = path.basename(oldPath);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Renombrar archivo',
    defaultPath: path.join(dir, oldName),
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] }]
  });
  if (result.canceled || !result.filePath) return null;
  const newPath = await normalizeToMd(result.filePath);
  if (newPath.toLowerCase() === oldPath.toLowerCase()) return { filePath: oldPath };
  await fsp.rename(oldPath, newPath);
  return { filePath: newPath };
});

// ---------------- IPC: Eliminar ----------------

ipcMain.handle('file:delete', async (_event, { filePath }) => {
  if (!filePath) return { deleted: false };
  const base = path.basename(filePath);
  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: 'warning',
    buttons: ['Eliminar', 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    title: 'Eliminar archivo',
    message: `¿Eliminar definitivamente "${base}"?`,
    detail: 'Esta acción no se puede deshacer.'
  });
  if (choice !== 0) return { deleted: false };
  await fsp.unlink(filePath);
  return { deleted: true };
});

// ---------------- IPC: Buscar en archivo abierto ----------------

ipcMain.handle('file:search-in-file', (_event, { content, query }) => {
  if (!query) return { count: 0, matches: [] };
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matches = [];
  let index = 0;
  while (index < content.length) {
    index = lowerContent.indexOf(lowerQuery, index);
    if (index === -1) break;
    matches.push({ start: index, end: index + query.length });
    index += Math.max(query.length, 1);
  }
  return { count: matches.length, matches };
});

// ---------------- IPC: Abrir carpeta y listar archivos md ----------------

ipcMain.handle('folder:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir carpeta',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const dir = result.filePaths[0];
  const files = await listMarkdownFiles(dir, dir);
  return { dir, files };
});

ipcMain.handle('folder:reload', async (_event, { dir }) => {
  if (!dir) return null;
  const files = await listMarkdownFiles(dir, dir);
  return { dir, files };
});

async function listMarkdownFiles(baseDir, currentDir, depth = 0) {
  if (depth > 6) return [];
  let entries = [];
  try {
    entries = await fsp.readdir(currentDir, { withFileTypes: true });
  } catch (_err) {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const sub = await listMarkdownFiles(baseDir, full, depth + 1);
      files.push(...sub);
    } else if (entry.isFile() && /\.(md|markdown|mdown)$/i.test(entry.name)) {
      files.push({ name: entry.name, path: full, rel: path.relative(baseDir, full) });
    }
  }
  return files;
}

ipcMain.handle('file:read', async (_event, { filePath }) => {
  return { filePath, content: await readFileText(filePath) };
});

// ---------------- IPC: Exportar HTML ----------------

ipcMain.handle('file:export-html', async (_event, { html, title }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar como HTML',
    defaultPath: (title || 'documento').replace(/\.(md|markdown|mdown)$/i, '') + '.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const cssPath = require.resolve('github-markdown-css/github-markdown.css');
  const css = await fsp.readFile(cssPath, 'utf8');
  const hljsCssPath = require.resolve('highlight.js/styles/github.css');
  const hljsCss = await fsp.readFile(hljsCssPath, 'utf8');

  const document = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || 'Documento')}</title>
<style>
:root {
  --color-fg-default: #1f2328;
  --color-fg-muted: #57606a;
  --color-canvas-default: #ffffff;
  --color-canvas-subtle: #f6f8fa;
  --color-border-default: #d0d7de;
  --color-accent-fg: #0969da;
}
${css}
${hljsCss}
body { box-sizing: border-box; max-width: 900px; margin: 0 auto; padding: 40px 30px; }
.markdown-body table { display: table; border-collapse: collapse; background: #ffffff; color: #1f2328; }
.markdown-body th, .markdown-body td { background: #ffffff; color: #1f2328; border: 1px solid #d0d7de; }
.markdown-body tr:nth-child(2n) { background-color: #f6f8fa; }
.markdown-body tr:nth-child(2n) > td, .markdown-body tr:nth-child(2n) > th { background-color: #f6f8fa; }
.markdown-body th { font-weight: 600; }
.markdown-body strong { font-weight: 700; color: #1f2328; }
.markdown-body b { font-weight: 700; }
.markdown-body { color: #1f2328; }
</style>
</head>
<body>
<article class="markdown-body">${html}</article>
</body>
</html>`;

  await writeFileText(result.filePath, document);
  return { filePath: result.filePath };
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------- IPC: Exportar PDF ----------------

ipcMain.handle('file:export-pdf', async (_event, { html, basePath, title }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar como PDF',
    defaultPath: (title || 'documento').replace(/\.(md|markdown|mdown)$/i, '') + '.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  });

  try {
    const cssPath = require.resolve('github-markdown-css/github-markdown.css');
    const css = await fsp.readFile(cssPath, 'utf8');
    const hljsCssPath = require.resolve('highlight.js/styles/github.css');
    const hljsCss = await fsp.readFile(hljsCssPath, 'utf8');
    const baseHref = basePath ? `file://${path.dirname(basePath).replace(/\\/g, '/')}/` : '';

    const document = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<base href="${baseHref}">
<style>
:root {
  --color-fg-default: #1f2328;
  --color-fg-muted: #57606a;
  --color-canvas-default: #ffffff;
  --color-canvas-subtle: #f6f8fa;
  --color-border-default: #d0d7de;
  --color-accent-fg: #0969da;
}
${css}
${hljsCss}
body { box-sizing: border-box; max-width: 800px; margin: 0 auto; padding: 30px; }
@page { margin: 20mm; }
.markdown-body table { display: table; border-collapse: collapse; background: #ffffff; color: #1f2328; }
.markdown-body th, .markdown-body td { background: #ffffff; color: #1f2328; border: 1px solid #d0d7de; }
.markdown-body tr:nth-child(2n) { background-color: #f6f8fa; }
.markdown-body tr:nth-child(2n) > td, .markdown-body tr:nth-child(2n) > th { background-color: #f6f8fa; }
.markdown-body th { font-weight: 600; }
.markdown-body strong { font-weight: 700; color: #1f2328; }
.markdown-body b { font-weight: 700; }
.markdown-body { color: #1f2328; }
</style>
</head>
<body>
<article class="markdown-body">${html}</article>
</body>
</html>`;

    await pdfWindow.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(document)
    );
    const data = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    });
    await fsp.writeFile(result.filePath, data);
    await pdfWindow.close();
    return { filePath: result.filePath };
  } catch (err) {
    if (!pdfWindow.isDestroyed()) pdfWindow.close();
    throw err;
  }
});

// ---------------- App lifecycle ----------------

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
