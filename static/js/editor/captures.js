import { state } from './state.js';
import { setGalleryMode, loadCaptureGallery } from './gallery.js';

export function initCaptureButton() {
  const btnCaptureImage = document.getElementById('btnCaptureImage');
  if (!btnCaptureImage) return;
  btnCaptureImage.addEventListener('click', function () {
    try {
      // Marcar que a captura foi iniciada via botão
      state.captureTriggeredByButton = true;
      const a = document.createElement('a');
      a.href = 'ms-screenclip:';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('Screen Snip não pôde ser iniciado:', e);
    }
  });
}

export function initPasteCaptureListener() {
  // Listener global removido para evitar inserções fora do editor.
  // A captura será tratada pelo evento de paste do Jodit dentro do iframe.
}