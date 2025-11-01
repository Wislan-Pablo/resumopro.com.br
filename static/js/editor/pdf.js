import { state } from './state.js';
import { updateStatus } from './utils.js';

export async function generateFinalPDF() {
  try {
    updateStatus('Gerando PDF final...');
    const resumoHtml = (state.joditEditor && state.joditEditor.editorDocument && state.joditEditor.editorDocument.body)
      ? state.joditEditor.editorDocument.body.innerHTML
      : (document.getElementById('structuredSummary')?.innerHTML || '');
    const finalStructure = {
      resumo_text: resumoHtml,
      imagens_posicionadas: state.imagensPosicionadas,
      upload_dir: state.estruturaEdicao ? state.estruturaEdicao.upload_dir : undefined
    };

    const response = await fetch('/api/generate-final-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalStructure)
    });
    if (!response.ok) throw new Error('Erro ao gerar PDF');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    try {
      const opened = window.open(url, '_blank');
      if (!opened) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    }
    updateStatus('PDF gerado com sucesso!');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    updateStatus('Erro ao gerar PDF');
  }
}

try { window.generateFinalPDF = generateFinalPDF; } catch (_) {}