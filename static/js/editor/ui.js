export function isEditorFullscreenActive() {
  const container = document.querySelector('.container');
  const editorSection = document.getElementById('editorSection');
  const editorVisible = !!editorSection && window.getComputedStyle(editorSection).display !== 'none';
  return !!(container && container.classList.contains('fullscreen-mode') && editorVisible);
}

export function updateGoTopVisibility() {
  const goToTopBtn = document.getElementById('goToTopBtn');
  if (!goToTopBtn) return;
  if (!isEditorFullscreenActive()) {
    goToTopBtn.style.display = 'none';
    return;
  }
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight);
  const winHeight = window.innerHeight || document.documentElement.clientHeight;
  const scrollable = docHeight - winHeight;
  const ratio = scrollable > 0 ? scrollTop / scrollable : 0;
  goToTopBtn.style.display = ratio > 0.1 ? 'block' : 'none';
}

export function initGoToTop() {
  const goToTopBtn = document.getElementById('goToTopBtn');
  if (goToTopBtn) {
    goToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      goToTopBtn.style.display = 'none';
    });
  }
  window.addEventListener('scroll', updateGoTopVisibility);
  updateGoTopVisibility();
}

export function updateHeaderHeightVar() {
  const container = document.querySelector('.container');
  const isFullscreen = container && container.classList.contains('fullscreen-mode');
  const header = document.querySelector('.editor-header');
  const headerVisible = !isFullscreen && header && window.getComputedStyle(header).display !== 'none';
  const h = headerVisible ? header.offsetHeight : 0;
  document.documentElement.style.setProperty('--header-height', h + 'px');
}

export function initHeaderHeightSync() {
  window.addEventListener('resize', updateHeaderHeightVar);
  setTimeout(updateHeaderHeightVar, 0);
}