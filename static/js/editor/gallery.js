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

// Pré-carrega as imagens de upload do servidor e atualiza contador
export async function preloadUploads() {
  try {
    if (!Array.isArray(state.uploadedImages) || state.uploadedImages.length === 0) {
      const response = await fetch('/api/uploads/list');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.images) && data.images.length > 0) {
          state.uploadedImages = data.images.map((img, index) => ({
            id: `server_${index}_${Date.now()}`,
            name: img.filename,
            url: img.url,
            serverFilename: img.filename
          }));
        }
      }
    }
  } catch (error) {
    console.error('Erro ao pré-carregar imagens de upload:', error);
  } finally {
    try { renderGallerySwitchLabelCount(); } catch (_) {}
  }
}

// Galeria de Uploads (arquivos enviados pelo usuário)
export async function loadUploadsGallery() {
  const gallery = document.getElementById('imageGallery');
  if (!gallery) return;
  gallery.innerHTML = '';

  const actions = document.querySelector('.gallery-actions');
  const emptyState = document.getElementById('galleryEmptyState');

  // Se não há imagens no estado, tenta carregar do servidor
  if (!Array.isArray(state.uploadedImages) || state.uploadedImages.length === 0) {
    try {
      const response = await fetch('/api/uploads/list');
      if (response.ok) {
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          // Converte as imagens do servidor para o formato do estado
          state.uploadedImages = data.images.map((img, index) => ({
            id: `server_${index}_${Date.now()}`,
            name: img.filename,
            url: img.url,
            serverFilename: img.filename
          }));
          try { renderGallerySwitchLabelCount(); } catch (_) {}
        }
      }
    } catch (error) {
      console.error('Erro ao carregar imagens do servidor:', error);
    }
  }

  if (!Array.isArray(state.uploadedImages) || state.uploadedImages.length === 0) {
    if (actions) actions.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = '';
      const msg = emptyState.querySelector('.gallery-empty-message');
      const ctrls = emptyState.querySelector('.gallery-empty-controls');
      if (msg) msg.textContent = 'Nenhuma imagem enviada. Clique em "Enviar Imagens" acima ou cole diretamente no editor para salvar aqui.';
      if (ctrls) ctrls.style.display = 'none';
    }
    updateImageCountInfoUploads();
    renderGallerySwitchLabelCount();
    return;
  }

  if (actions) actions.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  state.uploadedImages.forEach((item, idx) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.draggable = true;
    imageItem.dataset.uploadId = item.id;
    imageItem.dataset.uploadUrl = item.url;
    const displayName = item.name ? item.name : `Upload #${idx + 1}`;
    imageItem.innerHTML = `
      <img src="${item.url}" alt="${displayName}">
      <button class=\"copy-btn\" title=\"Copiar imagem\" onclick=\"copyUploadImage('${item.id}')\" onmousedown=\"event.stopPropagation()\">
        <img src=\"../images/copy_image_gallery.svg\" alt=\"Copiar\" width=\"18\" height=\"18\" />
      </button>
      <button class=\"view-btn\" title=\"Visualizar imagem\" onclick=\"openUploadModal('${item.id}')\" onmousedown=\"event.stopPropagation()\">
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
      <button class=\"delete-btn\" onclick=\"deleteUploadImage('${item.id}')\" title=\"Excluir este upload\">
        <img src=\"../images/delete_img_gallery.svg\" alt=\"Excluir\" width=\"18\" height=\"18\" />
      </button>
    `;
    imageItem.addEventListener('dragstart', handleDragStart);
    imageItem.addEventListener('dragend', handleDragEnd);
    gallery.appendChild(imageItem);
  });

  updateImageCountInfoUploads();
  // Mantém o contador do select sincronizado com a galeria de uploads
  renderGallerySwitchLabelCount();
}

