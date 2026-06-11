// ─── SHARED ──────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ev_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('ev_token'); window.location.href = '/'; }
function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.innerHTML = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

if (!getToken()) window.location.href = '/';

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = { plano: null, potencia: null, regiao: null, local: null, localNome: null, vaga: null, tempo: 30, userCredito: 0, userPlano: null };

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inputData').value = today;
  document.getElementById('inputHora').value = '12:00';
});

async function init() {
  try {
    const res = await fetch('/api/profile', { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    const user = await res.json();
    state.userCredito = user.credito;
    state.userPlano = user.plano;
    if (user.plano) {
      document.getElementById('navPlan').textContent = user.plano;
      document.getElementById('navPlan').classList.remove('hidden');
      const planMap = { 'Básico': 7, 'Intermediário': 11, 'Premium': 22 };
      const planCardMap = { 'Básico': 'plan-basico', 'Intermediário': 'plan-inter', 'Premium': 'plan-premium' };
      state.plano = user.plano;
      state.potencia = planMap[user.plano];
      document.getElementById(planCardMap[user.plano])?.classList.add('selected');
      document.getElementById('btnNextPlan').disabled = false;
    }
  } catch (e) { console.error(e); }
}

// ─── STEPS ───────────────────────────────────────────────────────────────────
function goToStep(n) {
  ['stepPlano','stepRegiao','stepVaga','stepConfirmar'].forEach((id, i) => {
    document.getElementById(id).classList.toggle('hidden', i !== n - 1);
  });
  ['s1','s2','s3','s4'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
    if (i < n - 1) el.classList.add('done');
    else if (i === n - 1) el.classList.add('active');
  });
  if (n === 3) loadSpots();
  if (n === 4) fillSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── PLAN ─────────────────────────────────────────────────────────────────────
async function selectPlan(nome, kw, preco) {
  state.plano = nome; state.potencia = kw;
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  const ids = { 'Básico': 'plan-basico', 'Intermediário': 'plan-inter', 'Premium': 'plan-premium' };
  document.getElementById(ids[nome])?.classList.add('selected');
  document.getElementById('btnNextPlan').disabled = false;
  try {
    await fetch('/api/profile/plan', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ plano: nome }) });
  } catch (e) {}
}

// ─── REGION & LOCAL ──────────────────────────────────────────────────────────
let allLocations = {};
async function loadLocals() {
  const regiao = document.getElementById('selectRegiao').value;
  if (!regiao) return;
  state.regiao = regiao;
  if (!Object.keys(allLocations).length) {
    const res = await fetch('/api/locations', { headers: authHeaders() });
    allLocations = await res.json();
  }
  const locais = allLocations[regiao] || [];
  const sel = document.getElementById('selectLocal');
  sel.innerHTML = '<option value="">— Escolha —</option>';
  locais.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.nome; o.dataset.addr = l.endereco; o.dataset.nome = l.nome; sel.appendChild(o); });
  document.getElementById('localGroup').classList.remove('hidden');
  document.getElementById('btnNextRegiao').disabled = true;
  updateTempoInfo();
}

function localSelected() {
  const sel = document.getElementById('selectLocal');
  const opt = sel.options[sel.selectedIndex];
  if (!sel.value) return;
  state.local = sel.value;
  state.localNome = opt.dataset.nome;
  document.getElementById('localAddr').textContent = '📍 ' + opt.dataset.addr;
  document.getElementById('btnNextRegiao').disabled = false;
  updateTempoInfo();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inputTempo').addEventListener('input', updateTempoInfo);
});

