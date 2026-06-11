// ─── SHARED ──────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ev_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('ev_token'); window.location.href = '/'; }

if (!getToken()) window.location.href = '/';

function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.innerHTML = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const [profRes, txRes] = await Promise.all([
      fetch('/api/profile', { headers: authHeaders() }),
      fetch('/api/transactions', { headers: authHeaders() })
    ]);
    if (profRes.status === 401) { logout(); return; }
    const user = await profRes.json();
    const txs = await txRes.json();
    renderProfile(user);
    renderTransactions(txs);
  } catch (e) { console.error(e); }
}

function renderProfile(user) {
  document.getElementById('infoNome').textContent = user.nome;
  document.getElementById('infoEmail').textContent = user.email;
  document.getElementById('statCredito').textContent = `R$ ${user.credito.toFixed(2)}`;
  document.getElementById('statPlano').textContent = user.plano || 'Nenhum';
  document.getElementById('statPotencia').textContent = user.potencia_max ? `${user.potencia_max} kW` : '—';
  document.getElementById('statSince').textContent = user.data_cadastro;

  // highlight current plan
  const planMap = { 'Básico': 'pp-basico', 'Intermediário': 'pp-inter', 'Premium': 'pp-premium' };
  if (user.plano && planMap[user.plano]) {
    document.getElementById(planMap[user.plano])?.classList.add('selected');
  }
}

function renderTransactions(txs) {
  const list = document.getElementById('txList');
  if (!txs.length) { list.innerHTML = '<p class="text-muted">Nenhuma transação ainda.</p>'; return; }
  list.innerHTML = txs.map(t => {
    const isCredit = t.tipo === 'credito';
    const isDebit  = t.tipo === 'debito';
    const amtClass = isCredit ? 'credit' : isDebit ? 'debit' : '';
    const sign     = isCredit ? '+' : isDebit ? '-' : '';
    const icon     = isCredit ? '💳' : isDebit ? '⚡' : '🔧';
    return `<div class="tx-item">
      <div class="tx-info">
        <div class="tx-desc">${icon} ${t.descricao}</div>
        <div class="tx-date">${t.data_hora}</div>
      </div>
      <div class="tx-amount ${amtClass}">${sign}R$ ${t.valor.toFixed(2)}</div>
    </div>`;
  }).join('');
}

// ─── CREDITS ─────────────────────────────────────────────────────────────────
let selectedCredit = null;

function selectCredit(val) {
  selectedCredit = val;
  document.querySelectorAll('.credit-chip').forEach(c => c.classList.remove('selected'));
  event.target.classList.add('selected');
  document.getElementById('creditValue').value = val;
}

async function addCredits() {
  const val = parseFloat(document.getElementById('creditValue').value);
  if (!val || val < 5) { showAlert('perfilAlert', 'error', '❌ Valor mínimo de R$ 5,00'); return; }
  const btn = document.getElementById('btnAddCredit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processando...';
  try {
    const res = await fetch('/api/profile/credits', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ valor: val })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showAlert('perfilAlert', 'success', `✅ R$ ${val.toFixed(2)} adicionados! Novo saldo: R$ ${data.credito.toFixed(2)}`);
    document.getElementById('statCredito').textContent = `R$ ${data.credito.toFixed(2)}`;
    document.getElementById('creditValue').value = '';
    document.querySelectorAll('.credit-chip').forEach(c => c.classList.remove('selected'));
    const txRes = await fetch('/api/transactions', { headers: authHeaders() });
    renderTransactions(await txRes.json());
  } catch (err) {
    showAlert('perfilAlert', 'error', '❌ ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '➕ Adicionar Créditos';
  }
}

// ─── CHANGE PLAN ──────────────────────────────────────────────────────────────
async function changePlan(nome) {
  try {
    const res = await fetch('/api/profile/plan', {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ plano: nome })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showAlert('perfilAlert', 'success', `✅ Plano ${nome} ativado!`);
    document.querySelectorAll('#perfilPlanGrid .plan-card').forEach(c => c.classList.remove('selected'));
    const ids = { 'Básico': 'pp-basico', 'Intermediário': 'pp-inter', 'Premium': 'pp-premium' };
    document.getElementById(ids[nome])?.classList.add('selected');
    const planMap = { 'Básico': 7, 'Intermediário': 11, 'Premium': 22 };
    document.getElementById('statPlano').textContent = nome;
    document.getElementById('statPotencia').textContent = `${planMap[nome]} kW`;
  } catch (err) {
    showAlert('perfilAlert', 'error', '❌ ' + err.message);
  }
}

init();
