'use strict';

/* global window, markdownit, hljs */

const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>';
      } catch (_err) { /* fall through */ }
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

// ---------- Estado ----------
const state = {
  filePath: null,
  folder: null,
  files: [],
  search: {
    query: '',
    matches: [],
    index: -1
  },
  dirty: false
};

// ---------- Referencias DOM ----------
const els = {
  editor: document.getElementById('editor'),
  preview: document.getElementById('preview'),
  fileInfo: document.getElementById('file-info'),
  statusFile: document.getElementById('status-file'),
  statusExtra: document.getElementById('status-extra'),
  btnNew: document.getElementById('btn-new'),
  btnOpen: document.getElementById('btn-open'),
  btnSave: document.getElementById('btn-save'),
  btnRename: document.getElementById('btn-rename'),
  btnDelete: document.getElementById('btn-delete'),
  btnFolder: document.getElementById('btn-folder'),
  btnExportHtml: document.getElementById('btn-export-html'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  sidebar: document.getElementById('sidebar'),
  fileList: document.getElementById('file-list'),
  searchBox: document.getElementById('search'),
  searchInput: document.getElementById('search-input'),
  searchCount: document.getElementById('search-count'),
  searchPrev: document.getElementById('search-prev'),
  searchNext: document.getElementById('search-next'),
  searchClose: document.getElementById('search-close'),
  view: document.getElementsByName('view')
};

// ---------- Utilidades ----------
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function basename(p) {
  return p ? p.split(/[\\/]/).pop() : '';
}

function updateTitle() {
  const name = state.filePath ? basename(state.filePath) : 'Sin archivo';
  document.title = (state.dirty ? '* ' : '') + name + ' - Markdown CRUD';
}

// ---------- Renderizado de vista previa ----------
function renderPreview() {
  const html = md.render(els.editor.value);
  els.preview.innerHTML = html;
  applySearchHighlights();
}

function applySearchHighlights() {
  if (!state.search.query) return;
  const query = state.search.query;
  const treeWalker = document.createTreeWalker(
    els.preview,
    NodeFilter.SHOW_TEXT,
    null
  );
  const textNodes = [];
  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode);
  }
  for (const node of textNodes) {
    const lower = node.nodeValue.toLowerCase();
    const q = query.toLowerCase();
    if (lower.includes(q)) {
      wrapMatches(node, q);
    }
  }
  updateSearchMarkers();
}

function wrapMatches(textNode, query) {
  const frag = document.createDocumentFragment();
  const text = textNode.nodeValue;
  const lower = text.toLowerCase();
  let idx = 0;
  while (idx < text.length) {
    const found = lower.indexOf(query, idx);
    if (found === -1) {
      frag.appendChild(document.createTextNode(text.slice(idx)));
      break;
    }
    frag.appendChild(document.createTextNode(text.slice(idx, found)));
    const mark = document.createElement('mark');
    mark.className = 'search-hit';
    mark.textContent = text.slice(found, found + query.length);
    frag.appendChild(mark);
    idx = found + Math.max(query.length, 1);
  }
  textNode.parentNode.replaceChild(frag, textNode);
}

let searchMarkers = [];
function updateSearchMarkers() {
  searchMarkers = Array.from(els.preview.querySelectorAll('mark.search-hit'));
  els.searchCount.textContent = searchMarkers.length
    ? `${state.search.index + 1}/${searchMarkers.length}`
    : '0/0';
  searchMarkers.forEach((m, i) => m.classList.toggle('active', i === state.search.index));
  if (searchMarkers.length && searchMarkers[state.search.index]) {
    searchMarkers[state.search.index].scrollIntoView({ block: 'center' });
  }
}

// ---------- Búsqueda ----------
async function runSearch() {
  const query = els.searchInput.value;
  state.search.query = query;
  if (!query) {
    state.search.matches = [];
    state.search.index = -1;
    renderPreview();
    els.searchCount.textContent = '';
    return;
  }
  const res = await window.api.searchInFile(els.editor.value, query);
  state.search.matches = res.matches;
  state.search.index = res.matches.length ? 0 : -1;
  renderPreview();
}

function moveSearch(dir) {
  const n = state.search.matches.length;
  if (!n) return;
  state.search.index = (state.search.index + dir + n) % n;
  updateSearchMarkers();
}

// ---------- CRUD ----------
function openFileInEditor(filePath, content) {
  state.filePath = filePath;
  state.dirty = false;
  els.editor.value = content;
  clearSearch();
  renderPreview();
  updateTitle();
  els.fileInfo.title = filePath;
  els.fileInfo.textContent = filePath;
  els.statusFile.textContent = 'Archivo: ' + filePath;
  highlightActiveFile();
}

async function handleNew() {
  if (!await confirmDiscard()) return;
  const res = await window.api.newFile();
  if (!res) return;
  openFileInEditor(res.filePath, res.content);
  refreshFolder();
}

async function handleOpen() {
  if (!await confirmDiscard()) return;
  const res = await window.api.openFile();
  if (!res) return;
  openFileInEditor(res.filePath, res.content);
  refreshFolder();
}

async function confirmDiscard() {
  if (!state.dirty) return true;
  return window.confirm('Tienes cambios sin guardar. ¿Quieres continuar y descartarlos?');
}

async function handleSave() {
  if (!state.filePath) {
    return handleSaveAs();
  }
  const res = await window.api.saveFile(state.filePath, els.editor.value);
  if (res) {
    state.dirty = false;
    updateTitle();
    els.statusFile.textContent = 'Guardado: ' + state.filePath;
  }
}

