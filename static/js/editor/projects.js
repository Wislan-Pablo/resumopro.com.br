import { state } from './state.js';
import { markDocumentSavedBaseline } from './jodit.js';
import { updateStatus, updateImageCount, setCurrentPdfLabel } from './utils.js';

export function openProjectSaveModal() {
  const modal = document.getElementById('projectSaveModal');
  if (modal) modal.classList.add('active');
  const input = document.getElementById('projectNameInput');
  if (input) {
    input.value = '';
    input.focus();
  }
}

export function closeProjectSaveModal() {
  const modal = document.getElementById('projectSaveModal');
  if (modal) modal.classList.remove('active');
}

export function openSavedStatesModal() {
  // Pré-preenche o conteúdo com um estado de carregamento antes de exibir a modal
  const listEl = document.getElementById('savedStatesList');
  if (listEl) listEl.innerHTML = '<p>Carregando projetos...</p>';
  const modal = document.getElementById('savedStatesModal');
  if (modal) modal.classList.add('active');
  loadSavedStates();
}

export function closeSavedStatesModal() {
  const modal = document.getElementById('savedStatesModal');
  if (modal) modal.classList.remove('active');
}

export function showSuccessModal(message) {
  const modal = document.getElementById('successModal');
  const msgEl = document.getElementById('successMessage');
  if (msgEl) msgEl.textContent = message || 'Operação concluída com sucesso.';
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => { closeSuccessModal(); }, 3000);
  }
}

export function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) modal.classList.remove('active');
}

export function setCurrentProject(slug, name) {
  try {
    localStorage.setItem('currentProjectSlug', slug || '');
    localStorage.setItem('currentProjectName', name || '');
  } catch (e) {}
}

export function getCurrentProject() {
  try {
    const slug = localStorage.getItem('currentProjectSlug');
    const name = localStorage.getItem('currentProjectName');
    if (slug) return { slug, name };
  } catch (e) {}
  return null;
}

export function clearCurrentProject() {
  try {
    localStorage.removeItem('currentProjectSlug');
    localStorage.removeItem('currentProjectName');
  } catch (e) {}
}

export function slugifyProjectName(name) {
  try {
    const base = String(name || '').toLowerCase().trim()
      .replace(/[\s/\\]+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 64);
    return base || ('projeto-' + Date.now());
  } catch (e) {
    return 'projeto-' + Date.now();
  }
}

export async function uploadProjectImage(slug, blob, preferredName) {
  const fd = new FormData();
  fd.append('project', slug);
  const fname = preferredName || ('capture_' + Date.now() + '.png');
  fd.append('file', blob, fname);
  const resp = await fetch('/api/editor-state/save-image', { method: 'POST', body: fd });
  if (!resp.ok) throw new Error('Falha ao enviar imagem do projeto');
  return resp.json();
}

export async function prepareHtmlForProjectSave(slug) {
  // Clona o HTML atual do editor para processamento
  const root = (state.joditEditor && state.joditEditor.editorDocument && state.joditEditor.editorDocument.body)
    ? state.joditEditor.editorDocument.body
    : document.getElementById('structuredSummary');
  const container = document.createElement('div');
  container.innerHTML = root ? root.innerHTML : '';

  const imgs = Array.from(container.querySelectorAll('img'));
  const galleryImagesToCopy = [];
  let uploadIndex = 0;
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (!src) continue;
    // Imagens da galeria (persistentes): copiar para pasta do projeto
    if (src.startsWith('/temp_uploads/imagens_extraidas/')) {
      const base = src.split('/').pop().split('?')[0];
      if (base) {
        galleryImagesToCopy.push(base);
        img.setAttribute('src', `/temp_uploads/editor_states/${slug}/images/${base}`);
      }
      continue;
    }
    // Imagens blob/data: enviar para servidor
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      try {
        const r = await fetch(src);
        const b = await r.blob();
        const name = `capture_${Date.now()}_${++uploadIndex}.png`;
        const up = await uploadProjectImage(slug, b, name);
        if (up && up.path) img.setAttribute('src', up.path);
      } catch (e) {
        console.warn('Falha ao persistir imagem blob/data:', e);
      }
    }
  }

  return { html: container.innerHTML, galleryImages: galleryImagesToCopy };
}

