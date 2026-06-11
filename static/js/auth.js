// ─── SHARED UTILITIES ────────────────────────────────────────────────────────
const API = '';

function getToken() { return localStorage.getItem('ev_token'); }
function setToken(t) { localStorage.setItem('ev_token', t); }
function clearToken() { localStorage.removeItem('ev_token'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function logout() {
  clearToken();
  window.location.href = '/';
}

function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.innerHTML = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// ─── AUTH TABS ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabL = document.getElementById('tabLogin');
  const tabR = document.getElementById('tabRegister');
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabL.classList.add('active');
    tabR.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabL.classList.remove('active');
    tabR.classList.add('active');
  }
  document.getElementById('authAlert').classList.add('hidden');
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value,
        senha: document.getElementById('loginSenha').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no login');
    setToken(data.token);
    window.location.href = '/dashboard';
  } catch (err) {
    showAlert('authAlert', 'error', '❌ ' + err.message);
    btn.disabled = false;
    btn.innerHTML = 'Entrar';
  }
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btnRegister');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Criando conta...';
  try {
    const res = await fetch(`${API}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: document.getElementById('regNome').value,
        email: document.getElementById('regEmail').value,
        senha: document.getElementById('regSenha').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no cadastro');
    setToken(data.token);
    window.location.href = '/dashboard';
  } catch (err) {
    showAlert('authAlert', 'error', '❌ ' + err.message);
    btn.disabled = false;
    btn.innerHTML = 'Criar Conta';
  }
}

// Redirect if already logged in
if (getToken()) window.location.href = '/dashboard';
