import { state, setGalleryCacheBust } from './state.js';
import { loadImageGallery, updateImageCountInfo, hideGalleryEmptyState, setGalleryLoading } from './gallery.js';
import { updateStatus, buildImagemInfoLookup, setCurrentPdfLabel } from './utils.js';

export async function refreshPdfAvailability() {
  try {
    const btnRecover = document.getElementById('btnRecoverInitialImages');
    const res = await fetch('/api/list-pdfs', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Falha ao listar PDFs');
    const data = await res.json();
    const pdfs = Array.isArray(data.pdfs) ? data.pdfs : [];
    const hasPdf = pdfs.length > 0;
    if (btnRecover) {
      btnRecover.disabled = !hasPdf;
      btnRecover.title = hasPdf ? '' : 'Nenhum PDF disponível em temp_uploads para recaptura';
    }
    let selected = null;
    try { selected = localStorage.getItem('selectedPdfName'); } catch (e) {}
    if (!selected && hasPdf) {
      selected = pdfs[0];
      try { localStorage.setItem('selectedPdfName', selected); } catch (e) {}
    }
    setCurrentPdfLabel(selected);
  } catch (e) {
    console.warn('refreshPdfAvailability falhou:', e);
    setCurrentPdfLabel(null);
    const btnRecover = document.getElementById('btnRecoverInitialImages');
    if (btnRecover) {
      btnRecover.disabled = true;
      btnRecover.title = 'Não foi possível verificar PDFs em temp_uploads';
    }
  }
}

export async function reloadInitialPdfImages() {
  try {
    // Resetar o viewer Adobe para permitir carregamento de novo PDF
    try {
      if (typeof window.resetAdobeViewer === 'function') {
        window.resetAdobeViewer();
      }
    } catch (e) {
      console.warn('Erro ao resetar Adobe viewer:', e);
    }

    const res = await fetch(`/temp_uploads/imagens_extraidas/imagens_info.json?v=${Date.now()}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Falha ao carregar imagens iniciais');
    const data = await res.json();
    if (!state.estruturaEdicao) state.estruturaEdicao = {};
    state.estruturaEdicao.imagens_info = data || {};
    const images = Object.keys(state.estruturaEdicao.imagens_info || {}).map(n => String(n).split(/[\\\/]/).pop());
    state.estruturaEdicao.images = images;
    window.__imageInfoLookup = buildImagemInfoLookup(state.estruturaEdicao.imagens_info);
    setGalleryCacheBust();
    if (state.galleryMode === 'pdf') loadImageGallery();
    updateImageCountInfo();
    hideGalleryEmptyState();
    updateStatus('Imagens iniciais do PDF recuperadas');
    try { setCurrentPdfLabel(localStorage.getItem('selectedPdfName') || (state.estruturaEdicao && state.estruturaEdicao.pdf_name)); } catch (e) {}
    await refreshPdfAvailability();

    // Recarregar o PDF no viewer Adobe após resetar
    try {
      if (typeof window.loadPdfForCapture === 'function') {
        window.loadPdfForCapture();
      }
    } catch (e) {
      console.warn('Erro ao recarregar PDF no viewer:', e);
    }
  } catch (err) {
    console.error(err);
    updateStatus('Não foi possível recuperar as imagens iniciais (verifique o PDF)');
  }
}

export async function uploadPdfAndReload(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('originalPdf', file);

  try {
    const response = await fetch('/api/upload-pdf', {
      method: 'POST',
      body: fd,
    });

    if (response.ok) {
      const result = await response.json();
      try { localStorage.setItem('selectedPdfName', result.filename); } catch (e) {}
    } else {
      console.error('Falha no upload do PDF');
      // Mesmo em caso de falha, define o nome para tentar recarregar
      try { localStorage.setItem('selectedPdfName', file.name); } catch (e) {}
    }
  } catch (error) {
    console.error('Erro durante o upload do PDF:', error);
    // Em caso de erro de rede, também define o nome para tentar recarregar
    try { localStorage.setItem('selectedPdfName', file.name); } catch (e) {}
  } finally {
    // A extração de imagens no backend é síncrona, então podemos recarregar imediatamente.
    await reloadInitialPdfImages();

    // Após recarregar, ativar/mostrar a seção de captura automaticamente
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
    } catch (e) {
      console.warn('Não foi possível ativar a seção de captura após upload:', e);
    }
  }
}

export async function recoverInitialImages() {
  const btnRecoverInitialImages = document.getElementById('btnRecoverInitialImages');
  try {
    if (btnRecoverInitialImages) btnRecoverInitialImages.disabled = true;
    const pdfName = (() => {
      try {
        const stored = localStorage.getItem('selectedPdfName');
        if (stored) return stored;
      } catch (e) {}
      if (state.estruturaEdicao && state.estruturaEdicao.pdf_name) return state.estruturaEdicao.pdf_name;
      const p = state.estruturaEdicao && state.estruturaEdicao.pdf_path;
      if (p && typeof p === 'string') {
        const base = p.split('/').pop();
        if (base && base.toLowerCase().endsWith('.pdf')) return base;
      }
      return 'desconhecido';
    })();
    const loadingMsg = `Recuperando imagens do PDF [${pdfName}]...`;
    setGalleryLoading(loadingMsg, true);
    updateStatus(loadingMsg);
    const payload = { pdf_name: pdfName };
    const resp = await fetch('/api/recover-initial-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Falha ao recapturar imagens iniciais');
    await reloadInitialPdfImages();
    hideGalleryEmptyState();
    setGalleryLoading('', false);
    updateStatus('Imagens iniciais recapturadas com sucesso');
    await refreshPdfAvailability();
  } catch (err) {
    console.error(err);
    setGalleryLoading('', false);
    updateStatus('Não foi possível recapturar as imagens iniciais (verifique se há um PDF em temp_uploads)');
  } finally {
    if (btnRecoverInitialImages) btnRecoverInitialImages.disabled = false;
  }
}

// Expor para compatibilidade se necessário
try {
  window.refreshPdfAvailability = refreshPdfAvailability;
  window.reloadInitialPdfImages = reloadInitialPdfImages;
  window.uploadPdfAndReload = uploadPdfAndReload;
} catch (_) {}