import { attachWordCount } from './wordcount.js';
import { initPdfPreviewHandlers } from './pdf_preview.js';
import { setupSubmitFlow } from './summary_structuring.js';

document.addEventListener('DOMContentLoaded', () => {
  const $form = $('#uploadForm');
  const $submitButton = $('#submitButton');
  const $loadingArea = $('#loadingArea');
  const $resultArea = $('#resultArea');
  const $structuredSummary = $('#structuredSummary');
  const $wordCountDisplay = $('#wordCountDisplay');
  const $iaSummaryText = $('#iaSummaryText');
  const $pdfPreviewSection = $('#pdfPreviewSection');
  const $pdfPreviewContainer = $('#pdfPreviewContainer');
  const $pdfPreviewTitle = $('#pdfPreviewTitle');
  const $textareaLoadingContainer = $('#textareaLoadingContainer');
  const $textareaLoadingOverlay = $('#textareaLoadingOverlay');

  const originalSubmitButtonText = $submitButton.text();
  const newButtonText = 'TIRAR PRINTS E POSICIONAR IMAGENS USANDO O EDITOR';

  // Word count binding
  attachWordCount($iaSummaryText, $wordCountDisplay);

  // PDF preview binding
  initPdfPreviewHandlers({
    $pdfInput: $('#originalPdf'),
    $pdfPreviewSection,
    $pdfPreviewContainer,
    $pdfPreviewTitle
  });

  // Submit flow
  setupSubmitFlow({
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
    threshold: 600
  });
});