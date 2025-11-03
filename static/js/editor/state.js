// Shared state for the editor modules
export const state = {
  estruturaEdicao: null,
  imagensPosicionadas: [],
  galleryCacheBust: Date.now(),
  galleryMode: 'pdf',
  capturedImages: [],
  uploadedImages: [],
  captureTriggeredByButton: false,
  joditEditor: null,
  // Último HTML salvo para detectar alterações no documento
  lastSavedHtml: '',
  modalCurrentIndex: null,
  pdfLoadedForCapture: false,
  adobeView: null,
  // Mantém, durante a sessão, se o usuário fechou a mensagem informativa da galeria
  galleryInfoClosed: false
};

// Convenience setters to avoid accidental reassignment of the state object
export function setJoditEditor(editor) {
  state.joditEditor = editor;
}

export function setEstruturaEdicao(data) {
  state.estruturaEdicao = data;
}

export function setGalleryMode(mode) {
  state.galleryMode = (mode === 'captures')
    ? 'captures'
    : (mode === 'uploads' ? 'uploads' : 'pdf');
}

export function setGalleryCacheBust() {
  state.galleryCacheBust = Date.now();
}

export function setModalCurrentIndex(idx) {
  state.modalCurrentIndex = idx;
}

export function setPdfLoadedForCapture(val) {
  state.pdfLoadedForCapture = !!val;
}

export function setAdobeView(view) {
  state.adobeView = view || null;
}