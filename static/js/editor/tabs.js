import { state, setPdfLoadedForCapture, setAdobeView } from './state.js?v=8';
import { ensureAdobeSdkLoaded } from './adobe-sdk.js';

export function initAdobeViewer(url, fileName) {
  const divId = 'adobe-dc-view';
  const containerDiv = document.getElementById(divId);
  if (!containerDiv || !url || typeof url !== 'string') return;

  const pdfSection = document.getElementById('pdfCaptureSection');
  const isSectionVisible = pdfSection && pdfSection.style.display !== 'none';
  if (!isSectionVisible) return;

  // Guarda contra múltiplas inicializações
  if (state.adobeView || state.pdfLoadedForCapture) return;

  // Carregar SDK apenas uma vez e inicializar após pronto
  ensureAdobeSdkLoaded()
    .then(() => {
      if (state.adobeView || state.pdfLoadedForCapture) return;
      try {
        // Seleciona o clientId conforme o hostname para permitir desenvolvimento em localhost
        const hostname = (window && window.location && window.location.hostname) || '';
        const CLIENT_ID_LOCALHOST = '6bd75db0774d4c1da4477dcbd0904aaf';
        const CLIENT_ID_PROD = 'b06000c70bd143a0adc54a2f6d394b2a';
        const selectedClientId = (hostname === 'localhost' || hostname === '127.0.0.1')
          ? CLIENT_ID_LOCALHOST
          : CLIENT_ID_PROD;
        const view = new AdobeDC.View({ clientId: selectedClientId, divId });
        setAdobeView(view);

        // Atualiza o título da toolbar com o nome do PDF em uso (sem extensão) e ícone
        try {
          const titleEl = document.getElementById('adobeToolbarTitle');
          if (titleEl) {
            const base = String(fileName || 'documento.pdf')
              .split(/[\\\/]/).pop()
              .replace(/\.pdf$/i, '');
            titleEl.innerHTML = `
              <img src="../images/icon_pdf_name_gallery.svg" alt="PDF" class="pdf-title-icon" />
              <span class="pdf-title-text">${base}</span>
            `;
          }
        } catch (_) {}

        // Registrar callback para GET_FEATURE_FLAG para evitar erros "No callback registered"
        try {
          const enumCallbacks = AdobeDC && AdobeDC.View && AdobeDC.View.EnumCallbacks;
          const GET_FEATURE_FLAG = enumCallbacks && enumCallbacks.GET_FEATURE_FLAG;
          if (GET_FEATURE_FLAG && typeof view.registerCallback === 'function') {
            view.registerCallback(GET_FEATURE_FLAG, (flag) => {
              return false; // desabilitar flags por padrão
            });
          }
        } catch (cbErr) {
          console.warn('Falha ao registrar GET_FEATURE_FLAG:', cbErr);
        }
        view
          .previewFile(
            {
              content: { location: { url } },
              metaData: { fileName: fileName || 'documento.pdf' }
            },
            {
              embedMode: 'SIZED_CONTAINER',
              showDownloadPDF: false,
              showPrintPDF: false,
              showFullScreen: true
            }
          )
          .then(() => {
            setPdfLoadedForCapture(true);
          })
          .catch((e) => {
            console.error('Falha ao inicializar Adobe Viewer:', e);
          });
      } catch (e) {
        console.error('Erro ao criar AdobeDC.View:', e);
      }
    })
    .catch((e) => {
      console.warn('AdobeDC View SDK não carregado.', e);
    });
}

export function loadPdfForCapture() {
  const container = document.getElementById('pdfCaptureContainer');
  if (!container) return;

  const candidatePaths = [];
  const selectedName = (() => {
    try {
      return localStorage.getItem('selectedPdfName');
    } catch (e) {
      return null;
    }
  })();
  const uploadDir = (state.estruturaEdicao && state.estruturaEdicao.upload_dir)
    ? state.estruturaEdicao.upload_dir
    : 'temp_uploads';

  if (selectedName && selectedName.trim()) {
    const encoded = encodeURIComponent(selectedName.trim());
    candidatePaths.push(`/${uploadDir}/${encoded}`);
    candidatePaths.push(`/temp_uploads/${encoded}`);
    try {
      const uid = (window.__currentUser && window.__currentUser.user_id) ? window.__currentUser.user_id : 'anonymous';
      candidatePaths.push(`/gcs/uploads/${uid}/pdfs/${encoded}`);
    } catch (_) {}
  }
  try {
    if (state.estruturaEdicao && state.estruturaEdicao.pdf_path) {
      candidatePaths.push(state.estruturaEdicao.pdf_path);
    }
    if (state.estruturaEdicao && state.estruturaEdicao.upload_dir) {
      candidatePaths.push(`/${state.estruturaEdicao.upload_dir}/arquivoteste.pdf`);
    }
  } catch (e) {}
  candidatePaths.push('/temp_uploads/arquivoteste.pdf');

  const tryLoad = (idx) => {
    if (idx >= candidatePaths.length) {
      container.innerHTML = `
        <div class="pdf-error">
          <p>Não foi possível localizar o PDF para captura.</p>
        </div>
      `;
      return;
    }
    const url = candidatePaths[idx];
    fetch(url, { method: 'HEAD' })
      .then((resp) => {
        if (resp.ok) {
          const fileName = selectedName && selectedName.trim()
            ? selectedName.trim()
            : (url.split('/').pop() || 'documento.pdf');
          initAdobeViewer(url, fileName);
        } else if (resp.status === 405) {
          // Alguns servidores não permitem HEAD; tentar um GET leve com Range
          return fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-0' } })
            .then((r) => {
              if (r.ok) {
                const fileName = selectedName && selectedName.trim()
                  ? selectedName.trim()
                  : (url.split('/').pop() || 'documento.pdf');
                initAdobeViewer(url, fileName);
              } else {
                throw new Error('PDF não encontrado');
              }
            });
        } else {
          if (resp.status === 405) {
            return fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-0' } })
              .then((r) => {
                if (r.ok) {
                  const fileName = selectedName && selectedName.trim()
                    ? selectedName.trim()
                    : (url.split('/').pop() || 'documento.pdf');
                  initAdobeViewer(url, fileName);
                } else {
                  throw new Error('PDF não encontrado');
                }
              });
          }
          throw new Error('PDF não encontrado');
        }
      })
      .catch(() => tryLoad(idx + 1));
  };

  tryLoad(0);
}