export async function saveProjectState() {
  try {
    const input = document.getElementById('projectNameInput');
    const projectName = input ? input.value.trim() : '';
    if (!projectName) {
      updateStatus('Informe um nome para o projeto');
      return;
    }
    const slug = slugifyProjectName(projectName);
    updateStatus('Preparando imagens e conteúdo para salvar...');
    const prepared = await prepareHtmlForProjectSave(slug);
    const pdfName = (() => {
      try { const s = localStorage.getItem('selectedPdfName'); if (s) return s; } catch (e) {}
      return state.estruturaEdicao && state.estruturaEdicao.pdf_name ? state.estruturaEdicao.pdf_name : null;
    })();

    const payload = { name: projectName, html: prepared.html, pdf_name: pdfName, gallery_images: prepared.galleryImages };
    const resp = await fetch('/api/editor-state/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Falha ao salvar projeto');
    const data = await resp.json();
    updateStatus('Projeto salvo com sucesso');
    setCurrentProject(data.slug || slug, projectName);
    showSuccessModal('Projeto salvo com sucesso');
    closeProjectSaveModal();
    try { markDocumentSavedBaseline(); } catch (e) {}
  } catch (err) {
    console.error(err);
    updateStatus('Erro ao salvar projeto');
  }
}

export async function saveProjectStateImmediate(current) {
  try {
    const name = current && current.name ? current.name : '';
    const slug = current && current.slug ? current.slug : slugifyProjectName(name || ('projeto-' + Date.now()));
    updateStatus('Preparando imagens e conteúdo para salvar...');
    const prepared = await prepareHtmlForProjectSave(slug);
    const pdfName = (() => {
      try { const s = localStorage.getItem('selectedPdfName'); if (s) return s; } catch (e) {}
      return state.estruturaEdicao && state.estruturaEdicao.pdf_name ? state.estruturaEdicao.pdf_name : null;
    })();
    const payload = { name: name || slug, html: prepared.html, pdf_name: pdfName, gallery_images: prepared.galleryImages };
    const resp = await fetch('/api/editor-state/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Falha ao salvar projeto');
    const data = await resp.json();
    setCurrentProject(data.slug || slug, name || slug);
    updateStatus('Projeto salvo com sucesso');
    showSuccessModal('Projeto salvo com sucesso');
    try { markDocumentSavedBaseline(); } catch (e) {}
  } catch (err) {
    console.error(err);
    updateStatus('Erro ao salvar projeto');
  }
}

export async function loadSavedStates() {
  try {
    const listEl = document.getElementById('savedStatesList');
    if (!listEl) return;
    listEl.innerHTML = '<p>Carregando projetos...</p>';
    const resp = await fetch('/api/editor-state/list');
    if (!resp.ok) throw new Error('Falha ao listar projetos');
    const data = await resp.json();
    renderSavedStates(Array.isArray(data.items) ? data.items : []);
  } catch (e) {
    const listEl = document.getElementById('savedStatesList');
    if (listEl) listEl.innerHTML = '<p>Não foi possível carregar a lista.</p>';
  }
}

