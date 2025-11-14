import { state, setGalleryCacheBust } from './state.js?v=8';
import { loadImageGallery, updateImageCountInfo, hideGalleryEmptyState, setGalleryLoading, setGalleryMode } from './gallery.js';
import { buildImagemInfoLookup, setCurrentPdfLabel } from './utils.js?v=8';

export async function refreshPdfAvailability() {
  try {
    const btnRecover = document.getElementById('btnRecoverInitialImages');
    const res = await fetch('/api/list-pdfs', { headers: { 'Accept': 'application/json' }, credentials: 'include' });
    if (!res.ok) throw new Error('Falha ao listar PDFs');
    const data = await res.json();
    const pdfs = Array.isArray(data.pdfs) ? data.pdfs : [];
    const hasPdf = pdfs.length > 0;

    if (btnRecover) {
      btnRecover.disabled = !hasPdf;
      btnRecover.title = hasPdf ? '' : 'Nenhum PDF disponível em temp_uploads para recaptura';
    }

    let selected = null;
    try { selected = localStorage.getItem('selectedPdfName'); } catch (_) {}

    // Se há um selected armazenado, garantir que ele exista na lista atual de PDFs
    if (selected && selected.trim()) {
      const match = pdfs.includes(selected.trim());
      if (!match) {
        if (hasPdf) {
          // Corrigir para o primeiro PDF disponível e persistir
          selected = pdfs[0];
          try { localStorage.setItem('selectedPdfName', selected); } catch (_) {}
        } else {
          // Lista vazia: limpar seleção e mostrar rótulo padrão
          selected = null;
          try { localStorage.removeItem('selectedPdfName'); } catch (_) {}
        }
      }
    }

    // Se não há selected e existem PDFs, selecionar o primeiro
    if ((!selected || !selected.trim()) && hasPdf) {
      selected = pdfs[0];
      try { localStorage.setItem('selectedPdfName', selected); } catch (_) {}
    }

    setCurrentPdfLabel(selected);
  } catch (e) {
    console.warn('refreshPdfAvailability falhou:', e);
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
  }
}

export async function uploadPdfAndReload(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('originalPdf', file);
  // Gerar um blob URL temporário para visualização imediata (ambiente local)
  try {
    const blobUrl = URL.createObjectURL(file);
    window.__tempPdfBlobUrl = blobUrl;
  } catch (_) {}

  try {
    const response = await fetch('/api/upload-pdf', {
      method: 'POST',
      body: fd,
      credentials: 'include'
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

    // Garantir que a sessão ativa da galeria seja "Imagens Pré-Carregadas" para o novo PDF
    try {
      await setGalleryMode('pdf');
    } catch (_) {}

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
    // Limpar blob temporário quando o viewer estiver pronto em outra origem
    try {
      const clearTemp = () => {
        if (window.__tempPdfBlobUrl) {
          try { URL.revokeObjectURL(window.__tempPdfBlobUrl); } catch (e) {}
          window.__tempPdfBlobUrl = null;
        }
      };
      // Pequeno atraso para evitar revogar antes de uso
      setTimeout(clearTemp, 5000);
    } catch (_) {}
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
    await refreshPdfAvailability();
  } catch (err) {
    console.error(err);
    setGalleryLoading('', false);
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