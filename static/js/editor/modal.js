import { state } from './state.js';
import { getSortedImages, getImagePageInfo } from './utils.js';

export function openImageModal(imageName) {
  const images = getSortedImages();
  if (images.length === 0) return;
  const idx = images.indexOf(imageName);
  state.modalCurrentIndex = idx >= 0 ? idx : 0;
  updateModalImage();
  const modal = document.getElementById('imageModal');
  if (modal) modal.classList.add('active');
}

export function closeImageModal() {
  const modal = document.getElementById('imageModal');
  if (modal) modal.classList.remove('active');
}

export function updateModalImage() {
  const images = getSortedImages();
  if (images.length === 0) { closeImageModal(); return; }
  if (state.modalCurrentIndex == null) state.modalCurrentIndex = 0;
  if (state.modalCurrentIndex < 0) state.modalCurrentIndex = images.length - 1;
  if (state.modalCurrentIndex >= images.length) state.modalCurrentIndex = 0;
  const name = images[state.modalCurrentIndex];
  const imgEl = document.getElementById('modalImage');
  if (imgEl) {
    imgEl.src = `/temp_uploads/imagens_extraidas/${name}?v=${state.galleryCacheBust}`;
    imgEl.alt = name;
  }
  const labelEl = document.getElementById('modalFilename');
  if (labelEl) {
    const info = getImagePageInfo(name);
    const prettyBase = String(name)
      .replace(/\.png$/i, '')
      .replace(/^img_/i, 'imagem-');
    const displayName = (info && info.pagina != null)
      ? `${prettyBase} — Página ${info.pagina}`
      : prettyBase;
    labelEl.textContent = displayName;
  }
}

export function nextModalImage() { state.modalCurrentIndex++; updateModalImage(); }
export function prevModalImage() { state.modalCurrentIndex--; updateModalImage(); }

export function deleteCurrentModalImage(deleteGalleryImageFn) {
  const images = getSortedImages();
  if (images.length === 0 || state.modalCurrentIndex == null) return;
  const name = images[state.modalCurrentIndex];
  deleteGalleryImageFn(name);
  setTimeout(() => {
    const updated = getSortedImages();
    if (updated.length === 0) {
      closeImageModal();
    } else {
      if (state.modalCurrentIndex >= updated.length) {
        state.modalCurrentIndex = updated.length - 1;
      }
      updateModalImage();
    }
  }, 0);
}