export function renderSavedStates(items) {
  const listEl = document.getElementById('savedStatesList');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!items.length) {
    listEl.innerHTML = '<p class="saved-states-empty">Você não tem nenhum Projeto Salvo ainda. Use o <strong>Editor</strong> para começar uma nova edição de texto e depois clique no botão "<strong>Salvar Projeto</strong>" no menu superior.</p>';
    return;
  }
  for (const it of items) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.gap = '14px';
    row.style.width = '100%';
    row.style.padding = '8px 0';
    const left = document.createElement('div');
    left.style.flex = '1';
    const dt = it.saved_at ? new Date(it.saved_at) : null;
    const dtStr = dt ? dt.toLocaleString() : '';
    left.innerHTML = `<strong>${it.name || it.slug}</strong>${dtStr ? ' • ' + dtStr : ''}${it.pdf_name ? ' • ' + it.pdf_name : ''}`;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    const btnCont = document.createElement('button');
    btnCont.className = 'btn btn-secondary';
    btnCont.innerHTML = '<img src="/images/editor_resumo.svg" alt="Continuar" class="btn-icon-small" /> <span>CONTINUAR</span>';
    btnCont.style.padding = '4px 8px';
    btnCont.title = 'Recuperar a edição e continuar de onde você parou';
    btnCont.addEventListener('click', () => continueEditingState(it.slug));
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.innerHTML = '<img src="/images/delete_all_items.svg" alt="Excluir" class="btn-icon-small" /> <span>EXCLUIR</span>';
    btnDel.title = 'Excluir este Projeto/Resumo';
    btnDel.style.padding = '4px 8px';
    btnDel.addEventListener('click', () => deleteSavedState(it.slug));
    actions.appendChild(btnCont);
    actions.appendChild(btnDel);
    row.appendChild(left);
    row.appendChild(actions);
    listEl.appendChild(row);
  }
}

function rebuildImagensPosicionadasFromDOM() {
  try {
    const root = (state.joditEditor && state.joditEditor.editorDocument && state.joditEditor.editorDocument.body)
      ? state.joditEditor.editorDocument.body
      : document.getElementById('structuredSummary');
    const placeholders = root ? root.querySelectorAll('.image-placeholder') : [];
    state.imagensPosicionadas = Array.from(placeholders)
      .map(ph => ph && ph.dataset ? ph.dataset.imageName : null)
      .filter(Boolean);
    updateImageCount();
  } catch (e) {}
}

export async function continueEditingState(slug) {
  try {
    const resp = await fetch('/api/editor-state/' + encodeURIComponent(slug));
    if (!resp.ok) throw new Error('Falha ao carregar projeto salvo');
    const data = await resp.json();
    const html = data && data.html ? data.html : '';
    if (state.joditEditor) {
      try { state.joditEditor.value = html; } catch (e) {}
      try {
        if (state.joditEditor.editorDocument && state.joditEditor.editorDocument.body) {
          state.joditEditor.editorDocument.body.innerHTML = html;
        }
      } catch (e) {}
    } else {
      const el = document.getElementById('structuredSummary');
      if (el) el.innerHTML = html;
    }
    try { rebuildImagensPosicionadasFromDOM(); } catch (e) {}
    const pdfName = data && data.meta && data.meta.pdf_name ? data.meta.pdf_name : null;
    if (pdfName) {
      try { localStorage.setItem('selectedPdfName', pdfName); } catch (e) {}
      setCurrentPdfLabel(pdfName);
    }
    const projName = data && data.meta && data.meta.name ? data.meta.name : slug;
    setCurrentProject(slug, projName);
    updateStatus('Projeto carregado');
    showSuccessModal('Projeto carregado com sucesso');
    closeSavedStatesModal();
    try { markDocumentSavedBaseline(); } catch (e) {}
  } catch (e) {
    console.error(e);
    updateStatus('Erro ao carregar projeto salvo');
  }
}

export async function deleteSavedState(slug) {
  try {
    if (!slug) return;
    const ok = window.confirm('Tem certeza que deseja excluir este projeto?');
    if (!ok) return;
    const resp = await fetch('/api/editor-state/' + encodeURIComponent(slug), { method: 'DELETE' });
    if (!resp.ok) throw new Error('Falha ao excluir projeto');
    updateStatus('Projeto excluído');
    const current = getCurrentProject();
    if (current && current.slug === slug) clearCurrentProject();
    showSuccessModal('Projeto excluído com sucesso');
    try {
      const listResp = await fetch('/api/editor-state/list');
      if (listResp.ok) {
        const data = await listResp.json();
        const count = (typeof data.count === 'number') ? data.count : (Array.isArray(data.items) ? data.items.length : 0);
        if (count === 0) {
          closeSavedStatesModal();
        } else {
          loadSavedStates();
        }
      } else {
        loadSavedStates();
      }
    } catch (e) {
      loadSavedStates();
    }
  } catch (e) {
    console.error(e);
    updateStatus('Erro ao excluir projeto');
  }
}