import { state, setGalleryMode as setGalleryModeState } from './state.js';
import { updateStatus, getTextNodes, getSortedImages, buildImagemInfoLookup, getImagePageInfo, updateImageCount } from './utils.js';

export function loadImageGallery() {
  const gallery = document.getElementById('imageGallery');
  if (!gallery) return;
  gallery.innerHTML = '';

  if (!state.estruturaEdicao || !Array.isArray(state.estruturaEdicao.images)) {
    updateImageCountInfo();
    // Atualiza contador no rótulo quando não há imagens
    renderGallerySwitchLabelCount();
    return;
  }

  const sorted = [...state.estruturaEdicao.images].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );

  sorted.forEach((imageName) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.draggable = true;
    imageItem.dataset.imageName = imageName;

    const info = getImagePageInfo(imageName);
    const baseName = imageName.replace('.png', '');
    const formattedName = baseName.replace(/^img_/i, 'imagem-');
    const displayName = (info && info.pagina != null)
      ? `${formattedName} — Página ${info.pagina}`
      : formattedName;

    imageItem.innerHTML = `
      <img src="/temp_uploads/imagens_extraidas/${imageName}?v=${state.galleryCacheBust}" alt="${imageName}">
      <button class="copy-btn" title="Copiar imagem" onclick="copyGalleryImage('${imageName}')" onmousedown="event.stopPropagation()">
        <img src="../images/copy_image_gallery.svg" alt="Copiar" width="18" height="18" />
      </button>
      <button class="view-btn" title="Visualizar imagem" onclick="openImageModal('${imageName}')" onmousedown="event.stopPropagation()">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
      <div class="copy-feedback" aria-live="polite">
        <img src="../images/copy_image_gallery.svg" alt="" width="20" height="20" />
        <span>Imagem foi copiada para a área de transferência</span>
      </div>
      <div class="image-name">${displayName}</div>
      <button class="delete-btn" onclick="deleteGalleryImage('${imageName}')" title="Excluir esta imagem da galeria">
        <img src="../images/delete_img_gallery.svg" alt="Excluir" width="18" height="18" />
      </button>
    `;

    imageItem.addEventListener('dragstart', handleDragStart);
    imageItem.addEventListener('dragend', handleDragEnd);

    gallery.appendChild(imageItem);
  });

  updateImageCountInfo();
  // Atualiza contador no rótulo após recarregar a galeria
  renderGallerySwitchLabelCount();

  const actions = document.querySelector('.gallery-actions');
  const emptyState = document.getElementById('galleryEmptyState');
  if (sorted.length === 0) {
    if (actions) actions.style.display = 'none';
    if (emptyState) emptyState.style.display = '';
  } else {
    if (actions) actions.style.display = '';
    if (emptyState) emptyState.style.display = 'none';
  }
}

