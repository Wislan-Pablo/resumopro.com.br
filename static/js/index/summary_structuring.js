import { structureSummary, saveStructuredSummary, processamentoFull } from './api.js';

export function setupSubmitFlow({
  $form,
  $submitButton,
  $iaSummaryText,
  $loadingArea,
  $resultArea,
  $structuredSummary,
  $wordCountDisplay,
  $textareaLoadingContainer,
  $textareaLoadingOverlay,
  originalSubmitButtonText,
  newButtonText,
  threshold = 600
}) {
  // Disable native form submit; control via button
  $form.off('submit');

  $submitButton.on('click', async function (e) {
    e.preventDefault();

    if ($submitButton.text() !== originalSubmitButtonText) return;

    const iaSummaryText = $iaSummaryText.val();
    const wordCount = iaSummaryText.split(/\s+/).filter(word => word.length > 0).length;
    $wordCountDisplay.text(`Palavras inseridas: ${wordCount}`).removeClass('word-count-red').removeClass('word-count-green');

    if (wordCount < threshold) {
      $wordCountDisplay.addClass('word-count-red');
      alert(`A quantidade de palavras do resumo deve ser maior que ${threshold}.\nQuantidade atual: ${wordCount} palavras.`);
      return;
    } else {
      $wordCountDisplay.addClass('word-count-green');
    }

    // 1. Show textarea loading overlay for 4 seconds
    $textareaLoadingContainer.css('display', 'block');
    $textareaLoadingOverlay.show();
    $submitButton.prop('disabled', true).text('ESTRUTURANDO...');

    setTimeout(async () => {
      // Hide overlay
      $textareaLoadingOverlay.hide();
      $textareaLoadingContainer.css('display', 'none');

      // Hide textarea; show loading area
      $iaSummaryText.hide();
      $loadingArea.show();
      $resultArea.hide();

      try {
        const structuredMarkdown = await structureSummary(iaSummaryText);
        const htmlContent = window.marked.parse(structuredMarkdown, {
          breaks: true,
          gfm: true,
          tables: true,
          pedantic: false,
          sanitize: false,
          smartLists: true,
          smartypants: false
        });

        try { await saveStructuredSummary(structuredMarkdown, htmlContent); } catch (e) { console.error('Erro ao salvar resumo estruturado:', e); }

        // Show result
        $loadingArea.hide();
        $structuredSummary.html(htmlContent);
        $resultArea.show();

        // Update button
        $submitButton.prop('disabled', false).text(newButtonText);

        // Rebind click to start full processing and redirect
        $submitButton.off('click').on('click', function (evt) {
          evt.preventDefault();
          const originalPdfInput = document.getElementById('originalPdf');
          const originalPdfFile = originalPdfInput && originalPdfInput.files && originalPdfInput.files[0];
          processamentoFull(originalPdfFile, iaSummaryText)
            .catch(() => { /* Ignorar falhas e seguir com redirecionamento */ })
            .finally(() => { window.location.href = '/static/editor.html'; });
        });

      } catch (error) {
        console.error('Erro ao estruturar resumo:', error);
        alert('Erro ao estruturar o resumo. Tente novamente.');
        $loadingArea.hide();
        $iaSummaryText.show();
        $submitButton.prop('disabled', false).text(originalSubmitButtonText);
      }
    }, 4000);
  });
}