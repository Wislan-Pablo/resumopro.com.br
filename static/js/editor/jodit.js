import { state, setJoditEditor } from './state.js';
import { updateStatus, updateImageCount, debounce } from './utils.js';
import { createImagePlaceholder, setGalleryMode, loadCaptureGallery } from './gallery.js';

// Ajuste: quando a modal de Preview do Jodit aparecer, definir min-width do iframe para 100%
function initPreviewIframeMinWidthFix() {
  try {
    const isJoditModalIframe = (iframe) => {
      let el = iframe && iframe.parentElement;
      let foundJodit = false;
      let foundDialogish = false;
      for (let i = 0; i < 8 && el; i++) {
        const cls = (el.className || '').toLowerCase();
        if (cls.includes('jodit')) foundJodit = true;
        if (cls.includes('dialog') || cls.includes('popup') || cls.includes('preview') || cls.includes('modal')) foundDialogish = true;
        el = el.parentElement;
      }
      return !!(foundJodit && foundDialogish);
    };

    const apply = (iframe) => {
      if (!iframe) return;
      try {
        iframe.style.minWidth = '100%';
      } catch (_) {}
    };

    // Aplicar imediatamente em iframes já presentes (se houver)
    try {
      const existingIframes = document.querySelectorAll('iframe');
      existingIframes.forEach((ifr) => {
        if (isJoditModalIframe(ifr)) apply(ifr);
      });
    } catch (_) {}

    // Observar futuras inserções de iframes (modal de Preview)
    try {
      const mo = new MutationObserver((mutations) => {
        try {
          for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) {
              m.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (node.tagName === 'IFRAME') {
                  if (isJoditModalIframe(node)) apply(node);
                }
                const ifrs = node.querySelectorAll ? node.querySelectorAll('iframe') : [];
                if (ifrs && ifrs.length) {
                  ifrs.forEach((ifr) => {
                    if (isJoditModalIframe(ifr)) apply(ifr);
                  });
                }
              });
            }
          }
        } catch (_) {}
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  } catch (_) {}
}

export async function saveCurrentSummaryHTML(origin) {
  try {
    const el = document.getElementById('structuredSummary');
    let htmlContent = '';
    if (state.joditEditor && state.joditEditor.editorDocument && state.joditEditor.editorDocument.body) {
      htmlContent = state.joditEditor.editorDocument.body.innerHTML;
    } else if (el) {
      htmlContent = el.innerHTML;
    }
    await fetch('/api/save-structured-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '', html: htmlContent }),
      // Garantir persistência ao sair da página
      keepalive: origin === 'beforeunload'
    });
    updateStatus('Resumo salvo');
  } catch (err) {
    console.error('Falha ao salvar resumo estruturado:', err);
    updateStatus('Falha ao salvar resumo');
  }
}

export const saveCurrentSummaryHTMLDebounced = debounce(() => saveCurrentSummaryHTML('change'), 800);

// Estado de alterações e botões de salvar
function getCurrentEditorHtml() {
  try {
    const doc = state.joditEditor && state.joditEditor.editorDocument;
    if (doc && doc.body) return doc.body.innerHTML || '';
    const el = document.getElementById('structuredSummary');
    return (el && el.innerHTML) ? el.innerHTML : '';
  } catch (_) { return ''; }
}

function getCurrentEditorIsEmpty() {
  try {
    const doc = state.joditEditor && state.joditEditor.editorDocument;
    const body = (doc && doc.body) ? doc.body : document.getElementById('structuredSummary');
    if (!body) return true;
    const textLen = (body.textContent || '').replace(/\s+/g, '').length;
    if (textLen > 0) return false;
    const hasTagMedia = !!body.querySelector('img, picture, svg, canvas, figure, video, audio');
    const hasObjectImage = !!body.querySelector('object[type^="image"], embed[type^="image"], object[data^="data:image"], embed[src^="data:image"]');
    const hasBackgroundImageInline = !!body.querySelector('[style*="background-image"]');
    const hasMedia = hasTagMedia || hasObjectImage || hasBackgroundImageInline;
    return !hasMedia;
  } catch (_) { return true; }
}

