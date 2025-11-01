// Word count display binding for the IA summary textarea
export function attachWordCount($iaSummaryText, $wordCountDisplay) {
  function updateWordCountDisplay() {
    const text = $iaSummaryText.val();
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    $wordCountDisplay.text(`Quantidade de palavras inseridas: ${wordCount}`);
  }

  // Initialize
  updateWordCountDisplay();
  // Live updates
  $iaSummaryText.on('input', updateWordCountDisplay);

  return {
    getWordCount: () => {
      const text = $iaSummaryText.val();
      return text.split(/\s+/).filter(word => word.length > 0).length;
    }
  };
}