function updateTempoInfo() {
  const tempo = parseInt(document.getElementById('inputTempo').value) || 30;
  state.tempo = tempo;
  if (!state.plano) return;
  const potRede = 20, potCarro = 22, potCarregador = 21.4;
  const potReal = Math.min(state.potencia, potRede, potCarro, potCarregador);
  const energia = ((potReal * tempo) / 60).toFixed(2);
  const custo = (energia * 1.8).toFixed(2);
  document.getElementById('tempoInfo').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.85rem;">
      <div><span class="text-muted">Potência real:</span><br/><strong style="color:var(--primary)">${potReal.toFixed(1)} kW</strong></div>
      <div><span class="text-muted">Energia estimada:</span><br/><strong style="color:var(--primary)">${energia} kWh</strong></div>
      <div><span class="text-muted">Custo estimado:</span><br/><strong style="color:var(--danger)">R$ ${custo}</strong></div>
      <div><span class="text-muted">Seu saldo:</span><br/><strong style="color:var(--primary)">R$ ${state.userCredito.toFixed(2)}</strong></div>
    </div>`;
}

// ─── SPOTS ───────────────────────────────────────────────────────────────────
async function loadSpots() {
  const map = document.getElementById('spotMap');
  map.innerHTML = '<p class="text-muted">Carregando vagas...</p>';
  const res = await fetch(`/api/spots?local_id=${state.local}`, { headers: authHeaders() });
  const spots = await res.json();
  map.innerHTML = '';
  spots.forEach(s => {
    const div = document.createElement('div');
    div.className = `spot ${s.status}`;
    div.id = `spot-${s.id}`;
    const labels = { L: 'Livre', R: 'Reservada', O: 'Ocupada' };
    div.innerHTML = `<div class="spot-label">${s.id}</div><div class="spot-status-text">${labels[s.status]}</div>`;
    if (s.status === 'L') div.onclick = () => selectSpot(s.id, div);
    map.appendChild(div);
  });
}

function selectSpot(id, el) {
  document.querySelectorAll('.spot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  state.vaga = id;
  document.getElementById('selectedSpotId').textContent = id;
  document.getElementById('selectedSpotInfo').classList.remove('hidden');
  document.getElementById('btnNextVaga').disabled = false;
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
function fillSummary() {
  const tempo = parseInt(document.getElementById('inputTempo').value) || 30;
  state.tempo = tempo;
  const potRede = 20, potCarro = 22, potCarregador = 21.4;
  const potReal = Math.min(state.potencia, potRede, potCarro, potCarregador);
  const energia = ((potReal * tempo) / 60).toFixed(2);
  const custo = (energia * 1.8).toFixed(2);
  const dataAg = document.getElementById('inputData').value;
  const horaAg = document.getElementById('inputHora').value;
  document.getElementById('confPlano').textContent = state.plano;
  document.getElementById('confLocal').textContent = `${state.localNome} — ${state.regiao}`;
  document.getElementById('confVaga').textContent = state.vaga;
  document.getElementById('confTempo').textContent = `${tempo} min (${dataAg} às ${horaAg})`;
  document.getElementById('confEnergia').textContent = `${energia} kWh`;
  document.getElementById('confCusto').textContent = `R$ ${custo}`;
  document.getElementById('confSaldo').textContent = `R$ ${state.userCredito.toFixed(2)}`;
}

// ─── START CHARGING ───────────────────────────────────────────────────────────
async function startCharging() {
  const btn = document.getElementById('btnStartCharging');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Iniciando...';
  try {
    const res = await fetch('/api/charging/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ regiao: state.regiao, local: state.localNome, vaga: state.vaga, tempo_min: state.tempo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao iniciar recarga');
    sessionStorage.setItem('recarga_data', JSON.stringify(data));
    sessionStorage.setItem('recarga_local', state.localNome);
    sessionStorage.setItem('recarga_vaga', state.vaga);
    window.location.href = '/recarga';
  } catch (err) {
    showAlert('dashAlert', 'error', '❌ ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '🔌 Iniciar Recarga';
  }
}

async function createReservation() {
  const btn = document.getElementById('btnReserve');
  const dataVal = document.getElementById('inputData').value;
  const horaVal = document.getElementById('inputHora').value;

  if (!dataVal || !horaVal) {
    showAlert('dashAlert', 'error', '⚠️ Por favor, escolha a data e o horário.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Agendando...';
  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ 
        regiao: state.regiao, 
        local: state.localNome, 
        vaga: state.vaga, 
        tempo_min: state.tempo,
        data_reserva: `${dataVal} ${horaVal}:00`
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao agendar reserva');
    
    alert(data.message);
    window.location.href = '/reservas';
  } catch (err) {
    showAlert('dashAlert', 'error', '❌ ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '📅 Agendar para depois';
  }
}

init();