export function updateImageCountInfoUploads() {
  const imageCountInfo = document.getElementById('imageCountInfo');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (imageCountInfo) {
    const n = Array.isArray(state.uploadedImages) ? state.uploadedImages.length : 0;
    imageCountInfo.innerHTML = `Você tem <strong>${n} upload(s)</strong> nesta sessão. Arraste e solte no Editor ou use o ícone de copiar para colar no texto (Ctrl + V).`;
    if (infoMessage) {
      if (state.galleryInfoClosed) {
        infoMessage.style.display = 'none';
      } else {
        infoMessage.style.display = n > 0 ? '' : 'none';
      }
    }
  }
}

// Galeria de imagens copiadas da área de transferência (sessão local)
export function loadClipboardGallery() {
  const gallery = document.getElementById('imageGallery');
  if (!gallery) return;
  gallery.innerHTML = '';

  const actions = document.querySelector('.gallery-actions');
  const emptyState = document.getElementById('galleryEmptyState');

  if (!Array.isArray(state.clipboardImages) || state.clipboardImages.length === 0) {
    if (actions) actions.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = '';
      const msg = emptyState.querySelector('.gallery-empty-message');
      const ctrls = emptyState.querySelector('.gallery-empty-controls');
      if (msg) msg.textContent = 'Nenhuma imagem copiada. Cole (Ctrl+V) no editor para salvar aqui automaticamente.';
      if (ctrls) ctrls.style.display = 'none';
    }
    updateImageCountInfoClipboard();
    renderGallerySwitchLabelCount();
    return;
  }

  if (actions) actions.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  state.clipboardImages.forEach((item, idx) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.draggable = true;
    imageItem.dataset.clipboardId = item.id;
    imageItem.dataset.clipboardUrl = item.url;
    const displayName = item.name ? item.name : `Copiada #${idx + 1}`;
    imageItem.innerHTML = `
      <img src="${item.url}" alt="${displayName}">
      <button class=\"copy-btn\" title=\"Copiar imagem\" onclick=\"copyClipboardImage('${item.id}')\" onmousedown=\"event.stopPropagation()\">
        <img src=\"../images/copy_image_gallery.svg\" alt=\"Copiar\" width=\"18\" height=\"18\" />
      </button>
      <button class=\"view-btn\" title=\"Visualizar imagem\" onclick=\"openClipboardModal('${item.id}')\" onmousedown=\"event.stopPropagation()\">
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
      <button class=\"delete-btn\" onclick=\"deleteClipboardImage('${item.id}')\" title=\"Excluir esta imagem copiada\">
        <img src=\"../images/delete_img_gallery.svg\" alt=\"Excluir\" width=\"18\" height=\"18\" />
      </button>
    `;
    imageItem.addEventListener('dragstart', handleDragStart);
    imageItem.addEventListener('dragend', handleDragEnd);
    gallery.appendChild(imageItem);
  });

  updateImageCountInfoClipboard();
}

export function updateImageCountInfoClipboard() {
  const imageCountInfo = document.getElementById('imageCountInfo');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (imageCountInfo) {
    const n = Array.isArray(state.clipboardImages) ? state.clipboardImages.length : 0;
    imageCountInfo.innerHTML = `Você tem <strong>${n} imagem(ns) copiadas</strong> nesta sessão. Arraste e solte no Editor ou use o ícone de copiar para colar no texto (Ctrl + V).`;
    if (infoMessage) {
      if (state.galleryInfoClosed) {
        infoMessage.style.display = 'none';
      } else {
        infoMessage.style.display = n > 0 ? '' : 'none';
      }
    }
  }
}

