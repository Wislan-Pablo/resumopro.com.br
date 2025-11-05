import { openImageModal, closeImageModal, updateModalImage, nextModalImage, prevModalImage, deleteCurrentModalImage } from './modal.js?v=8';
import {
  deleteGalleryImage,
  copyGalleryImage,
  removeImage,
  setGalleryMode,
  initGallerySwitch,
  loadImageGallery,
  loadCaptureGallery,
  openCaptureModal,
  closeCaptureModal,
  updateCaptureModalImage,
  nextCaptureModalImage,
  prevCaptureModalImage,
  deleteCurrentCaptureModalImage,
  deleteCaptureImage,
  copyCaptureImage,
  setupDropZones,
  deleteAllGalleryImages,
  // Uploads
  openUploadModal,
  closeUploadModal,
  deleteUploadImage,
  copyUploadImage,
  initUploadControls
  , preloadUploads
} from './gallery.js?v=8';
import {
  openProjectSaveModal,
  closeProjectSaveModal,
  openSavedStatesModal,
  closeSavedStatesModal,
  showSuccessModal,
  closeSuccessModal,
  saveProjectState,
  saveProjectStateImmediate,
  loadSavedStates,
  renderSavedStates,
  continueEditingState,
  deleteSavedState,
  getCurrentProject
} from './projects.js?v=8';
import { initEditorTabs, loadPdfForCapture, initAdobeViewer, toggleFullscreenMode, resetAdobeViewer } from './tabs.js?v=8';
import { initJoditDocumentMode, saveCurrentSummaryHTMLDebounced, saveCurrentSummaryHTML } from './jodit.js?v=8';
import { setEstruturaEdicao, state } from './state.js?v=8';
import { refreshPdfAvailability, reloadInitialPdfImages, uploadPdfAndReload, recoverInitialImages } from './pdf-source.js?v=8';
import { initCaptureButton, initPasteCaptureListener } from './captures.js?v=8';
import { initGoToTop, initHeaderHeightSync, updateGoTopVisibility, updateHeaderHeightVar } from './ui.js?v=8';
import { generateFinalPDF } from './pdf.js?v=8';
import { loadEditorData } from './data.js?v=8';

// Expor funções para compatibilidade com atributos onclick existentes
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.updateModalImage = updateModalImage;
window.nextModalImage = nextModalImage;
window.prevModalImage = prevModalImage;
window.deleteCurrentModalImage = () => deleteCurrentModalImage(deleteGalleryImage);

window.deleteGalleryImage = deleteGalleryImage;
window.copyGalleryImage = copyGalleryImage;
window.removeImage = removeImage;
window.openCaptureModal = openCaptureModal;
window.closeCaptureModal = closeCaptureModal;
window.updateCaptureModalImage = updateCaptureModalImage;
window.nextCaptureModalImage = nextCaptureModalImage;
window.prevCaptureModalImage = prevCaptureModalImage;
window.deleteCurrentCaptureModalImage = deleteCurrentCaptureModalImage;
window.deleteCaptureImage = deleteCaptureImage;
window.copyCaptureImage = copyCaptureImage;
window.deleteAllGalleryImages = deleteAllGalleryImages;

// Uploads: expor funções para os handlers declarados inline
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.deleteUploadImage = deleteUploadImage;
window.copyUploadImage = copyUploadImage;


window.setGalleryMode = setGalleryMode;
window.initGallerySwitch = initGallerySwitch;
window.loadImageGallery = loadImageGallery;
window.loadCaptureGallery = loadCaptureGallery;
window.setupDropZones = setupDropZones;

// Abas e Jodit
window.initEditorTabs = initEditorTabs;
window.loadPdfForCapture = loadPdfForCapture;
window.initAdobeViewer = initAdobeViewer;
window.resetAdobeViewer = resetAdobeViewer;
window.toggleFullscreenMode = toggleFullscreenMode;
window.initJoditDocumentMode = initJoditDocumentMode;
window.setEstruturaEdicao = setEstruturaEdicao;
window.saveCurrentSummaryHTML = saveCurrentSummaryHTML;
window.generateFinalPDF = generateFinalPDF;

// Compatibilidade: permitir que código inline acesse joditEditor diretamente
try {
  Object.defineProperty(window, 'joditEditor', {
    get: () => state.joditEditor
  });
} catch (_) {}

window.openProjectSaveModal = openProjectSaveModal;
window.closeProjectSaveModal = closeProjectSaveModal;
window.openSavedStatesModal = openSavedStatesModal;
window.closeSavedStatesModal = closeSavedStatesModal;
window.showSuccessModal = showSuccessModal;
window.closeSuccessModal = closeSuccessModal;
window.saveProjectState = saveProjectState;
window.saveProjectStateImmediate = saveProjectStateImmediate;
window.loadSavedStates = loadSavedStates;
window.renderSavedStates = renderSavedStates;
window.continueEditingState = continueEditingState;
window.deleteSavedState = deleteSavedState;

