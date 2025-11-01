import { setEstruturaEdicao, setGalleryCacheBust, state } from './state.js';
import { loadImageGallery, setGalleryLoading, hideGalleryEmptyState } from './gallery.js';
import { convertMarkdownToHtml, buildImagemInfoLookup, setCurrentPdfLabel, updateStatus } from './utils.js';
import { refreshPdfAvailability } from './pdf-source.js';

// Carregar dados da estrutura de edição e preparar galeria/conteúdo
export async function loadEditorData() {
  const tryFetchJSON = async (url) => {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('json')) throw new Error('Conteúdo não JSON em ' + url + ' (' + ct + ')');
    return res.json();
  };
  const tryFetchText = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
    return res.text();
  };

  try {
    let estruturaEdicao;
    // Tentar backend, depois fallback local
    try {
      estruturaEdicao = await tryFetchJSON('/api/get-editor-data');
    } catch (e1) {
      try {
        estruturaEdicao = await tryFetchJSON('/temp_uploads/estrutura_edicao.json');
      } catch (e2) {
        const [htmlText, imagensInfo] = await Promise.all([
          tryFetchText('/static/resumo_estruturado_formatado.html').catch(() => tryFetchText('/temp_uploads/temp_doc.html')),
          tryFetchJSON('/temp_uploads/imagens_extraidas/imagens_info.json').catch(() => null)
        ]);

        const images = imagensInfo ? Object.keys(imagensInfo) : [];
        estruturaEdicao = {
          pdf_name: (localStorage.getItem('selectedPdfName') || null),
          pdf_path: null,
          resumo_formatado: true,
          resumo_text: htmlText || '<p>Conteúdo indisponível.</p>',
          images,
          imagens_info: imagensInfo || {}
        };
      }
    }

    // Normalizar nomes das imagens para evitar paths completos
    if (estruturaEdicao && Array.isArray(estruturaEdicao.images)) {
      estruturaEdicao.images = estruturaEdicao.images.map((n) => String(n).split(/[\\\/]/).pop());
    }

    // Atualizar bust da galeria e estado compartilhado
    setGalleryCacheBust();
    setEstruturaEdicao(estruturaEdicao);

    // Persistir nome do PDF para ser exibido corretamente na galeria
    try {
      if (!localStorage.getItem('selectedPdfName')) {
        const pdfCandidate = estruturaEdicao.pdf_name || (estruturaEdicao.pdf_path ? estruturaEdicao.pdf_path.split('/').pop() : null);
        if (pdfCandidate) localStorage.setItem('selectedPdfName', pdfCandidate);
      }
    } catch (e) {}

    // Atualizar rótulo do PDF
    try {
      const current = localStorage.getItem('selectedPdfName') || estruturaEdicao.pdf_name || (estruturaEdicao.pdf_path ? estruturaEdicao.pdf_path.split('/').pop() : null);
      setCurrentPdfLabel(current);
    } catch (e) { setCurrentPdfLabel(estruturaEdicao.pdf_name); }

    // Verificar se o resumo já está formatado como HTML
    let htmlContent;
    if (estruturaEdicao.resumo_formatado) {
      htmlContent = estruturaEdicao.resumo_text;
      console.log('Carregando resumo com formatação HTML preservada');
    } else {
      htmlContent = convertMarkdownToHtml(estruturaEdicao.resumo_text);
      console.log('Convertendo resumo de Markdown para HTML');
    }

    // Carregar o conteúdo na div structuredSummary (Jodit será inicializado depois)
    const el = document.getElementById('structuredSummary');
    if (el) el.innerHTML = htmlContent;

    // Carregar imagens na galeria
    window.__imageInfoLookup = buildImagemInfoLookup(estruturaEdicao.imagens_info);
    loadImageGallery();
    // Ocultar spinner e mostrar conteúdo da galeria
    try { setGalleryLoading('', false); } catch (_) {}
    try {
      if (state.estruturaEdicao && Array.isArray(state.estruturaEdicao.images) && state.estruturaEdicao.images.length > 0) {
        hideGalleryEmptyState();
      }
    } catch (_) {}

    updateStatus('Dados carregados com sucesso');
    // Atualizar disponibilidade de PDF para recaptura
    try { await refreshPdfAvailability(); } catch (_) {}
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    const galleryEl = document.getElementById('imageGallery');
    if (galleryEl) {
      galleryEl.innerHTML = '<p>Não foi possível carregar a galeria.</p>';
    }
    try { setGalleryLoading('', false); } catch (_) {}
    updateStatus('Erro ao carregar dados');
    try { await refreshPdfAvailability(); } catch (_) {}
  }
}

// Expor para compatibilidade com main.js e outros códigos inline
try { window.loadEditorData = loadEditorData; } catch (_) {}