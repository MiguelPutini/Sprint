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

let pendingCreditVal = 0;

function addCredits() {
  const val = parseFloat(document.getElementById('creditValue').value);
  if (!val || val < 5) { showAlert('perfilAlert', 'error', '❌ Valor mínimo de R$ 5,00'); return; }
  
  pendingCreditVal = val;
  
  // Configurar UI do Modal
  document.getElementById('payCreditVal').textContent = `R$ ${val.toFixed(2)}`;
  document.getElementById('payTotalFinal').textContent = `R$ ${val.toFixed(2)}`;
  
  // Limpar formulário de pagamento
  document.getElementById('cardNumber').value = '';
  document.getElementById('cardName').value = '';
  document.getElementById('cardExpiry').value = '';
  document.getElementById('cardCvv').value = '';
  document.getElementById('cardBrand').textContent = '';
  
  goPayStep(1);
  document.getElementById('creditPaymentModal').classList.remove('hidden');
}

function goPayStep(step) {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`payStep${i}`).classList.add('hidden');
    document.getElementById(`ps${i}`).classList.remove('active', 'done');
  }
  document.getElementById(`payStep${step}`).classList.remove('hidden');
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`ps${i}`);
    if (i < step) el.classList.add('done');
    else if (i === step) el.classList.add('active');
  }
}

function closePayModal() {
  document.getElementById('creditPaymentModal').classList.add('hidden');
  pendingCreditVal = 0;
}

function closeModalOutside(e) {
  if (e.target.id === 'creditPaymentModal') {
    closePayModal();
  }
}

function formatCard(el) {
  let value = el.value.replace(/\D/g, '');
  let formatted = '';
  for (let i = 0; i < value.length; i++) {
    if (i > 0 && i % 4 === 0) formatted += ' ';
    formatted += value[i];
  }
  el.value = formatted.substring(0, 19);

  const cardBrand = document.getElementById('cardBrand');
  if (value.startsWith('4')) {
    cardBrand.textContent = '💳 VISA';
    cardBrand.style.color = 'var(--primary)';
  } else if (/^5[1-5]/.test(value)) {
    cardBrand.textContent = '💳 MASTERCARD';
    cardBrand.style.color = 'var(--primary)';
  } else if (/^3[47]/.test(value)) {
    cardBrand.textContent = '💳 AMERICAN EXPRESS';
    cardBrand.style.color = 'var(--primary)';
  } else if (value.length > 0) {
    cardBrand.textContent = '💳 CARTÃO CRÉDITO';
    cardBrand.style.color = 'var(--muted)';
  } else {
    cardBrand.textContent = '';
  }
}

function formatExpiry(el) {
  let value = el.value.replace(/\D/g, '');
  if (value.length > 2) {
    el.value = value.substring(0, 2) + '/' + value.substring(2, 4);
  } else {
    el.value = value;
  }
}

async function processPayment() {
  const cardNum = document.getElementById('cardNumber').value.trim();
  const cardName = document.getElementById('cardName').value.trim();
  const cardExp = document.getElementById('cardExpiry').value.trim();
  const cardCvv = document.getElementById('cardCvv').value.trim();

  if (cardNum.length < 16) { alert('Número de cartão inválido (mínimo 16 dígitos).'); return; }
  if (!cardName) { alert('Informe o nome impresso no cartão.'); return; }
  if (cardExp.length < 5) { alert('Validade inválida (MM/AA).'); return; }
  if (cardCvv.length < 3) { alert('CVV inválido.'); return; }

  goPayStep(2);
  const pBar = document.getElementById('payProgressBar');
  const msg = document.getElementById('payProcessingMsg');
  
  pBar.style.width = '0%';
  msg.textContent = 'Conectando com a operadora do cartão...';
  
  let progress = 0;
  const interval = setInterval(async () => {
    progress += 25;
    pBar.style.width = `${progress}%`;
    
    if (progress === 50) {
      msg.textContent = 'Autenticando transação e verificando saldo...';
    } else if (progress === 75) {
      msg.textContent = 'Adicionando saldo ao banco de dados...';
    } else if (progress === 100) {
      clearInterval(interval);
      
      try {
        const res = await fetch('/api/profile/credits', {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ valor: pendingCreditVal })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao processar saldo');
        
        document.getElementById('statCredito').textContent = `R$ ${data.credito.toFixed(2)}`;
        document.getElementById('creditValue').value = '';
        document.querySelectorAll('.credit-chip').forEach(c => c.classList.remove('selected'));
        
        const txRes = await fetch('/api/transactions', { headers: authHeaders() });
        renderTransactions(await txRes.json());

        goPayStep(3);
        const receipt = document.getElementById('payReceipt');
        receipt.innerHTML = `
          <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
            <span class="text-muted">Serviço:</span><strong>Recarga de Saldo</strong>
          </div>
          <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
            <span class="text-muted">Titular:</span><strong style="text-transform:uppercase;">${cardName}</strong>
          </div>
          <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
            <span class="text-muted">Cartão:</span><strong>•••• •••• •••• ${cardNum.slice(-4)}</strong>
          </div>
          <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span class="text-muted">Valor Faturado:</span><strong style="color:var(--primary);">R$ ${pendingCreditVal.toFixed(2)}</strong>
          </div>
        `;
      } catch (err) {
        alert('Falha na autorização: ' + err.message);
        goPayStep(1);
      }
    }
  }, 600);
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