// Rewire de listeners para garantir uso das funções modularizadas
document.addEventListener('DOMContentLoaded', () => {
  // Botão: salvar estado de projeto
  const btnSaveProjectState = document.getElementById('btnSaveProjectState');
  if (btnSaveProjectState) {
    const clone = btnSaveProjectState.cloneNode(true);
    btnSaveProjectState.replaceWith(clone);
    clone.addEventListener('click', () => {
      const current = getCurrentProject();
      if (current && current.slug) {
        saveProjectStateImmediate(current);
      } else {
        openProjectSaveModal();
      }
    });
  }

  // Botão: abrir estados salvos
  const btnSavedStates = document.getElementById('btnSavedStates');
  if (btnSavedStates) {
    const clone = btnSavedStates.cloneNode(true);
    btnSavedStates.replaceWith(clone);
    clone.addEventListener('click', openSavedStatesModal);
  }

  // Botão: confirmar salvar projeto na modal
  const confirmSaveProjectBtn = document.getElementById('confirmSaveProjectBtn');
  if (confirmSaveProjectBtn) {
    const clone = confirmSaveProjectBtn.cloneNode(true);
    confirmSaveProjectBtn.replaceWith(clone);
    clone.addEventListener('click', saveProjectState);
  }

  // Rewire dos botões de abas e fullscreen para usar módulo
  const tabEditor = document.getElementById('tabEditor');
  if (tabEditor) {
    const clone = tabEditor.cloneNode(true);
    tabEditor.replaceWith(clone);
  }
  const btnCapture = document.getElementById('btnCapture');
  if (btnCapture) {
    const clone = btnCapture.cloneNode(true);
    btnCapture.replaceWith(clone);
  }
  const btnFullscreen = document.getElementById('btnFullscreen');
  if (btnFullscreen) {
    const clone = btnFullscreen.cloneNode(true);
    btnFullscreen.replaceWith(clone);
    clone.addEventListener('click', () => {
      try { toggleFullscreenMode(); } catch (_) {}
      try { updateHeaderHeightVar(); } catch (_) {}
      try { updateGoTopVisibility(); } catch (_) {}
    });
  }

  // Botão: Upload de novo PDF
  const btnUpload = document.getElementById('upload_file');
  if (btnUpload) {
    const clone = btnUpload.cloneNode(true);
    btnUpload.replaceWith(clone);
    clone.addEventListener('click', () => {
      try {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'application/pdf';
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('change', () => {
          const file = inp.files && inp.files[0];
          if (file) {
            try { uploadPdfAndReload(file); } catch (e) { console.error(e); }
          }
          try { document.body.removeChild(inp); } catch (_) {}
        });
        inp.click();
      } catch (e) { console.error(e); }
    });
  }

  // Botão: Recuperar imagens iniciais do PDF
  const btnRecover = document.getElementById('btnRecoverInitialImages');
  if (btnRecover) {
    const clone = btnRecover.cloneNode(true);
    btnRecover.replaceWith(clone);
    clone.addEventListener('click', () => { try { recoverInitialImages(); } catch (e) { console.error(e); } });
  }

  // Botão: Recuperar sessão de Capturas (abre o fluxo de captura do PDF)
  const btnRecoverCaptures = document.getElementById('btnRecoverCaptures');
  if (btnRecoverCaptures) {
    const clone = btnRecoverCaptures.cloneNode(true);
    btnRecoverCaptures.replaceWith(clone);
    clone.addEventListener('click', () => {
      try {
        const btn = document.getElementById('btnCapture');
        if (btn && typeof btn.click === 'function') {
          btn.click();
        } else {
          const editorSection = document.getElementById('editorSection');
          const pdfSection = document.getElementById('pdfCaptureSection');
          if (editorSection && pdfSection) {
            editorSection.style.display = 'none';
            pdfSection.style.display = '';
          }
        }
      } catch (e) { console.error(e); }
    });
  }

  // Toggle de retração/expansão da galeria (sidebar)
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleEl = document.getElementById('sidebarToggle');
  const containerEl = document.querySelector('.container');
  let sidebarToggle = sidebarToggleEl;
  if (sidebarToggleEl) {
    const clone = sidebarToggleEl.cloneNode(true);
    sidebarToggleEl.replaceWith(clone);
    sidebarToggle = clone;
  }
  function setToggleState(collapsed) {
    if (!sidebarToggle || !sidebar) return;
    if (collapsed) {
      sidebarToggle.innerHTML = '<img src="../images/view_sidebar_gallery.svg" alt="Abrir Galeria" width="58" height="58" style="transform: rotate(180deg);" />';
      sidebarToggle.title = 'Abrir Galeria';
      sidebarToggle.setAttribute('aria-label', 'Abrir Galeria');
    } else {
      sidebarToggle.innerHTML = '<img src="../images/close_small.svg" alt="Retrair Galeria" width="56" height="56" style="transform: rotate(180deg);" />';
      sidebarToggle.title = 'Retrair Galeria';
      sidebarToggle.setAttribute('aria-label', 'Retrair Galeria');
    }
  }
  setToggleState(false);
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      setToggleState(isCollapsed);
      if (containerEl) {
        containerEl.classList.toggle('sidebar-collapsed', isCollapsed);
      }
    });
  }

  // Inicializar abas via módulo (evita duplicações ao clonar botões)
  try { initEditorTabs(); } catch (_) {}

  // Inicializar dados do editor e Jodit via módulos
  try {
    Promise.resolve(loadEditorData()).finally(() => {
      try { initJoditDocumentMode(); } catch (_) {}
    });
  } catch (_) { try { initJoditDocumentMode(); } catch (e) {} }

  // Drop zones e switch da galeria já expostos globalmente
  try { setupDropZones(); } catch (_) {}
  // Pré-carregar uploads para sincronizar contador do select
  try {
    Promise.resolve(preloadUploads()).finally(() => {
      try { initGallerySwitch(); } catch (_) {}
      try { initUploadControls(); } catch (_) {}
    });
  } catch (_) {
    try { initGallerySwitch(); } catch (_) {}
    try { initUploadControls(); } catch (_) {}
  }

  // Inicializar captura de tela e listener de colagem
  try { initCaptureButton(); } catch (_) {}
  try { initPasteCaptureListener(); } catch (_) {}

  // UI: botão Ir ao topo e sincronização de altura do header
  try { initGoToTop(); } catch (_) {}
  try { initHeaderHeightSync(); } catch (_) {}

  // Atualizar disponibilidade de PDF em temp_uploads
  try { refreshPdfAvailability(); } catch (_) {}
});