export function showClipboardCopyFeedback(id) {
  try {
    const selector = `.image-item[data-clipboard-id="${CSS.escape(id)}"]`;
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

export function openClipboardModal(id) {
  try {
    const index = state.clipboardImages.findIndex(ci => ci.id === id);
    if (index < 0) return;
    state.clipboardModalIndex = index;
    const item = state.clipboardImages[index];
    let overlay = document.getElementById('clipboardModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'clipboardModalOverlay';
      overlay.className = 'modal-overlay';
      overlay.addEventListener('click', closeClipboardModal);
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
    closeBtn.addEventListener('click', closeClipboardModal);
    const filename = document.createElement('div');
    filename.className = 'modal-filename';
    filename.id = 'clipboardModalFilename';
    filename.textContent = item.name ? item.name : `Copiada #${index + 1}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-image-wrapper';
    const img = document.createElement('img');
    img.className = 'modal-image';
    img.id = 'clipboardModalImage';
    img.src = item.url;
    img.alt = item.name || `Copiada #${index + 1}`;
    wrapper.appendChild(img);
    const prevBtn = document.createElement('button');
    prevBtn.className = 'modal-prev';
    prevBtn.title = 'Anterior';
    prevBtn.setAttribute('aria-label', 'Anterior');
    prevBtn.textContent = '<';
    prevBtn.addEventListener('click', (ev) => { ev.stopPropagation(); prevClipboardModalImage(); });
    const nextBtn = document.createElement('button');
    nextBtn.className = 'modal-next';
    nextBtn.title = 'Próxima';
    nextBtn.setAttribute('aria-label', 'Próxima');
    nextBtn.textContent = '>';
    nextBtn.addEventListener('click', (ev) => { ev.stopPropagation(); nextClipboardModalImage(); });
    const delBtn = document.createElement('button');
    delBtn.className = 'modal-delete';
    delBtn.title = 'Excluir imagem atual';
    delBtn.setAttribute('aria-label', 'Excluir imagem atual');
    delBtn.textContent = 'Excluir';
    delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); deleteCurrentClipboardModalImage(); });
    content.appendChild(closeBtn);
    content.appendChild(filename);
    content.appendChild(wrapper);
    content.appendChild(prevBtn);
    content.appendChild(nextBtn);
    content.appendChild(delBtn);
    overlay.appendChild(content);
    overlay.classList.add('active');
  } catch (e) { console.error(e); }
}

