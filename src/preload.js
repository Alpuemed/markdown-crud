'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // CRUD de archivos
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', { filePath }),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveFileAs: (content) => ipcRenderer.invoke('file:save-as', { content }),
  renameFile: (oldPath) => ipcRenderer.invoke('file:rename', { oldPath }),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', { filePath }),

  // Carpetas / búsqueda
  openFolder: () => ipcRenderer.invoke('folder:open'),
  reloadFolder: (dir) => ipcRenderer.invoke('folder:reload', { dir }),
  searchInFile: (content, query) => ipcRenderer.invoke('file:search-in-file', { content, query }),

  // Exportación
  exportHtml: (html, title) => ipcRenderer.invoke('file:export-html', { html, title }),
  exportPdf: (html, basePath, title) => ipcRenderer.invoke('file:export-pdf', { html, basePath, title }),

  // Menú -> renderer
  onMenu: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('menu:new', () => handler('new'));
    ipcRenderer.on('menu:open', () => handler('open'));
    ipcRenderer.on('menu:save', () => handler('save'));
    ipcRenderer.on('menu:export-html', () => handler('export-html'));
    ipcRenderer.on('menu:export-pdf', () => handler('export-pdf'));
    return () => {
      ipcRenderer.removeAllListeners('menu:new');
      ipcRenderer.removeAllListeners('menu:open');
      ipcRenderer.removeAllListeners('menu:save');
      ipcRenderer.removeAllListeners('menu:export-html');
      ipcRenderer.removeAllListeners('menu:export-pdf');
    };
  }
});