export function loadCaptureGallery() {
  const gallery = document.getElementById('imageGallery');
  if (!gallery) return;
  gallery.innerHTML = '';

  const actions = document.querySelector('.gallery-actions');
  const emptyState = document.getElementById('galleryEmptyState');

  if (!Array.isArray(state.capturedImages) || state.capturedImages.length === 0) {
    if (actions) actions.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = '';
      const msg = emptyState.querySelector('.gallery-empty-message');
      const ctrls = emptyState.querySelector('.gallery-empty-controls');
  if (msg) msg.textContent = 'Nenhuma captura de tela salva. Use o botão CAPTURAR IMAGEM e depois cole (Ctrl+V) no editor para salvar aqui 😊';
      if (ctrls) ctrls.style.display = 'none';
    }
    updateImageCountInfoCaptures();
    // Atualiza contador no rótulo quando não há capturas
    renderGallerySwitchLabelCount();
    return;
  }

  if (actions) actions.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  state.capturedImages.forEach((item, idx) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.draggable = true;
    imageItem.dataset.captureId = item.id;
    imageItem.dataset.captureUrl = item.url;
    const displayName = `Captura #${idx + 1}`;
    imageItem.innerHTML = `
      <img src="${item.url}" alt="${displayName}">
      <button class=\"copy-btn\" title=\"Copiar imagem\" onclick=\"copyCaptureImage('${item.id}')\" onmousedown=\"event.stopPropagation()\">
        <img src=\"../images/copy_image_gallery.svg\" alt=\"Copiar\" width=\"18\" height=\"18\" />
      </button>
      <button class=\"view-btn\" title=\"Visualizar imagem\" onclick=\"openCaptureModal('${item.id}')\" onmousedown=\"event.stopPropagation()\">
        <svg viewBox=\"0 0 24 24\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">
          <path d=\"M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7\"></path>
          <circle cx=\"12\" cy=\"12\" r=\"3\"></circle>
        </svg>
      </button>
      <div class=\"copy-feedback\" aria-live=\"polite\">
        <img src=\"../images/copy_image_gallery.svg\" alt=\"\" width=\"20\" height=\"20\" />
        <span>Imagem foi copiada para a área de transferência</span>
      </div>
      <div class=\"image-name\">${displayName}</div>
      <button class=\"delete-btn\" onclick=\"deleteCaptureImage('${item.id}')\" title=\"Excluir esta captura\">
        <img src=\"../images/delete_img_gallery.svg\" alt=\"Excluir\" width=\"18\" height=\"18\" />
      </button>
    `;
    imageItem.addEventListener('dragstart', handleDragStart);
    imageItem.addEventListener('dragend', handleDragEnd);
    gallery.appendChild(imageItem);
  });

  updateImageCountInfoCaptures();
}

export function updateImageCountInfoCaptures() {
  const imageCountInfo = document.getElementById('imageCountInfo');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (imageCountInfo) {
    const n = state.capturedImages.length || 0;
    imageCountInfo.innerHTML = `Você tem <strong>${n} captura(s)</strong> salva(s) nesta sessão. Clique e arraste para inserir no texto do Editor ou clique no ícone de copiar imagem e colar (Ctrl + V).`;
    if (infoMessage) {
      if (n > 0) {
        infoMessage.style.display = '';
      } else {
        infoMessage.style.display = 'none';
      }
    }
  }
}

export function copyCaptureImage(id) {
  (async () => {
    try {
      const item = state.capturedImages.find(ci => ci.id === id);
      if (!item) return;
      const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const canWriteImages = (navigator.clipboard && 'write' in navigator.clipboard && window.ClipboardItem && (window.isSecureContext || isLocalhost));

      if (canWriteImages) {
        let blob = item.blob;
        if (!blob) {
          const resp = await fetch(item.url, { cache: 'no-store' });
          if (!resp.ok) throw new Error('Falha ao obter imagem de captura');
          blob = await resp.blob();
        }
        const mime = blob.type || 'image/png';
        const clipboardItem = new ClipboardItem({ [mime]: blob });
        try {
          if (navigator.permissions && navigator.permissions.query) {
            await navigator.permissions.query({ name: 'clipboard-write' }).catch(() => {});
          }
        } catch (_) {}
        await navigator.clipboard.write([clipboardItem]);
        updateStatus('Imagem de captura copiada para a área de transferência');
        showCaptureCopyFeedback(id);
        return;
      }

      await navigator.clipboard.writeText(item.url);
      updateStatus('Link da imagem de captura copiado para a área de transferência');
    } catch (err) {
      console.error('Erro ao copiar captura:', err);
      updateStatus('Não foi possível copiar a captura');
    }
  })();
}

export function showCaptureCopyFeedback(id) {
  try {
    const selector = `.image-item[data-capture-id="${CSS.escape(id)}"]`;
    const itemEl = document.querySelector(selector);
    if (!itemEl) return;
    const fb = itemEl.querySelector('.copy-feedback');
    if (!fb) return;
    fb.classList.add('show');
    if (fb.__hideTimer) clearTimeout(fb.__hideTimer);
    fb.__hideTimer = setTimeout(() => {
      fb.classList.remove('show');
    }, 3000);
  } catch (e) {}
}

