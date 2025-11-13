import { setEstruturaEdicao, setGalleryCacheBust, state } from './state.js?v=8';
import { loadImageGallery, setGalleryLoading, hideGalleryEmptyState, showGalleryEmptyState, setGalleryMode } from './gallery.js';
import { convertMarkdownToHtml, buildImagemInfoLookup, setCurrentPdfLabel } from './utils.js?v=8';
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

    // Sanitizar conteúdo inicial: remover placeholder e marcadores temporários do Jodit
    const sanitizeInitialHtml = (html) => {
      try {
        const container = document.createElement('div');
        container.innerHTML = html || '';
        // Remover spans de seleção temporários, caso tenham sido persistidos por engano
        container.querySelectorAll('span[data-jodit-temp="true"], span[data-jodit-selection_marker]').forEach((s) => {
          try { s.remove(); } catch (_) { s.style.display = 'none'; }
        });
        const isPlaceholderText = (txt) => {
          const norm = String(txt || '').replace(/\s+/g, ' ').trim().toLowerCase();
          return norm === 'resumo temporário para extração de imagens.' || /resumo\s+temporário.*extração de imagens\.?/i.test(txt || '');
        };
        // Remover parágrafos que contenham o texto placeholder
        container.querySelectorAll('p').forEach((p) => {
          const t = (p.textContent || '').trim();
          if (isPlaceholderText(t)) {
            try { p.remove(); } catch (_) { p.innerHTML = ''; }
          }
        });
        // Também remover o texto solto se não estiver em <p>
        const fullText = (container.textContent || '').trim();
        if (isPlaceholderText(fullText) && container.children.length === 0) {
          container.innerHTML = '';
        }
        return container.innerHTML;
      } catch (_) {
        return html || '';
      }
    };
    htmlContent = sanitizeInitialHtml(htmlContent);

    // Carregar o conteúdo na div structuredSummary (Jodit será inicializado depois)
    const el = document.getElementById('structuredSummary');
    if (el) el.innerHTML = htmlContent;

    // Carregar imagens na galeria
    window.__imageInfoLookup = buildImagemInfoLookup(estruturaEdicao.imagens_info);
    loadImageGallery();
    // Ocultar spinner e mostrar conteúdo da galeria
    try { setGalleryLoading('', false); } catch (_) {}
    // Atualizar disponibilidade de PDF antes de decidir quais controles exibir no estado vazio
    try { await refreshPdfAvailability(); } catch (_) {}
    try {
      const hasImages = !!(state.estruturaEdicao && Array.isArray(state.estruturaEdicao.images) && state.estruturaEdicao.images.length);
      if (hasImages) {
        hideGalleryEmptyState();
      } else {
        // Estado inicial vazio: mostrar mensagem e controles adequados (Enviar PDF)
        showGalleryEmptyState();
        const infoMsg = document.getElementById('galleryInfoMessage');
        if (infoMsg) infoMsg.style.display = 'none';
        const actions = document.querySelector('.gallery-actions');
        if (actions) actions.style.display = 'none';
      }
    } catch (_) {}

    // Carregar capturas persistidas, se existirem
    try {
      const caps = Array.isArray(estruturaEdicao.captured_images) ? estruturaEdicao.captured_images : [];
      if (caps.length) {
        state.capturedImages = caps.map((fn, idx) => ({ id: `srv_${idx+1}_${fn}`, url: `/temp_uploads/capturas_de_tela/${String(fn).split(/[\\\/]/).pop()}`, createdAt: 0 }));
      } else {
        state.capturedImages = [];
      }
      // Atualizar empty state/contador da aba Capturas
      try { setGalleryMode('pdf'); } catch (_) {}
    } catch (_) {}

    // Disponibilidade de PDF já foi atualizada acima para refletir os controles do estado vazio
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    // Em vez de mensagem genérica, mostrar estado vazio amigável
    try { showGalleryEmptyState(); } catch (_) {}
    try {
      const infoMsg = document.getElementById('galleryInfoMessage');
      if (infoMsg) infoMsg.style.display = 'none';
      const actions = document.querySelector('.gallery-actions');
      if (actions) actions.style.display = 'none';
    } catch (_) {}
    try { setGalleryLoading('', false); } catch (_) {}
    try { await refreshPdfAvailability(); } catch (_) {}
  }
}

// Expor para compatibilidade com main.js e outros códigos inline
try { window.loadEditorData = loadEditorData; } catch (_) {}