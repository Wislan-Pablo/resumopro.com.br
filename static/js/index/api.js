// API helpers for index.html functionality
export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('originalPdf', file);
  const resp = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
  if (!resp.ok) throw new Error('Falha no upload do PDF');
  const data = await resp.json();
  if (data && data.filename) {
    try { localStorage.setItem('selectedPdfName', data.filename); } catch (_) {}
  }
  return data;
}

export async function structureSummary(summaryText) {
  try {
    const response = await fetch('/api/normalize-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: summaryText })
    });
    if (!response.ok) throw new Error('Erro na normalização do texto');
    const data = await response.json();
    return data.normalized_text;
  } catch (error) {
    console.error('Erro ao normalizar texto:', error);
    return summaryText; // fallback
  }
}

export async function saveStructuredSummary(markdownContent, htmlContent) {
  const response = await fetch('/api/save-structured-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: markdownContent, html: htmlContent })
  });
  if (!response.ok) throw new Error('Erro ao salvar resumo estruturado');
  return response.json();
}

export async function processamentoFull(originalPdfFile, iaSummaryText) {
  const fd = new FormData();
  if (originalPdfFile) fd.append('originalPdf', originalPdfFile);
  fd.append('iaSummaryText', iaSummaryText);
  // Best-effort request; errors are handled by caller
  return fetch('/api/processamento-full', { method: 'POST', body: fd });
}