export function initEditorTabs() {
  const tabEditor = document.getElementById('tabEditor');
  const btnCapture = document.getElementById('btnCapture');
  const editorSection = document.getElementById('editorSection');
  const pdfSection = document.getElementById('pdfCaptureSection');

  if (!tabEditor || !editorSection || !pdfSection) return;

  let activeTab = 'editor';

  function activate(tab) {
    activeTab = tab;
    tabEditor.classList.remove('active');
    if (btnCapture) btnCapture.classList.remove('active');

    // Controlar visibilidade do botão Salvar Projeto
    const btnSaveProjectState = document.getElementById('btnSaveProjectState');

    if (tab === 'editor') {
      tabEditor.classList.add('active');
      editorSection.style.display = '';
      pdfSection.style.display = 'none';
      // Mostrar botão Salvar Projeto apenas na seção Editor
      if (btnSaveProjectState) btnSaveProjectState.style.display = '';
    } else {
      if (btnCapture) btnCapture.classList.add('active');
      editorSection.style.display = 'none';
      pdfSection.style.display = '';
      // Ocultar botão Salvar Projeto nas outras seções
      if (btnSaveProjectState) btnSaveProjectState.style.display = 'none';
      if (!state.pdfLoadedForCapture) {
        loadPdfForCapture();
      }
    }
  }

  // Ao clicar em Editor, garantir que a sidebar esteja expandida e ativar a aba
  tabEditor.addEventListener('click', () => {
    try {
      const sidebar = document.getElementById('sidebar');
      const toggleBtn = document.getElementById('sidebarToggle');
      const containerEl = document.querySelector('.container');
      if (sidebar && sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        if (containerEl) containerEl.classList.remove('sidebar-collapsed');
        if (toggleBtn) {
          toggleBtn.innerHTML = '<img src="../images/close_small.svg" alt="Retrair Galeria" width="56" height="56" style="transform: rotate(180deg);" />';
          toggleBtn.title = 'Retrair Galeria';
          toggleBtn.setAttribute('aria-label', 'Retrair Galeria');
        }
      }
    } catch (_) {}
    activate('editor');
  });

  if (btnCapture) {
    btnCapture.disabled = false;
    btnCapture.title = 'Abrir Visualizar PDF';
    btnCapture.style.cursor = '';
    btnCapture.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const toggleBtn = document.getElementById('sidebarToggle');
      const containerEl = document.querySelector('.container');
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
        if (containerEl) containerEl.classList.add('sidebar-collapsed');
        if (toggleBtn) {
          toggleBtn.innerHTML = '<img src="../images/view_sidebar_gallery.svg" alt="Abrir Galeria" width="58" height="58" style="transform: rotate(180deg);" />';
          toggleBtn.title = 'Abrir Galeria';
          toggleBtn.setAttribute('aria-label', 'Abrir Galeria');
        }
      }
      activate('pdf');
    });
  }

  activate('editor');
}

export function resetAdobeViewer() {
  // Resetar o estado do viewer Adobe para permitir nova inicialização
  try {
    if (state.adobeView) {
      // Tentar limpar o viewer existente se possível
      try {
        const containerDiv = document.getElementById('adobe-dc-view');
        if (containerDiv) {
          containerDiv.innerHTML = '';
        }
      } catch (e) {
        console.warn('Erro ao limpar container do Adobe viewer:', e);
      }
    }
    setAdobeView(null);
    setPdfLoadedForCapture(false);
  } catch (e) {
    console.error('Erro ao resetar Adobe viewer:', e);
  }
}

export function toggleFullscreenMode() {
  const container = document.querySelector('.container');
  const btnFullscreen = document.getElementById('btnFullscreen');
  if (!container || !btnFullscreen) return;
  const btnText = btnFullscreen.querySelector('span');
  const btnIcon = btnFullscreen.querySelector('img');

  if (container.classList.contains('fullscreen-mode')) {
    container.classList.remove('fullscreen-mode');
    if (btnText) btnText.textContent = 'OCULTAR MENU';
    if (btnIcon) {
      btnIcon.src = '../images/open_in_full.svg';
      btnIcon.alt = 'Modo tela cheia';
    }
    btnFullscreen.title = 'Modo tela cheia';
    btnFullscreen.setAttribute('aria-label', 'Modo tela cheia');
  } else {
    container.classList.add('fullscreen-mode');
    if (btnText) btnText.textContent = 'MOSTRAR MENU';
    if (btnIcon) {
      btnIcon.src = '../images/close_view_full.svg';
      btnIcon.alt = 'Sair do modo tela cheia';
    }
    btnFullscreen.title = 'Sair do modo tela cheia';
    btnFullscreen.setAttribute('aria-label', 'Sair do modo tela cheia');
  }
  try {
    if (typeof window.updateGoTopVisibility === 'function') window.updateGoTopVisibility();
  } catch (_) {}
}
