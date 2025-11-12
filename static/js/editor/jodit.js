import { state, setJoditEditor } from './state.js?v=8';
import { updateImageCount, debounce, updateImageCountFromDOM } from './utils.js?v=8';
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
    // Sanitizar antes de persistir: remover marcadores temporários do Jodit
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = htmlContent || '';
      tmp.querySelectorAll('span[data-jodit-temp="true"], span[data-jodit-selection_marker]').forEach((s) => { try { s.remove(); } catch (_) {} });
      htmlContent = tmp.innerHTML;
    } catch (_) {}
    await fetch('/api/save-structured-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '', html: htmlContent }),
      // Garantir persistência ao sair da página
      keepalive: origin === 'beforeunload'
    });
  } catch (err) {
    console.error('Falha ao salvar resumo estruturado:', err);
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
    language: 'pt',
    placeholder: 'Cole ou escreva seu texto aqui e use a Galeria no menu lateral para visualizar as imagens pré-carregadas do PDF, capture novas imagens no PDF através do menu superior - Capturar Imagem no PDF, ou ainda, adicione uma local via upload. Copie as imagens através do ícone disponibilizado na Galeria, ou clique duas vezes (mantenha pressionado) e arraste para inseri-las aqui...',
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
              // Garantir que o botão de imagem exiba o título "Enviar imagem"
              const setImageButtonTitle = () => {
                try {
                  if (!tbBox) return;
                  const imgBtn = tbBox.querySelector('.jodit-toolbar-button_image, .jodit-ui-button_image');
                  if (imgBtn) {
                    imgBtn.setAttribute('title', 'Enviar imagem');
                    imgBtn.setAttribute('aria-label', 'Enviar imagem');
                  }
                } catch (_) {}
              };
              setImageButtonTitle();
              const moToolbar = new MutationObserver(() => { fixToolbar(); setImageButtonTitle(); });
              if (tbBox) moToolbar.observe(tbBox, { childList: true, subtree: true });
            } catch (_) {}

            // Hook: o botão "Inserir imagem" da toolbar deve disparar o mesmo fluxo do btnUploadImages
            try {
              const hookUploadFromToolbar = () => {
                try {
                  const containerEl = editorInstance && editorInstance.container ? editorInstance.container : null;
                  const toolbarBox = containerEl ? containerEl.querySelector('.jodit-toolbar__box') : null;
                  if (!toolbarBox) return;
                  const attachOnceKey = '__rfai_image_upload_hook_attached';
                  if (toolbarBox[attachOnceKey]) return;
                  toolbarBox[attachOnceKey] = true;
                  toolbarBox.addEventListener('click', (evt) => {
                    try {
                      const target = evt.target;
                      const btn = target && (target.closest('[aria-label="Enviar imagem"], [title="Enviar imagem"], .jodit-toolbar-button_image, .jodit-ui-button_image'));
                      if (!btn) return;
                      evt.preventDefault();
                      evt.stopImmediatePropagation();
                      const inp = document.getElementById('inpUploadImages');
                      if (inp) inp.click();
                    } catch (_) {}
                  }, true);
                } catch (_) {}
              };
              // Executa imediatamente e observa mutações para reaplicar se a toolbar for recriada
              hookUploadFromToolbar();
              try {
                const moHook = new MutationObserver(() => hookUploadFromToolbar());
                if (tbBox) moHook.observe(tbBox, { childList: true, subtree: true });
              } catch (_) {}
            } catch (_) {}

            // Hook: o botão "Tela cheia" da toolbar deve disparar o mesmo fluxo do btnFullscreen
            try {
              const hookFullscreenFromToolbar = () => {
                try {
                  const containerEl = editorInstance && editorInstance.container ? editorInstance.container : null;
                  const toolbarBox = containerEl ? containerEl.querySelector('.jodit-toolbar__box') : null;
                  if (!toolbarBox) return;
                  const attachOnceKeyFs = '__rfai_fullscreen_hook_attached';
                  if (toolbarBox[attachOnceKeyFs]) return;
                  toolbarBox[attachOnceKeyFs] = true;
                  toolbarBox.addEventListener('click', (evt) => {
                    try {
                      const target = evt.target;
                      const btn = target && (target.closest('[aria-label*="tela cheia" i], [title*="tela cheia" i], [aria-label*="full" i], [title*="full" i], .jodit-toolbar-button_fullsize, .jodit-ui-button_fullsize'));
                      if (!btn) return;
                      evt.preventDefault();
                      evt.stopImmediatePropagation();
                      try { if (typeof window.toggleFullscreenMode === 'function') window.toggleFullscreenMode(); } catch (_) {}
                      try { if (typeof window.updateHeaderHeightVar === 'function') window.updateHeaderHeightVar(); } catch (_) {}
                      try { if (typeof window.updateGoTopVisibility === 'function') window.updateGoTopVisibility(); } catch (_) {}
                    } catch (_) {}
                  }, true);
                } catch (_) {}
              };
              // Executa imediatamente e observa mutações para reaplicar se a toolbar for recriada
              hookFullscreenFromToolbar();
              try {
                const moHookFs = new MutationObserver(() => hookFullscreenFromToolbar());
                if (tbBox) moHookFs.observe(tbBox, { childList: true, subtree: true });
              } catch (_) {}
            } catch (_) {}
          } catch (_) {}

          const doc = editorInstance.editorDocument;
          if (doc && doc.body) {
            // Limpar parágrafo de placeholder e marcadores temporários se existirem
            try {
              const isPlaceholderText = (txt) => {
                const norm = String(txt || '').replace(/\s+/g, ' ').trim().toLowerCase();
                return norm === 'resumo temporário para extração de imagens.' || /resumo\s+temporário.*extração de imagens\.?/i.test(txt || '');
              };
              // Remover spans temporários dentro do body, por segurança
              doc.body.querySelectorAll('span[data-jodit-temp="true"], span[data-jodit-selection_marker]').forEach((s) => {
                // Não remover indiscriminadamente durante edição; apenas ocultar se não for necessário
                try { s.style.display = 'none'; s.removeAttribute('aria-label'); } catch (_) {}
              });
              // Remover parágrafos que correspondam ao texto placeholder
              const ps = Array.from(doc.body.querySelectorAll('p'));
              ps.forEach((p) => {
                const t = (p.textContent || '').trim();
                if (isPlaceholderText(t)) {
                  try { p.remove(); } catch (_) { p.innerHTML = ''; }
                }
              });
              // Se o container original fora do iframe tiver esse placeholder, limpar também
              try {
                const hostEl = document.getElementById('structuredSummary');
                if (hostEl) {
                  hostEl.querySelectorAll('span[data-jodit-temp="true"], span[data-jodit-selection_marker]').forEach((s) => { try { s.remove(); } catch (_) {} });
                  hostEl.querySelectorAll('p').forEach((p) => {
                    const tx = (p.textContent || '').trim();
                    if (isPlaceholderText(tx)) { try { p.remove(); } catch (_) { p.innerHTML = ''; } }
                  });
                }
              } catch (_) {}
            } catch (_) {}
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
                  try { updateImageCountFromDOM(); } catch (_) {}
                  try { updateSaveButtonsDisabled(); } catch (_) {}
                } catch (_) {}
              } else if (isImageName) {
                try {
                  const ph = createImagePlaceholder(value);
                  const html = ph.outerHTML + '<br />';
                  editorInstance.selection.focus();
                  editorInstance.selection.insertHTML(html);
                  state.imagensPosicionadas.push(value);
                  try { updateImageCountFromDOM(); } catch (_) {}
                  try { updateSaveButtonsDisabled(); } catch (_) {}
                } catch (_) {}
              } else {
                // Fallback: conteúdo não reconhecido como imagem; evitar placeholder quebrado
                try {
                  editorInstance.selection.focus();
                  editorInstance.selection.insertHTML(value);
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
              const mo = new MutationObserver(() => { try { scrubEnterIcons(); } catch (_) {} try { updateImageCountFromDOM(); } catch (_) {} });
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
                    try { updateImageCountFromDOM(); } catch (_) {}
                  }
                } catch (_) {}
                try { updateSaveButtonsDisabled(); } catch (_) {}
              } catch (uploadErr) {
                console.error('Falha ao persistir captura:', uploadErr);
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