export function openCaptureModal(id) {
  try {
    const index = state.capturedImages.findIndex(ci => ci.id === id);
    if (index < 0) return;
    state.captureModalIndex = index;
    const item = state.capturedImages[index];
    let overlay = document.getElementById('captureModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'captureModalOverlay';
      overlay.className = 'modal-overlay';
      overlay.addEventListener('click', closeCaptureModal);
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.addEventListener('click', (e) => e.stopPropagation());
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.title = 'Fechar';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', closeCaptureModal);
    const filename = document.createElement('div');
    filename.className = 'modal-filename';
    filename.id = 'captureModalFilename';
    filename.textContent = `Captura #${index + 1}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-image-wrapper';
    const img = document.createElement('img');
    img.className = 'modal-image';
    img.id = 'captureModalImage';
    img.src = item.url;
    img.alt = `Captura #${index + 1}`;
    wrapper.appendChild(img);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary';
    prevBtn.innerHTML = '◀ Anterior';
    prevBtn.addEventListener('click', prevCaptureModalImage);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary';
    nextBtn.innerHTML = 'Próxima ▶';
    nextBtn.addEventListener('click', nextCaptureModalImage);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.innerHTML = '<img src="../images/delete_all_items.svg" alt="Excluir" class="btn-icon-modal" /> <span>Excluir da galeria</span>';
    delBtn.addEventListener('click', deleteCurrentCaptureModalImage);
    actions.appendChild(prevBtn);
    actions.appendChild(nextBtn);
    actions.appendChild(delBtn);
    content.appendChild(closeBtn);
    content.appendChild(filename);
    content.appendChild(wrapper);
    content.appendChild(actions);
    overlay.appendChild(content);
    overlay.classList.add('active');
  } catch (e) { console.error(e); }
}

export function closeCaptureModal() {
  const overlay = document.getElementById('captureModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

export function updateCaptureModalImage() {
  try {
    const idx = typeof state.captureModalIndex === 'number' ? state.captureModalIndex : 0;
    if (!Array.isArray(state.capturedImages) || state.capturedImages.length === 0) { closeCaptureModal(); return; }
    let index = idx;
    if (index < 0) index = state.capturedImages.length - 1;
    if (index >= state.capturedImages.length) index = 0;
    state.captureModalIndex = index;
    const item = state.capturedImages[index];
    const imgEl = document.getElementById('captureModalImage');
    if (imgEl) {
      imgEl.src = item.url;
      imgEl.alt = `Captura #${index + 1}`;
    }
    const labelEl = document.getElementById('captureModalFilename');
    if (labelEl) {
      labelEl.textContent = `Captura #${index + 1}`;
    }
  } catch (e) { console.error(e); }
}

export function nextCaptureModalImage() { state.captureModalIndex = (state.captureModalIndex || 0) + 1; updateCaptureModalImage(); }
export function prevCaptureModalImage() { state.captureModalIndex = (state.captureModalIndex || 0) - 1; updateCaptureModalImage(); }

export function deleteCurrentCaptureModalImage() {
  try {
    if (!Array.isArray(state.capturedImages) || state.capturedImages.length === 0) return;
    const idx = typeof state.captureModalIndex === 'number' ? state.captureModalIndex : 0;
    const item = state.capturedImages[idx];
    if (!item) return;
    deleteCaptureImage(item.id);
    // Após excluir, ajustar índice e exibir próxima/fechar
    if (state.capturedImages.length === 0) {
      closeCaptureModal();
      return;
    }
    if (state.captureModalIndex >= state.capturedImages.length) {
      state.captureModalIndex = state.capturedImages.length - 1;
    }
    updateCaptureModalImage();
  } catch (e) { console.error(e); }
}

export function deleteCaptureImage(id) {
  try {
    const idx = state.capturedImages.findIndex(ci => ci.id === id);
    if (idx >= 0) {
      try { URL.revokeObjectURL(state.capturedImages[idx].url); } catch (e) {}
      state.capturedImages.splice(idx, 1);
      loadCaptureGallery();
      updateStatus('Captura removida da galeria');
    }
  } catch (e) { console.error(e); }
}

export function setGalleryMode(mode) {
  const m = (mode === 'captures') ? 'captures' : 'pdf';
  setGalleryModeState(m);
  const switchBtn = document.getElementById('gallerySwitch');
  if (switchBtn) switchBtn.setAttribute('aria-pressed', m === 'captures' ? 'true' : 'false');
  // Atualiza o rótulo com contador após alterar o modo
  renderGallerySwitchLabelCount();
  updateDeleteAllLabel();
  try {
    if (m === 'pdf') {
      loadImageGallery();
      updateImageCountInfo();
    } else {
      loadCaptureGallery();
    }
  } catch (e) { console.error(e); }
}

export function updateDeleteAllLabel() {
  const btn = document.querySelector('.delete-all-btn');
  if (!btn) return;
  const span = btn.querySelector('span');
  if (span) span.textContent = (state.galleryMode === 'captures') ? 'Excluir Todas as Capturas' : 'Excluir Todas as Imagens';
  btn.title = (state.galleryMode === 'captures') ? 'Excluir todas as capturas' : 'Excluir todas as imagens';
  btn.setAttribute('aria-label', btn.title);
}

export function initGallerySwitch() {
  const btn = document.getElementById('gallerySwitch');
  const label = document.getElementById('gallerySwitchLabel');
  if (!btn || !label) return;
  btn.addEventListener('click', function(){
    const pressed = this.getAttribute('aria-pressed') === 'true';
    setGalleryMode(pressed ? 'pdf' : 'captures');
  });

  // Atualiza contador no rótulo após recarregar a galeria de capturas
  renderGallerySwitchLabelCount();

  // Inicializa o clique do ícone de fechar da mensagem informativa
  const infoClose = document.getElementById('galleryInfoClose');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (infoClose && infoMessage) {
    infoClose.addEventListener('click', function(){
      infoMessage.style.display = 'none';
    });
  }
}

// Atualiza o texto do rótulo (gallerySwitchLabel) com contador entre parênteses e em negrito
export function renderGallerySwitchLabelCount() {
  const label = document.getElementById('gallerySwitchLabel');
  if (!label) return;
  const baseText = (state.galleryMode === 'captures') ? 'Capturas de Tela Salvas' : 'Imagens Pré-Carregadas';
  let count = 0;
  if (state.galleryMode === 'captures') {
    count = Array.isArray(state.capturedImages) ? state.capturedImages.length : 0;
  } else {
    count = (state.estruturaEdicao && Array.isArray(state.estruturaEdicao.images)) ? state.estruturaEdicao.images.length : 0;
  }
  label.innerHTML = `${baseText} (${count})`;
}

export function handleDragStart(e) {
  this.classList.add('dragging');
  if (this.dataset.imageName) {
    e.dataTransfer.setData('text/plain', this.dataset.imageName);
  }
  if (this.dataset.captureUrl) {
    try {
      e.dataTransfer.setData('text/uri-list', this.dataset.captureUrl);
      e.dataTransfer.setData('text/plain', this.dataset.captureUrl);
    } catch (err) {}
  }
}

export function handleDragEnd(e) {
  this.classList.remove('dragging');
}

export function setupDropZones() {
  const structuredSummary = document.getElementById('structuredSummary');
  if (!structuredSummary) return;
  structuredSummary.addEventListener('dragover', function(e){ e.preventDefault(); });
  structuredSummary.addEventListener('drop', function(e){
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    const uri = e.dataTransfer.getData('text/uri-list');
    const value = uri || data || '';
    if (!value) return;
    const rect = structuredSummary.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    if (/^(blob:|data:|https?:)/.test(value)) {
      insertCaptureImageAtPosition(value, mouseX, mouseY);
    } else {
      insertImageAtPosition(value, mouseX, mouseY);
    }
  });
}

export function insertImageAtPosition(imageName, mouseX, mouseY) {
  const structuredSummary = document.getElementById('structuredSummary');
  if (!structuredSummary) return;
  const rect = structuredSummary.getBoundingClientRect();
  const relativeY = mouseY - rect.top;

  const textNodes = getTextNodes(structuredSummary);
  let targetNode = null;
  let targetOffset = 0;

  for (let i = 0; i < textNodes.length; i++) {
    const range = document.createRange();
    range.setStart(textNodes[i], 0);
    range.setEnd(textNodes[i], textNodes[i].textContent.length);
    const textRect = range.getBoundingClientRect();

    if (textRect.top <= relativeY && textRect.bottom >= relativeY) {
      targetNode = textNodes[i];
      targetOffset = textNodes[i].textContent.length;
      break;
    }
  }

  if (targetNode) {
    const imagePlaceholder = createImagePlaceholder(imageName);
    const parent = targetNode.parentNode;
    const nextSibling = targetNode.nextSibling;
    if (nextSibling) {
      parent.insertBefore(imagePlaceholder, nextSibling);
    } else {
      parent.appendChild(imagePlaceholder);
    }
    const br = document.createElement('br');
    parent.insertBefore(br, imagePlaceholder.nextSibling);
    state.imagensPosicionadas.push(imageName);
    updateImageCount();
    updateStatus(`Imagem ${imageName} inserida`);
  }
}

export function insertCaptureImageAtPosition(srcUrl, mouseX, mouseY) {
  const structuredSummary = document.getElementById('structuredSummary');
  if (!structuredSummary) return;
  const rect = structuredSummary.getBoundingClientRect();
  const relativeY = mouseY - rect.top;
  const img = document.createElement('img');
  img.src = srcUrl;
  img.alt = 'Captura';
  img.style.maxWidth = '100%';
  img.style.display = 'block';
  const textNodes = getTextNodes(structuredSummary);
  let targetNode = null;
  let targetOffset = 0;
  for (let i = 0; i < textNodes.length; i++) {
    const range = document.createRange();
    range.setStart(textNodes[i], 0);
    range.setEnd(textNodes[i], textNodes[i].textContent.length);
    const textRect = range.getBoundingClientRect();
    if (relativeY <= textRect.bottom) {
      targetNode = textNodes[i];
      targetOffset = 0;
      break;
    }
  }
  if (targetNode) {
    const range = document.createRange();
    range.setStart(targetNode, targetOffset);
    range.collapse(true);
    range.insertNode(img);
  } else {
    structuredSummary.appendChild(img);
  }
  updateStatus('Imagem de captura inserida');
}

export function createImagePlaceholder(imageName) {
  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  placeholder.dataset.imageName = imageName;
  placeholder.innerHTML = `
    <img src="/temp_uploads/imagens_extraidas/${imageName}?v=${state.galleryCacheBust}" alt="${imageName}">
    <div class="remove-btn" onclick="removeImage(this)">×</div>
  `;
  return placeholder;
}

export function removeImage(button) {
  const placeholder = button.parentElement;
  const imageName = placeholder.dataset.imageName;
  const index = state.imagensPosicionadas.indexOf(imageName);
  if (index > -1) {
    state.imagensPosicionadas.splice(index, 1);
  }
  placeholder.remove();
  updateImageCount();
  updateStatus(`Imagem ${imageName} removida`);
}

export function clearAllImages() {
  const structuredSummary = document.getElementById('structuredSummary');
  const placeholders = structuredSummary ? structuredSummary.querySelectorAll('.image-placeholder') : [];
  Array.from(placeholders).forEach(ph => ph.remove());
  state.imagensPosicionadas = [];
  updateImageCount();
  updateStatus('Todas as imagens removidas');
}

export async function deleteGalleryImage(imageName) {
  const pretty = String(imageName)
    .replace(/\.png$/i, '')
    .replace(/^img_/i, 'imagem-');
  if (confirm(`Tem certeza que deseja excluir a ${pretty} da galeria?`)) {
    const index = state.estruturaEdicao.images.indexOf(imageName);
    if (index > -1) {
      state.estruturaEdicao.images.splice(index, 1);
    }
    loadImageGallery();
    updateImageCountInfo();
    updateStatus(`Imagem ${imageName} removida da galeria`);
  }
}

export async function copyGalleryImage(imageName) {
  const baseUrl = window.location.origin;
  const url = new URL(`/temp_uploads/imagens_extraidas/${imageName}?v=${state.galleryCacheBust}`, baseUrl).href;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const canWriteImages = (navigator.clipboard && 'write' in navigator.clipboard && window.ClipboardItem && (window.isSecureContext || isLocalhost));
  try {
    if (canWriteImages) {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Falha ao obter imagem para copiar');
      const blob = await resp.blob();
      const mime = blob.type || 'image/png';
      const item = new ClipboardItem({ [mime]: blob });
      try {
        if (navigator.permissions && navigator.permissions.query) {
          await navigator.permissions.query({ name: 'clipboard-write' }).catch(() => {});
        }
      } catch (_) {}
      await navigator.clipboard.write([item]);
      updateStatus(`Imagem ${imageName} copiada para a área de transferência`);
      showCopyFeedback(imageName);
      return;
    }
    const success = await copyImageViaSelection(url);
    if (success) {
      updateStatus(`Imagem ${imageName} copiada via seleção`);
      showCopyFeedback(imageName);
      return;
    }
    await navigator.clipboard.writeText(url);
    updateStatus(`Link da imagem ${imageName} copiado para a área de transferência`);
  } catch (err) {
    console.error('Erro ao copiar imagem:', err);
    try {
      await navigator.clipboard.writeText(new URL(`/temp_uploads/imagens_extraidas/${imageName}`, window.location.origin).href);
      updateStatus(`Link da imagem ${imageName} copiado`);
    } catch (e) {
      updateStatus(`Não foi possível copiar a imagem ${imageName}`);
    }
  }
}

export function showCopyFeedback(imageName) {
  try {
    const selector = `.image-item[data-image-name="${CSS.escape(imageName)}"]`;
    const item = document.querySelector(selector);
    if (!item) return;
    const fb = item.querySelector('.copy-feedback');
    if (!fb) return;
    fb.classList.add('show');
    if (fb.__hideTimer) clearTimeout(fb.__hideTimer);
    fb.__hideTimer = setTimeout(() => {
      fb.classList.remove('show');
    }, 3000);
  } catch (e) {}
}

export async function copyImageViaSelection(imgUrl) {
  return new Promise((resolve) => {
    try {
      const holder = document.createElement('div');
      holder.contentEditable = 'true';
      holder.style.position = 'fixed';
      holder.style.left = '-10000px';
      holder.style.top = '-10000px';
      const img = document.createElement('img');
      img.src = imgUrl;
      holder.appendChild(img);
      document.body.appendChild(holder);
      img.onload = () => {
        const range = document.createRange();
        range.selectNode(img);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const ok = document.execCommand('copy');
        sel.removeAllRanges();
        document.body.removeChild(holder);
        resolve(ok);
      };
      img.onerror = () => {
        document.body.removeChild(holder);
        resolve(false);
      };
    } catch (e) {
      resolve(false);
    }
  });
}

export async function deleteAllGalleryImages() {
  if (state.galleryMode === 'pdf') {
    if (confirm('Tem certeza que deseja excluir todas as imagens da Galeria?')) {
      try {
        updateStatus('Removendo todas as imagens da pasta...');
        const resp = await fetch('/api/delete-all-images', { method: 'POST' });
        if (!resp.ok) throw new Error('Falha ao deletar imagens no servidor');
      } catch (err) {
        console.error(err);
      }
      state.estruturaEdicao.images = [];
      window.__imageInfoLookup = {};
      loadImageGallery();
      updateImageCountInfo();
      updateStatus('Todas as imagens removidas da galeria');
      try { showGalleryEmptyState(); } catch (e) {}
    }
  } else {
    if (confirm('Tem certeza que deseja excluir todas as capturas de tela?')) {
      try {
        state.capturedImages.forEach(ci => { try { URL.revokeObjectURL(ci.url); } catch (e) {} });
        state.capturedImages = [];
        loadCaptureGallery();
        updateStatus('Todas as capturas removidas');
      } catch (err) { console.error(err); }
    }
  }
}

export function showGalleryEmptyState() {
  const actions = document.querySelector('.gallery-actions');
  const empty = document.getElementById('galleryEmptyState');
  if (actions) actions.style.display = 'none';
  if (empty) {
    empty.style.display = '';
    const msg = empty.querySelector('.gallery-empty-message');
    const ctrls = empty.querySelector('.gallery-empty-controls');
    if (state.galleryMode === 'pdf') {
      if (msg) msg.textContent = 'Você não tem mais imagens do PDF na galeria. Capture novas imagens usando o painel de captura ou clique no botão abaixo para recapturar automaticamente as imagens iniciais do PDF.';
      if (ctrls) ctrls.style.display = '';
    } else {
      if (msg) msg.textContent = 'Nenhuma captura de tela salva. Use CAPTURAR IMAGEM e depois cole (Ctrl+V) para salvar aqui.';
      if (ctrls) ctrls.style.display = 'none';
    }
  }
}

export function hideGalleryEmptyState() {
  const actions = document.querySelector('.gallery-actions');
  const empty = document.getElementById('galleryEmptyState');
  if (actions) actions.style.display = '';
  if (empty) empty.style.display = 'none';
}

export function setGalleryLoading(message, show) {
  const galleryLoading = document.getElementById('galleryLoading');
  const galleryContent = document.getElementById('galleryContent');
  if (galleryLoading) {
    const p = galleryLoading.querySelector('p');
    if (p && typeof message === 'string' && message.trim()) {
      p.textContent = message;
    }
    galleryLoading.style.display = show ? '' : 'none';
  }
  if (galleryContent) {
    galleryContent.style.display = show ? 'none' : '';
  }
}

export function updateImageCountInfo() {
  const imageCountInfo = document.getElementById('imageCountInfo');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (imageCountInfo && state.estruturaEdicao) {
    const imageCount = Array.isArray(state.estruturaEdicao.images) ? state.estruturaEdicao.images.length : 0;
    const storedPdfName = (() => { try { return localStorage.getItem('selectedPdfName'); } catch (e) { return null; } })();
    const fromPath = (p) => {
      if (!p || typeof p !== 'string') return null;
      const base = p.split('/').pop();
      return base && base.toLowerCase().endsWith('.pdf') ? base : null;
    };
    const candidateFromPath = fromPath(state.estruturaEdicao.pdf_path);
    const pdfNameCandidate = storedPdfName || state.estruturaEdicao.pdf_name || candidateFromPath;
    const pdfName = pdfNameCandidate || 'PDF selecionado';
    imageCountInfo.innerHTML = `Identifiquei <strong>${imageCount} elemento(s) do tipo imagem </strong>neste PDF. Use esta galeria para: arrastá-las e inserí-las no texto; incluir novas imagens de captura; visualizá-las em tamanho orginal; e excluir as que não são relevantes para o seu texto/projeto.`;
    const pdfNameSpan = document.getElementById('imageCountInfoPdfName');
    if (pdfNameSpan) pdfNameSpan.textContent = pdfName;
    if (infoMessage) {
      if (imageCount > 0) {
        infoMessage.style.display = '';
      } else {
        infoMessage.style.display = 'none';
      }
    }
  }
}