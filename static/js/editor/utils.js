import { state } from './state.js?v=8';

export function convertMarkdownToHtml(markdown) {
  try {
    if (typeof marked !== 'undefined' && marked && marked.parse) {
      return marked.parse(markdown || '');
    }
  } catch (e) {}
  return String(markdown || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function setCurrentPdfLabel(name) {
  try {
    // Prioriza o elemento presente no editor (currentPdfLabel), mantendo compatibilidade com currentPdfName
    const labelEl = document.getElementById('currentPdfLabel') || document.getElementById('currentPdfName');
    if (!labelEl) return;
    const n = (name || '').trim();
    const baseName = String(n)
      .split(/[\\\/]/).pop()
      .replace(/\.pdf$/i, '');
    // Se estivermos usando currentPdfLabel, o texto esperado é apenas o nome do PDF; para currentPdfName mantém formato antigo
    if (labelEl.id === 'currentPdfLabel') {
      labelEl.textContent = baseName ? baseName : 'Nenhum PDF encontrado';
    } else {
      labelEl.textContent = n ? `PDF atual: ${n}` : 'Sem PDF selecionado';
    }
    // Atualiza também o título da toolbar do Adobe, quando presente
    try {
      const toolbarTitle = document.getElementById('adobeToolbarTitle');
      if (toolbarTitle) {
        const base = baseName;
        toolbarTitle.innerHTML = base
          ? `
            <img src="../images/icon_pdf_name_gallery.svg" alt="PDF" class="pdf-title-icon" />
            <span class="pdf-title-text">${base}</span>
          `
          : `
            <img src="../images/icon_pdf_name_gallery.svg" alt="PDF" class="pdf-title-icon" />
            <span class="pdf-title-text">Nenhum PDF encontrado</span>
          `;
      }
    } catch (_) {}
  } catch (e) {}
}

export function updateImageCount() {
  const count = state.imagensPosicionadas.length;
  const el = document.getElementById('imageCount');
  if (el) el.textContent = String(count);
}

// Conta imagens posicionadas diretamente a partir do DOM do editor,
// somando placeholders (.image-placeholder) e imagens diretas (<img>)
// que não estejam dentro de um placeholder. Funciona tanto no Jodit
// (conteúdo dentro do iframe) quanto no modo Documento.
export function updateImageCountFromDOM() {
  try {
    const doc = state.joditEditor && state.joditEditor.editorDocument;
    const root = (doc && doc.body) ? doc.body : document.getElementById('structuredSummary');
    if (!root) return;
    const placeholders = root.querySelectorAll('.image-placeholder');
    const directImgs = Array.from(root.querySelectorAll('img')).filter(img => !img.closest('.image-placeholder'));
    const total = placeholders.length + directImgs.length;
    const el = document.getElementById('imageCount');
    if (el) el.textContent = String(total);
  } catch (_) {}
}

export function getTextNodes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }
  return nodes;
}

export function buildImagemInfoLookup(imagens_info) {
  const lookup = {};
  if (!imagens_info || typeof imagens_info !== 'object') return lookup;
  for (const [key, info] of Object.entries(imagens_info)) {
    const baseFromKey = String(key).split(/[\\\/]/).pop();
    if (baseFromKey && !lookup[baseFromKey]) lookup[baseFromKey] = info;
    if (info && typeof info === 'object' && info.caminho) {
      const baseFromPath = String(info.caminho).split(/[\\\/]/).pop();
      if (baseFromPath && !lookup[baseFromPath]) lookup[baseFromPath] = info;
    }
  }
  return lookup;
}

export function getImagePageInfo(imageName) {
  let info = (state.estruturaEdicao && state.estruturaEdicao.imagens_info)
    ? state.estruturaEdicao.imagens_info[imageName]
    : undefined;
  if (!info && window.__imageInfoLookup) {
    info = window.__imageInfoLookup[imageName];
  }
  if (!info) return null;
  return info.pagina != null ? info : null;
}

export function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getSortedImages() {
  if (!state.estruturaEdicao || !Array.isArray(state.estruturaEdicao.images)) return [];
  return [...state.estruturaEdicao.images].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );
}