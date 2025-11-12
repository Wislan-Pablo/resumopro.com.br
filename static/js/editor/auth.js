// Front-end auth flow: login/signup modal and state handling
const overlay = document.getElementById('authModalOverlay');
const emailEl = document.getElementById('authEmail');
const passwordEl = document.getElementById('authPassword');
const nameEl = document.getElementById('authName');
const errorEl = document.getElementById('authError');
const submitEl = document.getElementById('authSubmit');
const cancelEl = document.getElementById('authCancel');
const switchEl = document.getElementById('authSwitchMode');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

let mode = 'login'; // or 'signup'

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || '';
  errorEl.style.display = msg ? '' : 'none';
}

function openModal() {
  if (!overlay) return;
  overlay.style.display = 'flex';
  showError('');
  submitEl.textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
  document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
  nameEl.style.display = mode === 'signup' ? '' : 'none';
}

function closeModal() {
  if (!overlay) return;
  overlay.style.display = 'none';
}

async function checkAuth() {
  try {
    const res = await fetch('/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = '';
      return true;
    }
  } catch (_) {}
  if (btnLogin) btnLogin.style.display = '';
  if (btnLogout) btnLogout.style.display = 'none';
  return false;
}

async function doSignup(email, password, name) {
  const fd = new FormData();
  fd.append('email', email);
  fd.append('password', password);
  if (name) fd.append('name', name);
  const res = await fetch('/auth/signup', { method: 'POST', body: fd, credentials: 'include' });
  if (!res.ok) throw new Error('Falha no cadastro');
}

async function doLogin(email, password) {
  const fd = new FormData();
  fd.append('email', email);
  fd.append('password', password);
  const res = await fetch('/auth/login', { method: 'POST', body: fd, credentials: 'include' });
  if (!res.ok) throw new Error('Falha no login');
}

async function doLogout() {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (_) {}
}

function bindEvents() {
  if (btnLogin) {
    btnLogin.addEventListener('click', () => { mode = 'login'; openModal(); });
  }
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try { await doLogout(); } catch (_) {}
      await checkAuth();
    });
  }
  if (cancelEl) {
    cancelEl.addEventListener('click', () => closeModal());
  }
  if (switchEl) {
    switchEl.addEventListener('click', () => {
      mode = (mode === 'login') ? 'signup' : 'login';
      switchEl.textContent = mode === 'login' ? 'Cadastrar' : 'Entrar';
      openModal();
    });
  }
  if (submitEl) {
    submitEl.addEventListener('click', async () => {
      const email = (emailEl && emailEl.value || '').trim();
      const password = (passwordEl && passwordEl.value || '').trim();
      const name = (nameEl && nameEl.value || '').trim();
      if (!email || !password) { showError('Informe email e senha.'); return; }
      try {
        showError('');
        if (mode === 'signup') {
          await doSignup(email, password, name);
          await doLogin(email, password);
        } else {
          await doLogin(email, password);
        }
        closeModal();
        await checkAuth();
      } catch (e) {
        showError(e.message || 'Falha na autenticação');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  const authenticated = await checkAuth();
  if (!authenticated) {
    // Opcional: abrir modal automaticamente na primeira visita
    // openModal();
  }
});