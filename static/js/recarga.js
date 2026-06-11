// ─── SHARED ──────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ev_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('ev_token'); window.location.href = '/'; }

if (!getToken()) { window.location.href = '/'; }

// ─── SIMULATION ───────────────────────────────────────────────────────────────
const data = JSON.parse(sessionStorage.getItem('recarga_data') || 'null');
const localNome = sessionStorage.getItem('recarga_local') || '—';
const vagaNome  = sessionStorage.getItem('recarga_vaga') || '—';

if (!data) { window.location.href = '/dashboard'; }

// Fill monitor labels
document.getElementById('monPotencia').textContent = data.potencia_real + ' kW';
document.getElementById('monCusto').textContent = `R$ ${data.custo.toFixed(2)}`;
document.getElementById('monLocal').textContent = localNome;
document.getElementById('monVaga').textContent = vagaNome;
document.getElementById('monPlano').textContent = data.plano || '—';

const totalMin = data.tempo_min;
const totalEnergia = data.energia_kwh;

let currentMin = 0;
const interval = setInterval(() => {
  currentMin++;
  const pct = Math.round((currentMin / totalMin) * 100);
  const energiaAtual = ((totalEnergia / totalMin) * currentMin).toFixed(2);
  const restante = totalMin - currentMin;

  document.getElementById('progressPct').textContent = `${pct}%`;
  document.getElementById('progressBar').style.width = `${pct}%`;
  document.getElementById('monEnergia').textContent = energiaAtual;
  document.getElementById('monTempo').textContent = `${restante} min`;

  if (currentMin >= totalMin) {
    clearInterval(interval);
    setTimeout(showReport, 800);
  }
}, 600); // 600ms per "minute" for demo speed

function showReport() {
  document.getElementById('viewCharging').classList.add('hidden');
  const rep = document.getElementById('viewReport');
  rep.classList.remove('hidden');

  document.getElementById('repPlano').textContent = data.plano || '—';
  document.getElementById('repLocal').textContent = `${localNome}`;
  document.getElementById('repVaga').textContent = vagaNome;
  document.getElementById('repPotencia').textContent = `${data.potencia_real} kW`;
  document.getElementById('repEnergia').textContent = `${data.energia_kwh} kWh`;
  document.getElementById('repTempo').textContent = `${data.tempo_min} minutos`;
  document.getElementById('repCusto').textContent = `R$ ${data.custo.toFixed(2)}`;
  document.getElementById('repSaldo').textContent = `R$ ${data.credito_restante.toFixed(2)}`;

  // Clear session storage
  sessionStorage.removeItem('recarga_data');
  sessionStorage.removeItem('recarga_local');
  sessionStorage.removeItem('recarga_vaga');
}
