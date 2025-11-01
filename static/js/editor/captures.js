import { state } from './state.js';
import { setGalleryMode, loadCaptureGallery } from './gallery.js';
import { updateStatus } from './utils.js';

export function initCaptureButton() {
  const btnCaptureImage = document.getElementById('btnCaptureImage');
  if (!btnCaptureImage) return;
  btnCaptureImage.addEventListener('click', function () {
    try {
      const a = document.createElement('a');
      a.href = 'ms-screenclip:';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setGalleryMode('captures');
      updateStatus('Após capturar, pressione Ctrl+V para salvar a imagem na galeria de capturas.');
    } catch (e) {
      console.warn('Screen Snip não pôde ser iniciado:', e);
    }
  });
}

export function initPasteCaptureListener() {
  window.addEventListener('paste', async function(e){
    try {
      const dt = e.clipboardData || window.clipboardData;
      if (!dt || !dt.items) return;
      let file = null;
      for (let i = 0; i < dt.items.length; i++) {
        const it = dt.items[i];
        if (it.type && (it.type.startsWith('image/png') || it.type.startsWith('image/jpeg'))) {
          file = it.getAsFile();
          break;
        }
      }
      if (!file) return;
      e.preventDefault();
      const blob = file;
      const url = URL.createObjectURL(blob);
      const id = 'cap_' + Date.now() + '_' + (state.capturedImages.length + 1);
      state.capturedImages.push({ id, blob, url, createdAt: Date.now() });
      setGalleryMode('captures');
      loadCaptureGallery();
      updateStatus('Captura salva na galeria');
    } catch (err) { console.error(err); }
  });
}