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

export function structureSummary(summaryText) {
  return new Promise((resolve, reject) => {
    const wsProtocol = window.location.protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws/progress`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connection established for structuring summary.');
      socket.send(JSON.stringify({
        type: 'start_structuring',
        data: { text: summaryText }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'structured_summary') {
          console.log('Structured summary received.');
          resolve(message.data.normalized_text);
          socket.close();
        } else if (message.type === 'error') {
          console.error('Error from server:', message.data.error);
          reject(new Error(message.data.error));
          socket.close();
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
        // Em caso de erro de parsing, podemos rejeitar ou tentar um fallback
        reject(new Error('Failed to parse server response.'));
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      reject(new Error('WebSocket connection failed.'));
    };

    socket.onclose = (event) => {
      if (event.wasClean) {
        console.log(`WebSocket connection closed cleanly, code=${event.code}, reason=${event.reason}`);
      } else {
        // Ex: server process killed or network down
        console.error('WebSocket connection died');
        reject(new Error('WebSocket connection died unexpectedly.'));
      }
    };
  });
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