export function updateSaveButtonsDisabled() {
  try {
    const html = getCurrentEditorHtml();
    const isEmpty = getCurrentEditorIsEmpty();
    const hasChanges = (state.lastSavedHtml || '') !== (html || '');
    const shouldDisable = isEmpty || !hasChanges;
    const btnTop = document.getElementById('btnSaveProjectState');
    const btnConfirm = document.getElementById('confirmSaveProjectBtn');
    if (btnTop) {
      btnTop.disabled = !!shouldDisable;
      btnTop.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    }
    if (btnConfirm) {
      btnConfirm.disabled = !!shouldDisable;
      btnConfirm.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    }
  } catch (_) {}
}

export function markDocumentSavedBaseline() {
  try {
    state.lastSavedHtml = getCurrentEditorHtml();
    updateSaveButtonsDisabled();
  } catch (_) {}
}

export function initJoditDocumentMode() {
  const el = document.getElementById('structuredSummary');
  if (!el) return;
  if (state.joditEditor) return;
  if (typeof Jodit === 'undefined' || !Jodit || !Jodit.make) {
    console.warn('Jodit não disponível no contexto global.');
    return;
  }

  const editor = Jodit.make('#structuredSummary', {
    language: 'pt_br',
    placeholder: 'Escreva ou cole seu texto aqui e use a Galeria no menu lateral para visualizar as imagens pré-carregadas do PDF ou capture novas imagens no PDF através do menu superior - Capturar Imagem no PDF. Copie as imagens através do ícone no canto superior esquerdo da imagem, ou clique (mantenha pressionado) e arraste para inseri-las aqui...',
    iframe: true,
    height: 500,
    toolbarButtonSize: 'small',
    statusbar: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    defaultActionOnPaste: 'insert_as_html',
    iframeCSSLinks: [
      'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap'
    ],
    iframeStyle: `
      body.jodit-wysiwyg { font-family: 'Noto Sans', Arial, sans-serif; color:#222; line-height:1.5; padding: 10px; margin: 0; }
      /* Remover deslocamento vertical inicial do primeiro parágrafo */
      p { margin: 0 0 1em 0; }
      /* Ocultar possíveis ícones ou spans de "Enter" inseridos pelo editor dentro do iframe */
      span[aria-label="Enter"],
      span[title*="Enter"],
      span[data-icon*="enter"],
      span[class*="enter"] { display: none !important; }
      img { max-width: 100%; height: auto; }
      h1 { font-size: 1.4em; }
      h2 { font-size: 1.2em; }
      h3 { font-size: 1.1em; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #444; text-align: center; }
      thead tr, th { background-color: #cfe0ff; }
    `,
    // Remover botões indesejados da toolbar
    removeButtons: ['file', 'video', 'class', 'className', 'addClass', 'youtube'],
    // Esconder controles explicitamente (por segurança, caso algum plugin os re-insira)
    controls: {
      file: { visible: false },
      video: { visible: false },
      youtube: { visible: false },
      class: { visible: false },
      className: { visible: false },
      addClass: { visible: false }
    },
    disablePlugins: ['className'],
    events: {
      afterInit: function (editorInstance) {
        try {
          // Ajuste da toolbar: remover grupo vazio 'info' e garantir que 'actions' seja o último sem borda
          try {
            const container = editorInstance && editorInstance.container ? editorInstance.container : null;
            const tbBox = container ? container.querySelector('.jodit-toolbar__box') : null;
            const fixToolbar = () => {
              try {
                if (!tbBox) return;
                const infoGroup = tbBox.querySelector('.jodit-ui-group_group_info');
                if (infoGroup) {
                  infoGroup.parentNode && infoGroup.parentNode.removeChild(infoGroup);
                }
                const actionsGroup = tbBox.querySelector('.jodit-ui-group_group_actions');
                if (actionsGroup) {
                  actionsGroup.classList.remove('jodit-ui-group_separated_true');
                  actionsGroup.style.borderRight = '0';
                  actionsGroup.style.marginRight = '0';
                  actionsGroup.style.paddingRight = '0';
                }
                // Remover controle "Insira o nome da classe" se presente
                try {
                  const classControls = tbBox.querySelectorAll('[aria-label="Insira o nome da classe"], [aria-label*="nome da classe"], [aria-label="Insert class name"], [aria-label*="class name"]');
                  classControls.forEach((el) => {
                    const grp = el.closest('.jodit-ui-group');
                    if (grp && grp.parentNode) grp.parentNode.removeChild(grp);
                    else if (el && el.parentNode) el.parentNode.removeChild(el);
                  });
                } catch (_) {}
              } catch (_) {}
            };
            fixToolbar();
            try {
              const moToolbar = new MutationObserver(() => fixToolbar());
              if (tbBox) moToolbar.observe(tbBox, { childList: true, subtree: true });
            } catch (_) {}
          } catch (_) {}

          const doc = editorInstance.editorDocument;
          if (doc && doc.body) {
            try { state.lastSavedHtml = doc.body.innerHTML || ''; } catch (_) {}
            try { updateSaveButtonsDisabled(); } catch (_) {}
            doc.body.addEventListener('dragover', function (e) { e.preventDefault(); });
            doc.body.addEventListener('drop', function (e) {
              e.preventDefault();
              const dt = e.dataTransfer;
              const files = dt && dt.files ? Array.from(dt.files) : [];
              // Se houver arquivos arrastados e forem imagens, inserir diretamente no editor
              if (files.length) {
                const imgFiles = files.filter(f => f && typeof f.type === 'string' && f.type.startsWith('image/'));
                if (imgFiles.length) {
                  try {
                    editorInstance.selection.focus();
                    imgFiles.forEach(file => {
                      const url = URL.createObjectURL(file);
                      const html = `<img src="${url}" alt="Imagem" style="max-width:100%;display:block;"/><br />`;
                      editorInstance.selection.insertHTML(html);
                    });
                    updateStatus('Imagem inserida via arrastar e soltar');
                    try { updateSaveButtonsDisabled(); } catch (_) {}
                  } catch (_) {}
                  return;
                }
              }

              const plain = (dt && dt.getData('text/plain')) || '';
              const uri = (dt && dt.getData('text/uri-list')) || '';
              const value = uri || plain;
              if (!value) return;
              // Tratar URLs relativas (/temp_uploads/...), além de blob:, data:, https:, file:
              const isUrlLike = /^(blob:|data:|https?:|file:|\/)/.test(value) || value.startsWith('/');
              const isImageName = /^[^\/\\]+?\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(value);

              if (isUrlLike) {
                try {
                  const html = `<img src="${value}" alt="Captura" style="max-width:100%;display:block;"/><br />`;
                  editorInstance.selection.focus();
                  editorInstance.selection.insertHTML(html);
                  updateStatus('Imagem inserida');
                  try { updateSaveButtonsDisabled(); } catch (_) {}
                } catch (_) {}
              } else if (isImageName) {
                try {
                  const ph = createImagePlaceholder(value);
                  const html = ph.outerHTML + '<br />';
                  editorInstance.selection.focus();
                  editorInstance.selection.insertHTML(html);
                  state.imagensPosicionadas.push(value);
                  updateImageCount();
                  updateStatus(`Imagem ${value} inserida`);
                  try { updateSaveButtonsDisabled(); } catch (_) {}
                } catch (_) {}
              } else {
                // Fallback: conteúdo não reconhecido como imagem; evitar placeholder quebrado
                try {
                  editorInstance.selection.focus();
                  editorInstance.selection.insertHTML(value);
                  updateStatus('Conteúdo arrastado como texto');
                  try { updateSaveButtonsDisabled(); } catch (_) {}
                } catch (_) {}
              }
            });

            // Remover quaisquer spans "Enter" que apareçam no conteúdo do iframe
            const scrubEnterIcons = () => {
              try {
                const spans = doc.body.querySelectorAll('span');
                spans.forEach(el => {
                  const text = (el.textContent || '').trim();
                  const cls = (el.className || '').toLowerCase();
                  if (text === 'Enter' || text === '↵' || cls.includes('enter')) {
                    try { el.remove(); } catch (_) { el.style.display = 'none'; }
                  }
                });
              } catch (_) {}
            };
            // Executa imediatamente e observa mutações futuras
            try { scrubEnterIcons(); } catch (_) {}
            try {
              const mo = new MutationObserver(() => scrubEnterIcons());
              mo.observe(doc.body, { childList: true, subtree: true });
            } catch (_) {}
          }
        } catch (e) {}
      },
      change: function () { try { saveCurrentSummaryHTMLDebounced(); } catch (e) {} try { updateSaveButtonsDisabled(); } catch (_) {} },
      paste: function (e) {
        try {
          // Somente tratar inserção de imagem quando a captura foi iniciada via botão
          const shouldHandleCapture = !!state.captureTriggeredByButton;
          const dt = e && (e.clipboardData || window.clipboardData);
          const items = dt && dt.items;
          let file = null;
          if (items && items.length) {
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              if (it && it.type && (it.type.startsWith('image/png') || it.type.startsWith('image/jpeg'))) {
                file = it.getAsFile();
                break;
              }
            }
          }

          if (shouldHandleCapture && file) {
            // Inserir imagem no editor e salvar na galeria (persistindo no backend)
            e.preventDefault();
            (async () => {
              const ts = Date.now();
              const suggestedName = `img_capture_${ts}.png`;
              try {
                const fd = new FormData();
                fd.append('file', file, suggestedName);
                fd.append('filename', suggestedName);
                const resp = await fetch('/api/upload-captured-image', { method: 'POST', body: fd });
                if (!resp.ok) throw new Error('Falha ao enviar captura ao servidor');
                const data = await resp.json();
                const filename = data && (data.filename || suggestedName);
                const serverUrl = (data && data.url) ? data.url : (`/temp_uploads/capturas_de_tela/${filename}`);
                const id = 'cap_' + ts + '_' + (state.capturedImages.length + 1);
                // Guardar somente referência à URL do servidor para reduzir memória
                state.capturedImages.push({ id, url: serverUrl, createdAt: ts });
                try { setGalleryMode('captures'); loadCaptureGallery(); } catch (_) {}
                try {
                  const editorInstance = state.joditEditor;
                  if (editorInstance && editorInstance.selection) {
                    editorInstance.selection.focus();
                    const html = `<img src="${serverUrl}" alt="Captura" style="max-width:100%;display:block;"/><br />`;
                    editorInstance.selection.insertHTML(html);
                  }
                } catch (_) {}
                updateStatus('Captura colada: persistida e inserida no editor');
                try { updateSaveButtonsDisabled(); } catch (_) {}
              } catch (uploadErr) {
                console.error('Falha ao persistir captura:', uploadErr);
                updateStatus('Falha ao persistir captura');
              }
              state.captureTriggeredByButton = false;
              try { saveCurrentSummaryHTMLDebounced(); } catch (_) {}
            })();
            return;
          }

          // Sem suporte à galeria de área de transferência: deixar o editor tratar colagens não relacionadas à captura

          // Fluxo padrão: não bloquear colagens que não são parte da captura
          try { saveCurrentSummaryHTMLDebounced(); } catch (_) {}
          try { updateSaveButtonsDisabled(); } catch (_) {}
        } catch (err) {
          try { saveCurrentSummaryHTMLDebounced(); } catch (_) {}
          try { updateSaveButtonsDisabled(); } catch (_) {}
        }
      },
      blur: function () { try { saveCurrentSummaryHTMLDebounced(); } catch (e) {} try { updateSaveButtonsDisabled(); } catch (_) {} }
    }
  });

  setJoditEditor(editor);
  try { markDocumentSavedBaseline(); } catch (_) {}
  // Ativar ajuste do min-width do iframe da modal de Preview
  try { initPreviewIframeMinWidthFix(); } catch (_) {}
}