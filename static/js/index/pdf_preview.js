import { uploadPdf } from './api.js';

// PDF preview logic using pdf.js; attaches change handler to input
export function initPdfPreviewHandlers({ $pdfInput, $pdfPreviewSection, $pdfPreviewContainer, $pdfPreviewTitle }) {
  let pdfDoc = null;
  let totalPages = 0;
  let isRendering = false;

  function hidePdfPreview() {
    $pdfPreviewTitle.text('Prévia do PDF Selecionado');
    $pdfPreviewSection.hide();
  }

  function renderPage(pageNum) {
    return pdfDoc.getPage(pageNum).then(function (page) {
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.className = 'pdf-page-canvas';

      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.id = `pdf-page-${pageNum}`;

      const pageNumberDiv = document.createElement('div');
      pageNumberDiv.className = 'pdf-page-number';
      pageNumberDiv.textContent = `Página ${pageNum}`;

      pageDiv.appendChild(canvas);
      pageDiv.appendChild(pageNumberDiv);

      const renderContext = { canvasContext: context, viewport };
      return page.render(renderContext).promise.then(() => ({ pageNum, pageDiv }));
    });
  }

  function renderAllPages() {
    if (isRendering) return;
    isRendering = true;

    $pdfPreviewContainer.html(`
      <div class="pdf-loading">
        <div class="pdf-loading-spinner"></div>
        <p style="color: #007bff; font-weight: 600; font-size: 1em;">Renderizando páginas...</p>
      </div>
    `);

    setTimeout(() => {
      const renderPromises = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        renderPromises.push(renderPage(pageNum));
      }
      Promise.all(renderPromises)
        .then(pageResults => {
          const container = document.getElementById('pdfPreviewContainer');
          if (container) {
            container.innerHTML = '';
            pageResults
              .sort((a, b) => a.pageNum - b.pageNum)
              .forEach(({ pageDiv }) => container.appendChild(pageDiv));
          }
          isRendering = false;
        })
        .catch(error => {
          console.error('Erro ao renderizar páginas:', error);
          $pdfPreviewContainer.html(`
            <div class="pdf-error">
              <p>Erro ao renderizar as páginas do PDF.</p>
            </div>
          `);
          isRendering = false;
        });
    }, 3000);
  }

  function showPdfPreview(file) {
    $pdfPreviewTitle.text(`Prévia do PDF: ${file.name}`);
    $pdfPreviewSection.show();
    $pdfPreviewContainer.html(`
      <div class="pdf-loading">
        <div class="pdf-loading-spinner"></div>
        <p>Carregando PDF...</p>
      </div>
    `);

    // Configure pdf.js worker
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const typedArray = new Uint8Array(e.target.result);
      window.pdfjsLib.getDocument(typedArray).promise
        .then(function (pdf) {
          pdfDoc = pdf;
          totalPages = pdf.numPages;
          renderAllPages();
        })
        .catch(function (error) {
          console.error('Erro ao carregar PDF:', error);
          $pdfPreviewContainer.html(`
            <div class="pdf-error">
              <p>Erro ao carregar o PDF: ${error.message}</p>
              <p>Verifique se o arquivo é um PDF válido.</p>
            </div>
          `);
        });
    };
    reader.readAsArrayBuffer(file);
  }

  // Bind change event on input
  $pdfInput.on('change', function (e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      try { localStorage.setItem('selectedPdfName', file.name); } catch (_) {}
      uploadPdf(file).catch(err => console.error('Erro no upload do PDF:', err));
      showPdfPreview(file);
    } else {
      hidePdfPreview();
    }
  });
}