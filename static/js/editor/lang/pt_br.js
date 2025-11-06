// Tradução local mínima para Jodit (PT-BR)
// Objetivo: evitar bloqueios de CDN/ORB mantendo o idioma pt_br reconhecido.
(function () {
  try {
    var J = window && window.Jodit;
    if (!J) return;
    J.lang = J.lang || {};
    // Basear no português se existir, senão cair para inglês
    var base = (J.lang.pt || J.lang.en || {});
    // Definições mínimas comuns; Jodit usará base para chaves ausentes
    J.lang.pt_br = Object.assign({}, base, {
      'Fullsize': 'Tela cheia',
      'Preview': 'Pré-visualização',
      'Bold': 'Negrito',
      'Italic': 'Itálico',
      'Underline': 'Sublinhado',
      'Image': 'Imagem',
      'Insert Image': 'Inserir imagem',
      'Upload': 'Enviar',
      'Cancel': 'Cancelar',
      'Ok': 'OK'
    });
  } catch (e) {
    // Silencioso
  }
})();