async function handleSaveAs() {
  const res = await window.api.saveFileAs(els.editor.value);
  if (!res) return;
  openFileInEditor(res.filePath, res.content);
  refreshFolder();
}

async function handleRename() {
  if (!state.filePath) return;
  const res = await window.api.renameFile(state.filePath);
  if (!res) return;
  state.filePath = res.filePath;
  state.dirty = false;
  updateTitle();
  els.fileInfo.textContent = state.filePath;
  els.fileInfo.title = state.filePath;
  els.statusFile.textContent = 'Renombrado: ' + state.filePath;
  refreshFolder();
}

async function handleDelete() {
  if (!state.filePath) return;
  const res = await window.api.deleteFile(state.filePath);
  if (res.deleted) {
    state.filePath = null;
    state.dirty = false;
    els.editor.value = '';
    clearSearch();
    renderPreview();
    updateTitle();
    els.fileInfo.textContent = 'Sin archivo';
    els.statusFile.textContent = 'Sin archivo';
    refreshFolder();
  }
}

async function handleFolder() {
  const res = await window.api.openFolder();
  if (!res) return;
  state.folder = res.dir;
  state.files = res.files;
  renderFileList();
  els.sidebar.classList.remove('hidden');
}

function renderFileList() {
  els.fileList.innerHTML = '';
  if (!state.files.length) {
    const empty = document.createElement('div');
    empty.className = 'file-item';
    empty.textContent = 'Sin archivos .md';
    els.fileList.appendChild(empty);
    return;
  }
  for (const file of state.files) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.textContent = file.rel || file.name;
    item.title = file.path;
    item.dataset.path = file.path;
    item.addEventListener('click', () => loadFromList(file.path));
    els.fileList.appendChild(item);
  }
  highlightActiveFile();
}

function highlightActiveFile() {
  const items = els.fileList.querySelectorAll('.file-item');
  items.forEach((it) => {
    it.classList.toggle('active', state.filePath && it.dataset.path === state.filePath);
  });
}

async function loadFromList(filePath) {
  const res = await window.api.readFile(filePath);
  if (res) openFileInEditor(res.filePath, res.content);
}

async function refreshFolder() {
  if (!state.folder) return;
  const res = await window.api.reloadFolder(state.folder);
  if (res) {
    state.files = res.files;
    renderFileList();
  }
}

// ---------- Exportación ----------
async function handleExportHtml() {
  const html = md.render(els.editor.value);
  const title = state.filePath ? basename(state.filePath) : 'documento';
  const res = await window.api.exportHtml(html, title);
  if (res) els.statusFile.textContent = 'Exportado HTML: ' + res.filePath;
}

async function handleExportPdf() {
  const html = md.render(els.editor.value);
  const title = state.filePath ? basename(state.filePath) : 'documento';
  const res = await window.api.exportPdf(html, state.filePath, title);
  if (res) els.statusFile.textContent = 'Exportado PDF: ' + res.filePath;
}

// ---------- Vista (split / edit / preview) ----------
function getViewMode() {
  for (const r of els.view) if (r.checked) return r.value;
  return 'split';
}

function applyView() {
  const mode = getViewMode();
  const editorPane = document.getElementById('editor-pane');
  const previewPane = document.getElementById('preview-pane');
  if (mode === 'split') {
    editorPane.style.display = '';
    previewPane.style.display = '';
  } else if (mode === 'edit') {
    editorPane.style.display = '';
    previewPane.style.display = 'none';
  } else {
    editorPane.style.display = 'none';
    previewPane.style.display = '';
  }
}

// ---------- Limpieza de búsqueda ----------
function clearSearch() {
  state.search.query = '';
  state.search.matches = [];
  state.search.index = -1;
  els.searchInput.value = '';
  els.searchCount.textContent = '';
  els.searchBox.classList.add('hidden');
}

// ---------- Eventos ----------
els.btnNew.addEventListener('click', handleNew);
els.btnOpen.addEventListener('click', handleOpen);
els.btnSave.addEventListener('click', handleSave);
els.btnRename.addEventListener('click', handleRename);
els.btnDelete.addEventListener('click', handleDelete);
els.btnFolder.addEventListener('click', handleFolder);
els.btnExportHtml.addEventListener('click', handleExportHtml);
els.btnExportPdf.addEventListener('click', handleExportPdf);

els.view.forEach((r) => r.addEventListener('change', applyView));

els.editor.addEventListener('input', debounce(() => {
  state.dirty = true;
  updateTitle();
  renderPreview();
}, 120));

els.searchInput.addEventListener('input', debounce(runSearch, 200));
els.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) moveSearch(-1);
    else moveSearch(1);
  }
});
els.searchNext.addEventListener('click', () => moveSearch(1));
els.searchPrev.addEventListener('click', () => moveSearch(-1));
els.searchClose.addEventListener('click', () => {
  clearSearch();
  renderPreview();
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); handleNew(); }
  else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); handleOpen(); }
  else if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) { e.preventDefault(); handleSave(); }
  else if (mod && e.key.toLowerCase() === 'shift') { /* noop */ }
  else if (mod && e.key === 'f') { e.preventDefault(); els.searchBox.classList.remove('hidden'); els.searchInput.focus(); }
});

// Menú nativo
window.api.onMenu((action) => {
  if (action === 'new') handleNew();
  else if (action === 'open') handleOpen();
  else if (action === 'save') handleSave();
  else if (action === 'export-html') handleExportHtml();
  else if (action === 'export-pdf') handleExportPdf();
});

// Inicialización
applyView();
clearSearch();
updateTitle();