export function closeClipboardModal() {
  const overlay = document.getElementById('clipboardModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

export function updateClipboardModalImage() {
  try {
    const idx = typeof state.clipboardModalIndex === 'number' ? state.clipboardModalIndex : 0;
    if (!Array.isArray(state.clipboardImages) || state.clipboardImages.length === 0) { closeClipboardModal(); return; }
    let index = idx;
    if (index < 0) index = state.clipboardImages.length - 1;
    if (index >= state.clipboardImages.length) index = 0;
    state.clipboardModalIndex = index;
    const item = state.clipboardImages[index];
    const imgEl = document.getElementById('clipboardModalImage');
    if (imgEl) {
      imgEl.src = item.url;
      imgEl.alt = item.name || `Copiada #${index + 1}`;
    }
    const labelEl = document.getElementById('clipboardModalFilename');
    if (labelEl) {
      labelEl.textContent = item.name ? item.name : `Copiada #${index + 1}`;
    }
  } catch (e) { console.error(e); }
}

export function nextClipboardModalImage() { state.clipboardModalIndex = (state.clipboardModalIndex || 0) + 1; updateClipboardModalImage(); }
export function prevClipboardModalImage() { state.clipboardModalIndex = (state.clipboardModalIndex || 0) - 1; updateClipboardModalImage(); }

export async function deleteCurrentClipboardModalImage() {
  try {
    if (!Array.isArray(state.clipboardImages) || state.clipboardImages.length === 0) return;
    const idx = typeof state.clipboardModalIndex === 'number' ? state.clipboardModalIndex : 0;
    const item = state.clipboardImages[idx];
    if (!item) return;
    await deleteClipboardImage(item.id);
    if (state.clipboardImages.length === 0) { closeClipboardModal(); return; }
    if (state.clipboardModalIndex >= state.clipboardImages.length) {
      state.clipboardModalIndex = state.clipboardImages.length - 1;
    }
    updateClipboardModalImage();
  } catch (e) { console.error(e); }
}

export async function deleteClipboardImage(id) {
  try {
    const idx = state.clipboardImages.findIndex(ci => ci.id === id);
    if (idx < 0) return;
    const item = state.clipboardImages[idx];
    if (confirm('Excluir esta imagem copiada desta sessão?')) {
      try { if (item.url && String(item.url).startsWith('blob:')) URL.revokeObjectURL(item.url); } catch (_) {}
      state.clipboardImages.splice(idx, 1);
      loadClipboardGallery();
      updateStatus('Imagem copiada removida');
    }
  } catch (e) { console.error(e); }
}

export async function copyClipboardImage(id) {
  try {
    const item = state.clipboardImages.find(ci => ci.id === id);
    if (!item) return;
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const canWriteImages = (navigator.clipboard && 'write' in navigator.clipboard && window.ClipboardItem && (window.isSecureContext || isLocalhost));
    if (canWriteImages) {
      const blob = item.blob || (await (async () => {
        try { const r = await fetch(item.url, { cache: 'no-store' }); if (!r.ok) throw new Error('Falha ao obter blob'); return await r.blob(); } catch (e) { return null; }
      })());
      if (blob) {
        const mime = blob.type || 'image/png';
        const clip = new ClipboardItem({ [mime]: blob });
        try {
          if (navigator.permissions && navigator.permissions.query) {
            await navigator.permissions.query({ name: 'clipboard-write' }).catch(() => {});
          }
        } catch (_) {}
        await navigator.clipboard.write([clip]);
        updateStatus('Imagem copiada para a área de transferência');
        showClipboardCopyFeedback(id);
        return;
      }
    }
    // Fallback: copiar URL
    await navigator.clipboard.writeText(item.url);
    updateStatus('Link da imagem copiada para a área de transferência');
    showClipboardCopyFeedback(id);
  } catch (e) { console.error(e); }
}

export function updateImageCountInfoCaptures() {
  const imageCountInfo = document.getElementById('imageCountInfo');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (imageCountInfo) {
    const n = state.capturedImages.length || 0;
    imageCountInfo.innerHTML = `Você tem <strong>${n} captura(s)</strong> salva(s) nesta sessão. Clique <strong>2x</strong> nas imagens (mantenha o botão do mouse pressionado), arraste e solte no Editor, ou se preferir, use o ícone de copiar (no canto superior esquerdo da imagem) para colar no texto (Ctrl + V).`;
    if (infoMessage) {
      if (state.galleryInfoClosed) {
        infoMessage.style.display = 'none';
      } else {
        infoMessage.style.display = n > 0 ? '' : 'none';
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

export function copyUploadImage(id) {
  (async () => {
    try {
      const item = Array.isArray(state.uploadedImages) ? state.uploadedImages.find(u => u.id === id) : null;
      if (!item) return;
      const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const canWriteImages = (navigator.clipboard && 'write' in navigator.clipboard && window.ClipboardItem && (window.isSecureContext || isLocalhost));

      if (canWriteImages) {
        let blob = item.blob;
        if (!blob) {
          const resp = await fetch(item.url, { cache: 'no-store' });
          if (!resp.ok) throw new Error('Falha ao obter imagem de upload');
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
        updateStatus('Imagem enviada copiada para a área de transferência');
        showUploadCopyFeedback(id);
        return;
      }

      await navigator.clipboard.writeText(item.url);
      updateStatus('Link da imagem enviada copiado para a área de transferência');
    } catch (err) {
      console.error('Erro ao copiar upload:', err);
      updateStatus('Não foi possível copiar o upload');
    }
  })();
}

export function showUploadCopyFeedback(id) {
  try {
    const selector = `.image-item[data-upload-id="${CSS.escape(id)}"]`;
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

export function openUploadModal(id) {
  try {
    const index = Array.isArray(state.uploadedImages) ? state.uploadedImages.findIndex(u => u.id === id) : -1;
    if (index < 0) return;
    state.uploadModalIndex = index;
    const item = state.uploadedImages[index];
    let overlay = document.getElementById('uploadModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'uploadModalOverlay';
      overlay.className = 'modal-overlay';
      overlay.addEventListener('click', closeUploadModal);
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
    closeBtn.addEventListener('click', closeUploadModal);
    const filename = document.createElement('div');
    filename.className = 'modal-filename';
    filename.id = 'uploadModalFilename';
    filename.textContent = item.name ? item.name : `Upload #${index + 1}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-image-wrapper';
    const img = document.createElement('img');
    img.className = 'modal-image';
    img.id = 'uploadModalImage';
    img.src = item.url;
    img.alt = item.name || `Upload #${index + 1}`;
    wrapper.appendChild(img);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary';
    prevBtn.innerHTML = '◀ Anterior';
    prevBtn.addEventListener('click', prevUploadModalImage);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary';
    nextBtn.innerHTML = 'Próxima ▶';
    nextBtn.addEventListener('click', nextUploadModalImage);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.innerHTML = '<img src="../images/delete_all_items.svg" alt="Excluir" class="btn-icon-modal" /> <span>Excluir da galeria</span>';
    delBtn.addEventListener('click', deleteCurrentUploadModalImage);
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

export function closeUploadModal() {
  const overlay = document.getElementById('uploadModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

export function updateUploadModalImage() {
  try {
    const idx = typeof state.uploadModalIndex === 'number' ? state.uploadModalIndex : 0;
    if (!Array.isArray(state.uploadedImages) || state.uploadedImages.length === 0) { closeUploadModal(); return; }
    let index = idx;
    if (index < 0) index = state.uploadedImages.length - 1;
    if (index >= state.uploadedImages.length) index = 0;
    state.uploadModalIndex = index;
    const item = state.uploadedImages[index];
    const imgEl = document.getElementById('uploadModalImage');
    if (imgEl) {
      imgEl.src = item.url;
      imgEl.alt = item.name || `Upload #${index + 1}`;
    }
    const labelEl = document.getElementById('uploadModalFilename');
    if (labelEl) {
      labelEl.textContent = item.name ? item.name : `Upload #${index + 1}`;
    }
  } catch (e) { console.error(e); }
}

export function nextUploadModalImage() { state.uploadModalIndex = (state.uploadModalIndex || 0) + 1; updateUploadModalImage(); }
export function prevUploadModalImage() { state.uploadModalIndex = (state.uploadModalIndex || 0) - 1; updateUploadModalImage(); }

export async function deleteCurrentUploadModalImage() {
  try {
    if (!Array.isArray(state.uploadedImages) || state.uploadedImages.length === 0) return;
    const idx = typeof state.uploadModalIndex === 'number' ? state.uploadModalIndex : 0;
    const item = state.uploadedImages[idx];
    if (!item) return;
    await deleteUploadImage(item.id);
    if (state.uploadedImages.length === 0) { closeUploadModal(); return; }
    if (state.uploadModalIndex >= state.uploadedImages.length) {
      state.uploadModalIndex = state.uploadedImages.length - 1;
    }
    updateUploadModalImage();
  } catch (e) { console.error(e); }
}

export async function deleteUploadImage(id) {
  try {
    const index = Array.isArray(state.uploadedImages) ? state.uploadedImages.findIndex(u => u.id === id) : -1;
    if (index < 0) return;
    const item = state.uploadedImages[index];
    try { URL.revokeObjectURL(item.url); } catch (e) {}
    // Opcional: solicitar remoção no backend, se houver
    try {
      const payload = { filename: (item.serverFilename || item.name || null) };
      await fetch('/api/uploads/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (_) {}
    state.uploadedImages.splice(index, 1);
    await loadUploadsGallery();
    updateStatus('Upload removido da galeria');
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

export async function deleteCurrentCaptureModalImage() {
  try {
    if (!Array.isArray(state.capturedImages) || state.capturedImages.length === 0) return;
    const idx = typeof state.captureModalIndex === 'number' ? state.captureModalIndex : 0;
    const item = state.capturedImages[idx];
    if (!item) return;
    await deleteCaptureImage(item.id);
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

export async function deleteCaptureImage(id) {
  try {
    const idx = state.capturedImages.findIndex(ci => ci.id === id);
    if (idx >= 0) {
      const item = state.capturedImages[idx];
      // Tentar excluir no backend quando for uma URL persistida
      try {
        const url = item && item.url ? String(item.url) : '';
        const m = url.match(/\/temp_uploads\/capturas_de_tela\/(.+)$/);
        if (m && m[1]) {
          await fetch('/api/captures/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: m[1] })
          }).catch(() => {});
        }
      } catch (_) {}
      try { URL.revokeObjectURL(item.url); } catch (e) {}
      state.capturedImages.splice(idx, 1);
      loadCaptureGallery();
      updateStatus('Captura removida da galeria');
    }
  } catch (e) { console.error(e); }
}

export async function setGalleryMode(mode) {
  const m = (mode === 'captures') ? 'captures' : (mode === 'uploads' ? 'uploads' : 'pdf');
  setGalleryModeState(m);
  const selectEl = document.getElementById('gallerySelect');
  if (selectEl) selectEl.value = m;
  updateUploadsControlsVisibility();
  renderGallerySwitchLabelCount();
  updateDeleteAllLabel();
  try {
    if (m === 'pdf') {
      loadImageGallery();
      updateImageCountInfo();
    } else if (m === 'captures') {
      loadCaptureGallery();
    } else {
      await loadUploadsGallery();
    }
  } catch (e) { console.error(e); }
}

export function updateDeleteAllLabel() {
  const btn = document.querySelector('.delete-all-btn');
  if (!btn) return;
  const span = btn.querySelector('span');
  const isCaptures = state.galleryMode === 'captures';
  const isUploads = state.galleryMode === 'uploads';
  if (span) span.textContent = isCaptures ? 'Excluir Todas as Capturas' : (isUploads ? 'Excluir Todos os Uploads' : 'Excluir Todas as Imagens');
  btn.title = isCaptures ? 'Excluir todas as capturas' : (isUploads ? 'Excluir todos os uploads' : 'Excluir todas as imagens');
  btn.setAttribute('aria-label', btn.title);
}

export function initGallerySwitch() {
  const selectEl = document.getElementById('gallerySelect');
  if (!selectEl) return;
  selectEl.addEventListener('change', async function(){
    const val = String(this.value || 'pdf');
    await setGalleryMode(val);
  });
  // Inicializar valor e visibilidade dos controles
  try { selectEl.value = state.galleryMode || 'pdf'; } catch (_) {}
  updateUploadsControlsVisibility();
  renderGallerySwitchLabelCount();

  const infoClose = document.getElementById('galleryInfoClose');
  const infoMessage = document.getElementById('galleryInfoMessage');
  if (infoClose && infoMessage) {
    infoClose.addEventListener('click', function(){
      infoMessage.style.display = 'none';
      try { state.galleryInfoClosed = true; } catch (e) {}
    });
  }
}

// Atualiza os textos das opções do select com o contador no final
export function renderGallerySwitchLabelCount() {
  const selectEl = document.getElementById('gallerySelect');
  if (!selectEl) return;
  const pdfCount = (state.estruturaEdicao && Array.isArray(state.estruturaEdicao.images)) ? state.estruturaEdicao.images.length : 0;
  const capCount = Array.isArray(state.capturedImages) ? state.capturedImages.length : 0;
  const uplCount = Array.isArray(state.uploadedImages) ? state.uploadedImages.length : 0;
  const baseText = {
    pdf: 'Imagens Pré-Carregadas',
    captures: 'Capturas de Tela Salvas',
    uploads: 'Imagens Enviadas/Uploads'
  };
  const counts = { pdf: pdfCount, captures: capCount, uploads: uplCount };
  Array.from(selectEl.options).forEach((opt) => {
    const v = opt.value;
    const text = baseText[v] || opt.textContent;
    const n = counts[v] ?? 0;
    opt.textContent = `${text} (${n})`;
  });
}

export function handleDragStart(e) {
  this.classList.add('dragging');
  try {
    // Sempre indicar operação de cópia ao soltar
    if (e.dataTransfer && typeof e.dataTransfer.effectAllowed === 'string') {
      e.dataTransfer.effectAllowed = 'copy';
    }

    // Usar somente a imagem como "ghost" do drag, não o container com ícones
    const imgEl = this.querySelector('img');
    if (imgEl && e.dataTransfer && e.dataTransfer.setDragImage) {
      try {
        // Criar uma cópia fora da tela para garantir que apenas a imagem apareça no ghost
        const dragImg = imgEl.cloneNode(true);
        dragImg.style.position = 'fixed';
        dragImg.style.top = '-10000px';
        dragImg.style.left = '-10000px';
        dragImg.style.pointerEvents = 'none';
        dragImg.style.zIndex = '-1';
        document.body.appendChild(dragImg);
        this.__dragImageEl = dragImg;

        const rect = imgEl.getBoundingClientRect();
        const ox = (typeof e.clientX === 'number') ? Math.min(Math.max(0, e.clientX - rect.left), rect.width) : Math.min(10, rect.width || 10);
        const oy = (typeof e.clientY === 'number') ? Math.min(Math.max(0, e.clientY - rect.top), rect.height) : Math.min(10, rect.height || 10);
        e.dataTransfer.setDragImage(dragImg, ox, oy);
      } catch (_) {}
    }

    // Definir os dados carregados para refletirem apenas a imagem
    if (this.dataset.captureUrl) {
      const src = this.dataset.captureUrl;
      try {
        e.dataTransfer.setData('text/uri-list', src);
        e.dataTransfer.setData('text/plain', src);
        e.dataTransfer.setData('text/html', `<img src="${src}" alt="Imagem" style="max-width:100%;display:block;"/>`);
      } catch (_) {}
      return;
    }

    if (this.dataset.uploadUrl) {
      const src = this.dataset.uploadUrl;
      try {
        e.dataTransfer.setData('text/uri-list', src);
        e.dataTransfer.setData('text/plain', src);
        e.dataTransfer.setData('text/html', `<img src="${src}" alt="Imagem" style="max-width:100%;display:block;"/>`);
      } catch (_) {}
      return;
    }

    if (this.dataset.imageName) {
      const name = this.dataset.imageName;
      try {
        e.dataTransfer.setData('text/plain', name);
        // Também fornecer um HTML mínimo da imagem para destinos que preferem text/html
        const src = `/temp_uploads/imagens_extraidas/${name}?v=${state.galleryCacheBust}`;
        e.dataTransfer.setData('text/html', `<img src="${src}" alt="${name}" style="max-width:100%;display:block;"/>`);
      } catch (_) {}
      return;
    }
  } catch (_) {}
}

export function handleDragEnd(e) {
  this.classList.remove('dragging');
  try {
    if (this.__dragImageEl) {
      this.__dragImageEl.remove();
      delete this.__dragImageEl;
    }
  } catch (_) {}
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
  } else if (state.galleryMode === 'captures') {
    if (confirm('Tem certeza que deseja excluir todas as capturas de tela?')) {
      try {
        // Solicitar exclusão de todas as capturas no backend
        try {
          await fetch('/api/captures/delete-all', { method: 'POST' });
        } catch (_) {}
        state.capturedImages.forEach(ci => { try { URL.revokeObjectURL(ci.url); } catch (e) {} });
        state.capturedImages = [];
        loadCaptureGallery();
      updateStatus('Todas as capturas removidas');
    } catch (err) { console.error(err); }
    }
  } else {
    if (confirm('Tem certeza que deseja excluir todos os uploads?')) {
      try {
        // Opcional: solicitar exclusão de uploads no backend
        try {
          await fetch('/api/uploads/delete-all', { method: 'POST' });
        } catch (_) {}
        state.uploadedImages.forEach(u => { try { URL.revokeObjectURL(u.url); } catch (e) {} });
        state.uploadedImages = [];
        await loadUploadsGallery();
        updateStatus('Todos os uploads removidos');
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
    } else if (state.galleryMode === 'captures') {
      if (msg) msg.textContent = 'Nenhuma captura de tela salva. Use CAPTURAR IMAGEM e depois cole (Ctrl+V) para salvar aqui.';
      if (ctrls) ctrls.style.display = 'none';
    } else {
      if (msg) msg.textContent = 'Nenhuma imagem enviada. Clique em "Enviar Imagens" acima para salvar aqui.';
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

export function initUploadControls() {
  const btn = document.getElementById('btnUploadImages');
  const inp = document.getElementById('inpUploadImages');
  if (btn) {
    btn.addEventListener('click', () => {
      if (inp) inp.click();
    });
  }
  if (inp) {
    inp.addEventListener('change', async () => {
      const files = Array.from(inp.files || []);
      if (!files.length) return;
      try { setGalleryLoading('Enviando imagens...', true); } catch (_) {}
      for (const file of files) {
        const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        try {
          const fd = new FormData();
          fd.append('file', file, file.name);
          const resp = await fetch('/api/uploads/upload', { method: 'POST', body: fd });
          if (!resp.ok) throw new Error('Falha no upload');
          const data = await resp.json();
          const url = data && data.url ? data.url : null;
          const serverFilename = data && data.filename ? data.filename : null;
          if (url) {
            state.uploadedImages.push({ id, url, name: serverFilename || file.name, serverFilename });
          } else {
            // Fallback para manter a experiência ainda que o backend falhe
            const blobUrl = URL.createObjectURL(file);
            state.uploadedImages.push({ id, url: blobUrl, blob: file, name: file.name });
          }
        } catch (e) {
          console.error('Erro ao enviar upload:', e);
          try {
            const blobUrl = URL.createObjectURL(file);
            state.uploadedImages.push({ id, url: blobUrl, blob: file, name: file.name });
          } catch (err) { console.error(err); }
        }
      }
      try { inp.value = ''; } catch (_) {}
      try { setGalleryLoading('', false); } catch (_) {}
      await setGalleryMode('uploads');
      renderGallerySwitchLabelCount();
      updateStatus('Uploads adicionados à galeria');
    });
  }
}

export function updateUploadsControlsVisibility() {
  const ctrls = document.getElementById('uploadsControls');
  if (!ctrls) return;
  ctrls.style.display = (state.galleryMode === 'uploads') ? '' : 'none';
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
    imageCountInfo.innerHTML = `Identifiquei <strong>${imageCount} elemento(s) do tipo imagem </strong>neste PDF. Use esta galeria para: selecioná-las (clicar <strong>2x</strong>), arrastá-las e inserí-las no texto; visualizá-las em tamanho orginal; e excluir as que não são relevantes para o seu projeto.`;
    const pdfNameSpan = document.getElementById('imageCountInfoPdfName');
    if (pdfNameSpan) pdfNameSpan.textContent = pdfName;
    if (infoMessage) {
      if (state.galleryInfoClosed) {
        infoMessage.style.display = 'none';
      } else {
        infoMessage.style.display = imageCount > 0 ? '' : 'none';
      }
    }
  }
}