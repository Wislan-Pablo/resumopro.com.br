// Jodit PT-BR locale (parcial). Complementa com inglês para chaves faltantes.
(function (Jodit) {
  try {
    Jodit.lang = Jodit.lang || {};
    var en = (Jodit.lang && Jodit.lang.en) ? Jodit.lang.en : {};
    Jodit.lang.pt_br = Object.assign({}, en, {
      'Bold': 'Negrito',
      'Italic': 'Itálico',
      'Underline': 'Sublinhado',
      'Strike through': 'Tachado',
      'Insert image': 'Enviar imagem',
      'Insert file': 'Enviar arquivo',
      'Add link': 'Adicionar link',
      'Remove link': 'Remover link',
      'Table': 'Tabela',
      'Insert table': 'Inserir tabela',
      'Source code': 'Código fonte',
      'Undo': 'Desfazer',
      'Redo': 'Refazer',
      'Copy': 'Copiar',
      'Cut': 'Recortar',
      'Paste': 'Colar',
      'Delete': 'Excluir',
      'Align': 'Alinhar',
      'Left': 'Esquerda',
      'Center': 'Centro',
      'Right': 'Direita',
      'Justify': 'Justificar',
      'Font size': 'Tamanho da fonte',
      'Font': 'Fonte',
      'Image': 'Imagem',
      'Video': 'Vídeo',
      'Open file manager': 'Abrir gerenciador de arquivos',
      'About Jodit': 'Sobre o Jodit'
    });
  } catch (e) {
    // Silently ignore
  }
})(window.Jodit);