import { state, setJoditEditor } from './state.js';
import { updateStatus, updateImageCount, debounce } from './utils.js';
import { createImagePlaceholder } from './gallery.js';

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
    iframe: true,
    height: 500,
    toolbarButtonSize: 'small',
    iframeCSSLinks: [
      'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap'
    ],
    iframeStyle: `
      body.jodit-wysiwyg { font-family: 'Noto Sans', Arial, sans-serif; color:#222; line-height:1.5; }
      img { max-width: 100%; height: auto; }
      h1 { font-size: 1.4em; }
      h2 { font-size: 1.2em; }
      h3 { font-size: 1.1em; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #444; text-align: center; }
      thead tr, th { background-color: #cfe0ff; }
    `,
    events: {
      afterInit: function (editorInstance) {
        try {
          const doc = editorInstance.editorDocument;
          if (doc && doc.body) {
            doc.body.addEventListener('dragover', function (e) { e.preventDefault(); });
            doc.body.addEventListener('drop', function (e) {
              e.preventDefault();
              const plain = e.dataTransfer && e.dataTransfer.getData('text/plain');
              const uri = e.dataTransfer && e.dataTransfer.getData('text/uri-list');
              const value = uri || plain || '';
              if (!value) return;
              if (/^(blob:|data:|https?:)/.test(value)) {
                const html = `<img src="${value}" alt="Captura" style="max-width:100%;display:block;"/><br />`;
                editorInstance.selection.focus();
                editorInstance.selection.insertHTML(html);
                updateStatus('Imagem de captura inserida');
              } else {
                const ph = createImagePlaceholder(value);
                const html = ph.outerHTML + '<br />';
                editorInstance.selection.focus();
                editorInstance.selection.insertHTML(html);
                state.imagensPosicionadas.push(value);
                updateImageCount();
                updateStatus(`Imagem ${value} inserida`);
              }
            });
          }
        } catch (e) {}
      },
      change: function () { try { saveCurrentSummaryHTMLDebounced(); } catch (e) {} },
      paste: function () { try { saveCurrentSummaryHTMLDebounced(); } catch (e) {} },
      blur: function () { try { saveCurrentSummaryHTMLDebounced(); } catch (e) {} }
    }
  });

  setJoditEditor(editor);
}