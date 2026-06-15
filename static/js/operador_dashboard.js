// ─────────────────────────────────────────────────────────────
// OPERADOR_DASHBOARD.JS — Lógica do Painel do Operador (Sprint 2)
// ─────────────────────────────────────────────────────────────

// --- CONFIGURAÇÃO GLOBAL E ESTADO ---
let token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/operador';
}

// Mapa de vagas por localização
let locationSpots = {};
let currentLocalName = '';

// Getter dinâmico para "spots" retornar a lista da localização atual
Object.defineProperty(window, 'spots', {
  get: () => locationSpots[currentLocalName] || []
});

let completedSessions = [];
let smartMode = true;
const totalGridLimit = 88.0; // kW

// Dados de Configuração Temporária da Nova Sessão (Modal)
let activeSpotIdForConfig = null;
let selectedVehicleType = 'standard';
let selectedPower = 7;
let activeConfigCost = 0;
let activeConfigKwh = 0;

// --- INICIALIZAÇÃO DO DOCUMENTO ---
document.addEventListener('DOMContentLoaded', () => {
  initOCPPBoot();
  loadLocations();
  startGlobalSimulation();

  // Iniciar um relógio periódico de atualização de tarifas dinâmicas (a cada 30 segundos)
  setInterval(updateDynamicTariff, 30000);
});

// --- AUTENTICAÇÃO E PERFIL ---
function getToken() {
  return localStorage.getItem('token');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('portal');
  window.location.href = '/operador';
}

async function fetchProfile() {
  try {
    const res = await fetch('/api/profile', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) {
      logout();
      return;
    }
    const user = await res.json();
    console.log(`Operador autenticado: ${user.nome} (${user.email})`);
  } catch (err) {
    console.error('Erro ao buscar dados do perfil do operador:', err);
  }
}

// --- BUSCAR E POPULAR LOCAIS ---
async function loadLocations() {
  try {
    const res = await fetch('/api/locations', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) {
      logout();
      return;
    }
    const data = await res.json();
    const select = document.getElementById('opSelectLocal');
    if (!select) return;

    select.innerHTML = '';
    let firstLocal = '';

    for (const [region, locals] of Object.entries(data)) {
      locals.forEach(local => {
        const option = document.createElement('option');
        option.value = local.nome;
        option.textContent = `${local.nome} (${region})`;
        select.appendChild(option);
        if (!firstLocal) firstLocal = local.nome;
      });
    }

    if (firstLocal) {
      currentLocalName = firstLocal;
      changeOpLocation();
    }
  } catch (err) {
    console.error('Erro ao carregar localizações da API:', err);
  }
}

// --- GERENCIAMENTO DE ESTADOS DE VAGAS POR LOCAL ---
function generateInitialSpotsForLocation(localName) {
  let initialSpots = [];
  const rows = ['A', 'B'];
  rows.forEach(row => {
    for (let col = 1; col <= 3; col++) {
      const id = `${row}${col}`;
      const rand = Math.random();
      let status = 'available';
      let soc = 0;
      let power = 0;
      let vehicleType = null;
      
      if (rand < 0.25) {
        status = 'charging';
        soc = Math.floor(Math.random() * 60) + 15;
        power = [7, 11, 22][Math.floor(Math.random() * 3)];
        vehicleType = ['standard', 'commercial', 'premium'][Math.floor(Math.random() * 3)];
      } else if (rand < 0.4) {
        status = 'paused';
        soc = Math.floor(Math.random() * 50) + 10;
        power = [7, 11, 22][Math.floor(Math.random() * 3)];
        vehicleType = ['standard', 'commercial', 'premium'][Math.floor(Math.random() * 3)];
      }
      
      initialSpots.push({
        id: id,
        status: status,
        vehicleType: vehicleType,
        powerLimit: power,
        requestedPower: power,
        actualPower: status === 'charging' ? power : 0,
        soc: soc,
        energyDelivered: status === 'charging' ? (power * (soc / 100)) : 0,
        cost: 0,
        duration: status === 'charging' ? Math.floor(Math.random() * 800) + 200 : 0,
        timerId: null,
        transactionId: status !== 'available' ? Math.floor(Math.random() * 89999 + 10000) : null,
        startTime: status !== 'available' ? new Date(Date.now() - 15 * 60000) : null
      });
    }
  });
  return initialSpots;
}

function changeOpLocation() {
  const select = document.getElementById('opSelectLocal');
  if (!select) return;

  const newLocal = select.value;
  if (!newLocal) return;

  currentLocalName = newLocal;

  if (!locationSpots[currentLocalName]) {
    locationSpots[currentLocalName] = generateInitialSpotsForLocation(currentLocalName);
  }

  renderSpotGrid();
  renderActiveSessionsTable();
  runDemandControl();
  updateDynamicTariff();
}

function syncOpLocationSpots() {
  if (confirm(`Deseja sincronizar as vagas de "${currentLocalName}"? Quaisquer recargas ativas neste local serão perdidas.`)) {
    locationSpots[currentLocalName] = generateInitialSpotsForLocation(currentLocalName);
    renderSpotGrid();
    renderActiveSessionsTable();
    runDemandControl();
    updateDynamicTariff();
    alert("Vagas sincronizadas!");
  }
}

// --- CONTROLE DE NAVEGAÇÃO / TABS ---
function switchOpTab(tab) {
  const panels = document.querySelectorAll('.op-tab-panel');
  panels.forEach(p => p.classList.add('hidden'));

  const activePanel = document.getElementById(`tab-${tab}`);
  if (activePanel) activePanel.classList.remove('hidden');

  const tabBtns = document.querySelectorAll('#opTabs .tab');
  tabBtns.forEach(b => b.classList.remove('active'));

  const activeBtn = document.getElementById(`tab-btn-${tab}`);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'tarifa') {
    updateDynamicTariff();
  } else if (tab === 'demanda') {
    runDemandControl();
  }
}

// --- RENDERIZAÇÃO DE INTERFACE ---
function renderSpotGrid() {
  const grid = document.getElementById('spotGrid');
  if (!grid) return;

  let html = '';
  spots.forEach(s => {
    if (s.status === 'available') {
      html += `
        <div class="op-spot-card available" onclick="openStartSession('${s.id}')">
          <div class="op-spot-id">Vaga ${s.id}</div>
          <div class="op-spot-icon">🔌</div>
          <div class="op-spot-status" style="color:var(--primary)">Livre</div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem;">Clique para iniciar</div>
        </div>
      `;
    } else {
      const isCharging = s.status === 'charging';
      const vEmoji = s.vehicleType === 'standard' ? '🚗' : (s.vehicleType === 'commercial' ? '🚛' : '⭐');
      const statusClass = isCharging ? 'charging' : 'paused';
      const statusLabel = isCharging 
        ? '<span class="charging-pulse"></span>Carregando' 
        : '<span style="color:var(--warning)">Pausado</span>';
        
      const actionButton = isCharging
        ? `<button class="btn btn-xs btn-outline" style="border-color:var(--warning);color:var(--warning);padding:2px 8px;font-size:0.7rem;" onclick="event.stopPropagation(); pauseSession('${s.id}')">Pausar</button>`
        : `<button class="btn btn-xs btn-outline" style="border-color:var(--primary);color:var(--primary);padding:2px 8px;font-size:0.7rem;" onclick="event.stopPropagation(); resumeSession('${s.id}')">Retomar</button>`;
        
      html += `
        <div class="op-spot-card ${statusClass}">
          <div class="op-spot-id">Vaga ${s.id}</div>
          <div class="op-spot-icon">${vEmoji}</div>
          <div class="op-spot-status">${statusLabel}</div>
          <div class="op-spot-power">${s.actualPower.toFixed(1)} kW</div>
          <div class="op-spot-detail">SoC: ${s.soc.toFixed(0)}% • ${s.energyDelivered.toFixed(1)} kWh</div>
          <div class="op-spot-cost">R$ ${s.cost.toFixed(2)}</div>
          <div style="display:flex;gap:6px;justify-content:center;margin-top:0.75rem;">
            ${actionButton}
            <button class="btn btn-xs btn-primary" style="background:var(--red);border-color:var(--red);padding:2px 8px;font-size:0.7rem;" onclick="event.stopPropagation(); stopSession('${s.id}')">Parar</button>
          </div>
        </div>
      `;
    }
  });
  grid.innerHTML = html;
}

function renderActiveSessionsTable() {
  const container = document.getElementById('sessionsDetail');
  if (!container) return;

  const active = spots.filter(s => s.status !== 'available');
  if (active.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <div class="card">
      <div class="card-title"><span>🔍</span> Detalhes das Sessões Ativas</div>
      <div style="overflow-x:auto;">
        <table class="op-sessions-table">
          <thead>
            <tr>
              <th>Vaga</th>
              <th>Veículo</th>
              <th>Solicitado</th>
              <th>Real</th>
              <th>Progresso (SoC)</th>
              <th>Entregue</th>
              <th>Custo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
  `;

  active.forEach(s => {
    const isCharging = s.status === 'charging';
    const vName = s.vehicleType === 'standard' ? '🚗 Compacto' : (s.vehicleType === 'commercial' ? '🚛 Comercial' : '⭐ Premium');
    const statusLabel = isCharging 
      ? '<span class="tag tag-green">Em Carga</span>' 
      : '<span class="tag tag-yellow">Pausado</span>';
      
    const actionButton = isCharging
      ? `<button class="btn btn-xs btn-outline" style="border-color:var(--warning);color:var(--warning);padding:2px 6px;font-size:0.7rem;" onclick="pauseSession('${s.id}')">Pausar</button>`
      : `<button class="btn btn-xs btn-outline" style="border-color:var(--primary);color:var(--primary);padding:2px 6px;font-size:0.7rem;" onclick="resumeSession('${s.id}')">Retomar</button>`;

    html += `
      <tr>
        <td><strong>${s.id}</strong></td>
        <td>${vName}</td>
        <td>${s.powerLimit} kW</td>
        <td><strong style="color:var(--primary);">${s.actualPower.toFixed(1)} kW</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-wrap" style="width:70px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
              <div class="progress-bar" style="width:${s.soc}%;background:var(--primary);height:100%;"></div>
            </div>
            <span>${s.soc.toFixed(0)}%</span>
          </div>
        </td>
        <td>${s.energyDelivered.toFixed(2)} kWh</td>
        <td style="font-weight:700;color:var(--warning);">R$ ${s.cost.toFixed(2)}</td>
        <td>${statusLabel}</td>
        <td>
          <div style="display:flex;gap:6px;">
            ${actionButton}
            <button class="btn btn-xs btn-primary" style="background:var(--red);border-color:var(--red);padding:2px 6px;font-size:0.7rem;" onclick="stopSession('${s.id}')">Parar</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

// --- CONTROLE DE DEMANDA ---
function runDemandControl() {
  const activeCharging = spots.filter(s => s.status === 'charging');
  let totalRequested = activeCharging.reduce((sum, s) => sum + s.requestedPower, 0);

  let logLines = [];
  logLines.push(`<span class="algo-line-info">[SISTEMA] Algoritmo de demanda (${currentLocalName}) - ${new Date().toLocaleTimeString()}</span>`);
  logLines.push(`<span class="algo-line-muted">-- Modo Inteligente: ${smartMode ? '<b style="color:var(--primary)">ATIVADO</b>' : '<b style="color:var(--red)">DESATIVADO</b>'} --</span>`);
  logLines.push(`<span class="algo-line-muted">-- Limite Grade: ${totalGridLimit} kW | Demanda Solicitada: ${totalRequested.toFixed(1)} kW --</span>`);

  if (activeCharging.length === 0) {
    document.getElementById('algoViz').innerHTML = '<code style="color:var(--muted);font-size:0.82rem;">Nenhuma sessão ativa para visualizar.</code>';
    document.getElementById('powerDistributionList').innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Nenhuma sessão ativa.</p>';
    updateDemandStats(0);
    return;
  }

  let scaleFactor = 1.0;
  if (smartMode && totalRequested > totalGridLimit) {
    scaleFactor = totalGridLimit / totalRequested;
    logLines.push(`<span class="algo-line-warn">[ALERTA] Demanda total excede a capacidade! Redução proporcional de ${scaleFactor.toFixed(3)}x</span>`);
  } else if (!smartMode && totalRequested > totalGridLimit) {
    logLines.push(`<span class="algo-line-warn" style="color:var(--red);font-weight:700;">[PERIGO] Sobrecarga de rede! Limite de 88 kW ultrapassado no local.</span>`);
  }

  spots.forEach(s => {
    if (s.status === 'charging') {
      s.actualPower = s.requestedPower * scaleFactor;
      if (scaleFactor < 1.0) {
        logLines.push(`<span class="algo-line-warn">Vaga ${s.id} (${s.requestedPower} kW) -> Limitada para ${s.actualPower.toFixed(1)} kW</span>`);
      } else {
        logLines.push(`<span class="algo-line-ok">Vaga ${s.id} (${s.requestedPower} kW) -> Potência nominal entregue</span>`);
      }
    } else if (s.status === 'paused') {
      s.actualPower = 0;
      logLines.push(`<span class="algo-line-muted">Vaga ${s.id} -> Sessão suspensa (0 kW)</span>`);
    } else {
      s.actualPower = 0;
    }
  });

  document.getElementById('algoViz').innerHTML = logLines.join('<br>');

  let html = '';
  let currentTotalLoad = 0;
  activeCharging.forEach(s => {
    currentTotalLoad += s.actualPower;
    const pct = (s.actualPower / 22) * 100;
    const vehicleEmoji = s.vehicleType === 'standard' ? '🚗' : (s.vehicleType === 'commercial' ? '🚛' : '⭐');
    html += `
      <div class="power-dist-item">
        <div class="power-dist-label">
          <span>${vehicleEmoji} Vaga ${s.id} (${s.vehicleType === 'standard' ? 'Compacto' : (s.vehicleType === 'commercial' ? 'Comercial' : 'Premium')})</span>
          <strong>${s.actualPower.toFixed(1)} kW / ${s.requestedPower} kW</strong>
        </div>
        <div class="power-dist-bar">
          <div class="power-dist-fill" style="width: ${pct}%; background: ${s.actualPower < s.requestedPower ? 'var(--warning)' : 'var(--primary)'}"></div>
        </div>
      </div>
    `;
  });
  document.getElementById('powerDistributionList').innerHTML = html;

  updateDemandStats(currentTotalLoad);
}

function updateDemandStats(currentTotalLoad) {
  const pct = Math.min((currentTotalLoad / totalGridLimit) * 100, 100);

  // Barra de status global
  document.getElementById('navTotalLoad').textContent = `${currentTotalLoad.toFixed(1)} kW`;
  document.getElementById('energyLabel').textContent = `${currentTotalLoad.toFixed(1)} / ${totalGridLimit} kW`;
  document.getElementById('mainEnergyBar').style.width = `${pct}%`;
  document.getElementById('energyPct').textContent = `${pct.toFixed(0)}%`;

  const activeCount = spots.filter(s => s.status === 'charging' || s.status === 'paused').length;
  document.getElementById('navSessionCount').textContent = `${activeCount} ${activeCount === 1 ? 'sessão' : 'sessões'}`;

  document.getElementById('demandTotalLoad').textContent = `${currentTotalLoad.toFixed(1)} kW`;
  const reserve = Math.max(totalGridLimit - currentTotalLoad, 0);
  document.getElementById('demandReserve').textContent = `${reserve.toFixed(1)} kW`;

  const statusEl = document.getElementById('energyStatus');
  const smartBadge = document.getElementById('smartBadge');

  if (currentTotalLoad > totalGridLimit) {
    statusEl.className = 'tag tag-red';
    statusEl.textContent = 'SOBRECARGA!';
  } else if (currentTotalLoad > totalGridLimit * 0.8) {
    statusEl.className = 'tag tag-yellow';
    statusEl.textContent = 'Atenção';
  } else {
    statusEl.className = 'tag tag-green';
    statusEl.textContent = 'Normal';
  }

  smartBadge.className = smartMode ? 'tag tag-green' : 'tag tag-red';
  smartBadge.textContent = smartMode ? '🧠 Inteligente: ON' : '⚠️ Inteligente: OFF';
}

function toggleMode(isSmart) {
  smartMode = isSmart;

  const btnSmart = document.getElementById('modeIntelligent');
  const btnManual = document.getElementById('modeManual');

  if (smartMode) {
    btnSmart.style.borderColor = 'var(--primary)';
    btnSmart.style.background = 'rgba(0,212,170,0.08)';
    btnSmart.style.opacity = '1';
    btnSmart.querySelector('.tag').className = 'tag tag-green mt-1';
    btnSmart.querySelector('.tag').textContent = 'ATIVO';

    btnManual.style.borderColor = 'var(--border)';
    btnManual.style.background = 'transparent';
    btnManual.style.opacity = '0.5';
    btnManual.querySelector('.tag').className = 'tag tag-red mt-1';
    btnManual.querySelector('.tag').textContent = 'INATIVO';
  } else {
    btnManual.style.borderColor = 'var(--red)';
    btnManual.style.background = 'rgba(255,77,109,0.08)';
    btnManual.style.opacity = '1';
    btnManual.querySelector('.tag').className = 'tag tag-red mt-1';
    btnManual.querySelector('.tag').textContent = 'ATIVO';

    btnSmart.style.borderColor = 'var(--border)';
    btnSmart.style.background = 'transparent';
    btnSmart.style.opacity = '0.5';
    btnSmart.querySelector('.tag').className = 'tag tag-green mt-1';
    btnSmart.querySelector('.tag').textContent = 'INATIVO';
  }

  runDemandControl();
  renderSpotGrid();
  renderActiveSessionsTable();
  updateDynamicTariff();
}

// --- TARIFAS DINÂMICAS ---
function updateDynamicTariff() {
  const hour = new Date().getHours();
  let baseRate = 1.80;
  let period = 'Normal';
  let periodClass = 'tag-yellow';

  if ((hour >= 12 && hour < 14) || (hour >= 18 && hour < 22)) {
    baseRate = 2.50;
    period = 'Pico';
    periodClass = 'tag-red';
  } else if (hour >= 22 || hour < 6) {
    baseRate = 1.20;
    period = 'Fora de Pico';
    periodClass = 'tag-green';
  }

  const currentTotalLoad = spots.reduce((sum, s) => sum + s.actualPower, 0);
  const isHighDemand = currentTotalLoad > (totalGridLimit * 0.7);
  const demandMultiplier = isHighDemand ? 1.20 : 1.00;

  const currentRateDisplay = document.getElementById('currentRateDisplay');
  const currentPeriodTag = document.getElementById('currentPeriodTag');
  const factorTime = document.getElementById('factorTime');
  const factorDemand = document.getElementById('factorDemand');

  if (currentRateDisplay) {
    currentRateDisplay.textContent = `R$ ${(baseRate * demandMultiplier).toFixed(2)}`;
  }
  if (currentPeriodTag) {
    currentPeriodTag.className = `tag ${periodClass} mt-2`;
    currentPeriodTag.textContent = `${period.toUpperCase()} (Base: R$ ${baseRate.toFixed(2)})`;
  }
  if (factorTime) {
    factorTime.textContent = `R$ ${baseRate.toFixed(2)} (${period})`;
    factorTime.className = `tag ${periodClass}`;
  }
  if (factorDemand) {
    factorDemand.textContent = `×${demandMultiplier.toFixed(2)}`;
    factorDemand.className = isHighDemand ? 'tag tag-red' : 'tag tag-green';
  }

  // Atualizar visualização do grid
  const slots = document.querySelectorAll('.tariff-schedule .tariff-slot');
  slots.forEach(slot => slot.classList.remove('tariff-current'));

  let activeIndex = 0;
  if (hour >= 0 && hour < 6) activeIndex = 0;
  else if (hour >= 6 && hour < 12) activeIndex = 1;
  else if (hour >= 12 && hour < 14) activeIndex = 2;
  else if (hour >= 14 && hour < 18) activeIndex = 3;
  else if (hour >= 18 && hour < 22) activeIndex = 4;
  else activeIndex = 5;

  if (slots[activeIndex]) {
    slots[activeIndex].classList.add('tariff-current');
  }
}

function calcTariff(vehicleType) {
  const hour = new Date().getHours();
  let baseRate = 1.80;
  let period = 'Normal';

  if ((hour >= 12 && hour < 14) || (hour >= 18 && hour < 22)) {
    baseRate = 2.50;
    period = 'Pico';
  } else if (hour >= 22 || hour < 6) {
    baseRate = 1.20;
    period = 'Fora de Pico';
  }

  const currentTotalLoad = spots.reduce((sum, s) => sum + s.actualPower, 0);
  const isHighDemand = currentTotalLoad > (totalGridLimit * 0.7);
  const demandMultiplier = isHighDemand ? 1.20 : 1.00;

  let typeMultiplier = 1.00;
  let typeName = 'Compacto';
  if (vehicleType === 'commercial') {
    typeMultiplier = 1.15;
    typeName = 'Comercial';
  } else if (vehicleType === 'premium') {
    typeMultiplier = 0.90;
    typeName = 'Premium';
  }

  const rate = baseRate * demandMultiplier * typeMultiplier;

  const calcResult = document.getElementById('calcResult');
  if (calcResult) {
    calcResult.innerHTML = `
      <strong>Simulação (${typeName}):</strong><br>
      • Período: ${period} (Base: R$ ${baseRate.toFixed(2)}/kWh)<br>
      • Fator Demanda da Grade: x${demandMultiplier.toFixed(2)} (${isHighDemand ? '+20% de sobretaxa' : 'sem sobretaxa'})<br>
      • Fator Tipo de Veículo: x${typeMultiplier.toFixed(2)}<br>
      • <strong>Tarifa Estimada: R$ ${rate.toFixed(2)} / kWh</strong>
    `;
    calcResult.classList.remove('hidden');
  }

  ['calcStd', 'calcCom', 'calcPre'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('btn-primary');
  });
  
  let targetBtnId = 'calcStd';
  if (vehicleType === 'commercial') targetBtnId = 'calcCom';
  else if (vehicleType === 'premium') targetBtnId = 'calcPre';
  
  const targetBtn = document.getElementById(targetBtnId);
  if (targetBtn) targetBtn.classList.add('btn-primary');
}

// --- MODAL DE INICIALIZAÇÃO DE RECARGA SIMPLIFICADO ---
function openStartSession(spotId) {
  activeSpotIdForConfig = spotId;
  selectedVehicleType = 'standard';
  selectedPower = 7;

  // Atualizar UI do Modal
  document.getElementById('paySpotId').textContent = spotId;

  // Destacar padrões
  ['vt-standard', 'vt-commercial', 'vt-premium'].forEach(id => {
    document.getElementById(id).classList.remove('selected');
  });
  document.getElementById('vt-standard').classList.add('selected');

  ['pp-7', 'pp-11', 'pp-22'].forEach(id => {
    document.getElementById(id).classList.remove('selected');
  });
  document.getElementById('pp-7').classList.add('selected');

  updatePaymentPreview();
  goPayStep(1);

  document.getElementById('paymentModal').classList.remove('hidden');
}

function selectVehicleType(type) {
  selectedVehicleType = type;
  ['vt-standard', 'vt-commercial', 'vt-premium'].forEach(id => {
    document.getElementById(id).classList.remove('selected');
  });
  document.getElementById(`vt-${type}`).classList.add('selected');
  updatePaymentPreview();
}

function selectPower(power) {
  selectedPower = power;
  ['pp-7', 'pp-11', 'pp-22'].forEach(id => {
    document.getElementById(id).classList.remove('selected');
  });
  document.getElementById(`pp-${power}`).classList.add('selected');
  updatePaymentPreview();
}

function updatePaymentPreview() {
  const durationMin = 30;
  const kw = selectedPower;
  const kwh = (kw * durationMin) / 60;

  const hour = new Date().getHours();
  let baseRate = 1.80;
  if ((hour >= 12 && hour < 14) || (hour >= 18 && hour < 22)) {
    baseRate = 2.50;
  } else if (hour >= 22 || hour < 6) {
    baseRate = 1.20;
  }

  const currentTotalLoad = spots.reduce((sum, s) => sum + s.actualPower, 0);
  const isHighDemand = currentTotalLoad > (totalGridLimit * 0.7);
  const demandMultiplier = isHighDemand ? 1.20 : 1.00;

  let typeMultiplier = 1.00;
  if (selectedVehicleType === 'commercial') typeMultiplier = 1.15;
  else if (selectedVehicleType === 'premium') typeMultiplier = 0.90;

  const rate = baseRate * demandMultiplier * typeMultiplier;
  const totalCost = kwh * rate;

  document.getElementById('payTariffPreview').innerHTML = `
    <strong>Resumo do Carregamento:</strong><br>
    • Carga simulada (30 min): <strong>${kwh.toFixed(2)} kWh</strong> (a ${kw} kW)<br>
    • Custo estimado: <strong style="color:var(--primary)">R$ ${totalCost.toFixed(2)}</strong> (a R$ ${rate.toFixed(2)}/kWh)
  `;

  document.getElementById('btnPayStep1Next').disabled = false;
  
  // Set confirmação step values
  document.getElementById('payConfirmSpotId').textContent = activeSpotIdForConfig;
  document.getElementById('payConfirmVehicle').textContent = selectedVehicleType === 'standard' ? 'Compacto' : (selectedVehicleType === 'commercial' ? 'Comercial' : 'Premium');
  document.getElementById('payConfirmPower').textContent = `${selectedPower} kW`;
  document.getElementById('payConfirmRate').textContent = `R$ ${totalCost.toFixed(2)} (~${kwh.toFixed(1)} kWh)`;

  activeConfigCost = totalCost;
  activeConfigKwh = kwh;
}

function goPayStep(step) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`payStep${i}`).classList.add('hidden');
    document.getElementById(`ps${i}`).classList.remove('active', 'done');
  }

  document.getElementById(`payStep${step}`).classList.remove('hidden');

  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`ps${i}`);
    if (i < step) {
      el.classList.add('done');
    } else if (i === step) {
      el.classList.add('active');
    }
  }
}

function closePayModal() {
  document.getElementById('paymentModal').classList.add('hidden');
  activeSpotIdForConfig = null;
}

function closeModalOutside(e) {
  if (e.target.id === 'paymentModal') {
    closePayModal();
  }
}

function processPayment() {
  goPayStep(3);

  const orb = document.getElementById('payOrb');
  orb.className = 'charging-orb pay-orb-spin';
  orb.textContent = '⏳';

  const title = document.getElementById('payProcessingTitle');
  const msg = document.getElementById('payProcessingMsg');
  const pBar = document.getElementById('payProgressBar');

  title.textContent = 'Comunicando OCPP...';
  msg.textContent = 'Enviando OCPP 1.6: StartTransaction...';
  pBar.style.width = '0%';

  let progress = 0;
  const interval = setInterval(() => {
    progress += 25;
    pBar.style.width = `${progress}%`;

    if (progress === 50) {
      msg.textContent = 'Aguardando resposta do servidor central...';
      const msgId = Math.random().toString(36).substring(2, 9);
      logOCPP('CALL', 'StartTransaction', [
        2, msgId, "StartTransaction", {
          connectorId: 1,
          idTag: "OP-ADMIN-01",
          meterStart: 12530,
          timestamp: new Date().toISOString()
        }
      ]);
    } else if (progress === 75) {
      msg.textContent = 'Resposta recebida. Habilitando liberação de plugue...';
      logOCPP('RESULT', 'StartTransaction::Response', [
        3, "10000", {
          transactionId: Math.floor(Math.random() * 89999 + 10000),
          idTagInfo: {
            status: "Accepted",
            expiryDate: new Date(Date.now() + 86400000).toISOString()
          }
        }
      ]);
    } else if (progress === 100) {
      clearInterval(interval);
      orb.className = 'charging-orb';
      orb.textContent = '📡';

      goPayStep(4);

      const receiptEl = document.getElementById('payReceipt');
      receiptEl.innerHTML = `
        <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px;">
          <span class="text-muted">Local</span><strong>${currentLocalName}</strong>
        </div>
        <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px;">
          <span class="text-muted">Vaga</span><strong>${activeSpotIdForConfig}</strong>
        </div>
        <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px;">
          <span class="text-muted">Tipo de Veículo</span><strong>${selectedVehicleType === 'standard' ? 'Compacto' : (selectedVehicleType === 'commercial' ? 'Comercial' : 'Premium')}</strong>
        </div>
        <div class="tx-item" style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px;">
          <span class="text-muted">Potência Selecionada</span><strong>${selectedPower} kW</strong>
        </div>
      `;

      // Iniciar a carga na vaga
      startChargingAtLocation(currentLocalName, activeSpotIdForConfig, selectedVehicleType, selectedPower, activeConfigCost, activeConfigKwh);
    }
  }, 600);
}

// --- MECANISMO DE SIMULAÇÃO EM TEMPO REAL MULTI-LOCAL ---
function startGlobalSimulation() {
  setInterval(() => {
    let stateChanged = false;

    for (const [localName, spotsList] of Object.entries(locationSpots)) {
      const activeCharging = spotsList.filter(s => s.status === 'charging');
      let totalRequested = activeCharging.reduce((sum, s) => sum + s.requestedPower, 0);

      let scaleFactor = 1.0;
      if (smartMode && totalRequested > totalGridLimit) {
        scaleFactor = totalGridLimit / totalRequested;
      }

      spotsList.forEach(spot => {
        if (spot.status === 'charging') {
          spot.actualPower = spot.requestedPower * scaleFactor;
          
          spot.duration += 1;
          const tickHours = 1 / 3600;
          const speedup = 180;
          const deltaKwh = (spot.actualPower * tickHours) * speedup;
          spot.energyDelivered += deltaKwh;

          const batteryCapacity = 50;
          const deltaSoC = (deltaKwh / batteryCapacity) * 100;
          spot.soc = Math.min(spot.soc + deltaSoC, 100);

          // Custo dinâmico
          const hour = new Date().getHours();
          let baseRate = 1.80;
          if ((hour >= 12 && hour < 14) || (hour >= 18 && hour < 22)) baseRate = 2.50;
          else if (hour >= 22 || hour < 6) baseRate = 1.20;

          const currentTotalLoad = spotsList.reduce((sum, s) => sum + s.actualPower, 0);
          const isHighDemand = currentTotalLoad > (totalGridLimit * 0.7);
          const demandMultiplier = isHighDemand ? 1.20 : 1.00;

          let typeMultiplier = 1.00;
          if (spot.vehicleType === 'commercial') typeMultiplier = 1.15;
          else if (spot.vehicleType === 'premium') typeMultiplier = 0.90;

          const rate = baseRate * demandMultiplier * typeMultiplier;
          spot.cost = spot.energyDelivered * rate;

          // MeterValues no OCPP
          if (localName === currentLocalName && spot.duration % 5 === 0) {
            const msgId = Math.random().toString(36).substring(2, 9);
            logOCPP('CALL', 'MeterValues', [
              2, msgId, "MeterValues", {
                connectorId: 1,
                transactionId: spot.transactionId,
                meterValue: [{
                  timestamp: new Date().toISOString(),
                  sampledValue: [
                    { value: spot.soc.toFixed(1), unit: "Percent", measurand: "SoC" },
                    { value: (spot.energyDelivered * 1000).toFixed(0), unit: "Wh", measurand: "Energy.Active.Import.Register" },
                    { value: (spot.actualPower * 1000).toFixed(0), unit: "W", measurand: "Power.Active.Import" }
                  ]
                }]
              }
            ]);
          }

          if (spot.soc >= 100) {
            stopSessionAtLocation(localName, spot.id, 'EV.Finished');
            stateChanged = true;
          } else {
            stateChanged = true;
          }
        }
      });
    }

    if (stateChanged) {
      renderSpotGrid();
      renderActiveSessionsTable();
      runDemandControl();
    }
  }, 1000);
}

function startChargingAtLocation(localName, spotId, vehicleType, powerLimit, totalCost, totalKwh) {
  const spotsList = locationSpots[localName];
  if (!spotsList) return;

  const spot = spotsList.find(s => s.id === spotId);
  if (!spot) return;

  spot.status = 'charging';
  spot.vehicleType = vehicleType;
  spot.powerLimit = powerLimit;
  spot.requestedPower = powerLimit;
  spot.actualPower = powerLimit;
  spot.soc = 10;
  spot.energyDelivered = 0;
  spot.cost = 0;
  spot.duration = 0;
  spot.transactionId = Math.floor(Math.random() * 89999 + 10000);
  spot.startTime = new Date();

  if (localName === currentLocalName) {
    runDemandControl();
    renderSpotGrid();
    renderActiveSessionsTable();
  }
}

function pauseSession(spotId) {
  const spot = spots.find(s => s.id === spotId);
  if (!spot || spot.status !== 'charging') return;

  spot.status = 'paused';
  spot.actualPower = 0;

  const msgId = Math.random().toString(36).substring(2, 9);
  logOCPP('CALL', 'StatusNotification', [
    2, msgId, "StatusNotification", {
      connectorId: 1,
      status: "SuspendedEVSE",
      errorCode: "NoError"
    }
  ]);

  runDemandControl();
  renderSpotGrid();
  renderActiveSessionsTable();
}

function resumeSession(spotId) {
  const spot = spots.find(s => s.id === spotId);
  if (!spot || spot.status !== 'paused') return;

  spot.status = 'charging';
  spot.actualPower = spot.requestedPower;

  const msgId = Math.random().toString(36).substring(2, 9);
  logOCPP('CALL', 'StatusNotification', [
    2, msgId, "StatusNotification", {
      connectorId: 1,
      status: "Charging",
      errorCode: "NoError"
    }
  ]);

  runDemandControl();
  renderSpotGrid();
  renderActiveSessionsTable();
}

function stopSession(spotId) {
  stopSessionAtLocation(currentLocalName, spotId, 'Local');
}

function stopSessionAtLocation(localName, spotId, reason) {
  const spotsList = locationSpots[localName];
  if (!spotsList) return;

  const spot = spotsList.find(s => s.id === spotId);
  if (!spot || spot.status === 'available') return;

  if (localName === currentLocalName) {
    const msgId = Math.random().toString(36).substring(2, 9);
    logOCPP('CALL', 'StopTransaction', [
      2, msgId, "StopTransaction", {
        transactionId: spot.transactionId,
        meterStop: 12530 + Math.round(spot.energyDelivered * 1000),
        timestamp: new Date().toISOString(),
        reason: reason
      }
    ]);

    setTimeout(() => {
      logOCPP('RESULT', 'StopTransaction::Response', [
        3, msgId, {
          idTagInfo: {
            status: "Expired"
          }
        }
      ]);
    }, 400);
  }

  completedSessions.push({
    localName: localName,
    spotId: spot.id,
    vehicleType: spot.vehicleType,
    power: spot.powerLimit,
    soc: spot.soc,
    energy: spot.energyDelivered,
    cost: spot.cost,
    duration: spot.duration,
    endTime: new Date()
  });

  spot.status = 'available';
  spot.vehicleType = null;
  spot.powerLimit = 0;
  spot.requestedPower = 0;
  spot.actualPower = 0;
  spot.soc = 0;
  spot.energyDelivered = 0;
  spot.cost = 0;
  spot.duration = 0;
  spot.transactionId = null;
  spot.startTime = null;

  if (localName === currentLocalName) {
    runDemandControl();
    renderSpotGrid();
    renderActiveSessionsTable();
    updateReports();
  }
}

// --- RELATÓRIOS E EXPORTAÇÃO ---
function updateReports() {
  const totalSessions = completedSessions.length;
  const totalEnergy = completedSessions.reduce((sum, s) => sum + s.energy, 0);
  const totalRevenue = completedSessions.reduce((sum, s) => sum + s.cost, 0);
  const avgDuration = totalSessions > 0 
    ? completedSessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions 
    : 0;

  document.getElementById('repTotalSessions').textContent = totalSessions;
  document.getElementById('repTotalEnergy').textContent = `${totalEnergy.toFixed(2)} kWh`;
  document.getElementById('repTotalRevenue').textContent = `R$ ${totalRevenue.toFixed(2)}`;

  if (totalSessions > 0) {
    const mins = Math.floor(avgDuration / 60);
    const secs = Math.round(avgDuration % 60);
    document.getElementById('repAvgTime').textContent = `${mins}m ${secs}s`;
  } else {
    document.getElementById('repAvgTime').textContent = '—';
  }

  const historyContainer = document.getElementById('historyTable');
  if (completedSessions.length === 0) {
    historyContainer.innerHTML = '<p class="text-muted" style="font-size:0.85rem;text-align:center;padding:2rem;">Nenhuma sessão concluída ainda. Inicie sessões na aba Sessões.</p>';
    return;
  }

  let html = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Local</th>
          <th>Vaga</th>
          <th>Veículo</th>
          <th>Potência</th>
          <th>SoC Fim</th>
          <th>Energia</th>
          <th>Custo</th>
          <th>Duração</th>
        </tr>
      </thead>
      <tbody>
  `;

  completedSessions.forEach(s => {
    const vEmoji = s.vehicleType === 'standard' ? '🚗 Compacto' : (s.vehicleType === 'commercial' ? '🚛 Comercial' : '⭐ Premium');
    html += `
      <tr>
        <td>${s.localName}</td>
        <td><strong>${s.spotId}</strong></td>
        <td>${vEmoji}</td>
        <td>${s.power} kW</td>
        <td>${s.soc.toFixed(0)}%</td>
        <td>${s.energy.toFixed(2)} kWh</td>
        <td style="color:var(--primary);font-weight:700;">R$ ${s.cost.toFixed(2)}</td>
        <td>${Math.floor(s.duration / 60)}m ${Math.round(s.duration % 60)}s</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;
  historyContainer.innerHTML = html;
}

function fakeExport() {
  if (completedSessions.length === 0) {
    alert('Nenhuma sessão concluída para exportar.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Local,Vaga,Veiculo,Potencia (kW),SoC Final (%),Energia (kWh),Custo (R$),Duracao (segundos),Horario Conclusao\n";

  completedSessions.forEach(s => {
    const vType = s.vehicleType === 'standard' ? 'Compacto' : (s.vehicleType === 'commercial' ? 'Comercial' : 'Premium');
    csvContent += `"${s.localName}",${s.spotId},${vType},${s.power},${s.soc.toFixed(1)},${s.energy.toFixed(3)},${s.cost.toFixed(2)},${s.duration},"${s.endTime.toISOString()}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `relatorio_operacao_ev_charge_sp_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}

// --- LOG OCPP 1.6 ---
function initOCPPBoot() {
  const bootTimeEl = document.getElementById('bootTime');
  const bootTimeREl = document.getElementById('bootTimeR');
  const bootRespEl = document.getElementById('bootResp');

  const now = new Date();
  const timeStr = now.toLocaleTimeString();

  if (bootTimeEl) bootTimeEl.textContent = timeStr;
  if (bootTimeREl) bootTimeREl.textContent = timeStr;
  if (bootRespEl) {
    const payload = [
      3, "10000", {
        "status": "Accepted",
        "currentTime": now.toISOString(),
        "interval": 300
      }
    ];
    bootRespEl.textContent = JSON.stringify(payload, null, 2);
  }
}

function logOCPP(direction, action, payload) {
  const logContainer = document.getElementById('ocppLog');
  if (!logContainer) return;

  const timeStr = new Date().toLocaleTimeString();
  const entry = document.createElement('div');

  let dirClass = '';
  let dirLabel = '';
  if (direction === 'CALL') {
    dirClass = 'ocpp-call';
    dirLabel = '⬆ CALL';
  } else if (direction === 'RESULT') {
    dirClass = 'ocpp-result';
    dirLabel = '⬇ CALLRESULT';
  } else if (direction === 'ERROR') {
    dirClass = 'ocpp-error';
    dirLabel = '❌ CALLERROR';
  } else {
    dirClass = 'ocpp-heartbeat';
    dirLabel = '💓 HB';
  }

  entry.className = `ocpp-entry ${dirClass}`;
  entry.innerHTML = `
    <div class="ocpp-meta">
      <span class="ocpp-dir">${dirLabel}</span>
      <span class="ocpp-action">${action}</span>
      <span class="ocpp-time">${timeStr}</span>
    </div>
    <pre class="ocpp-payload">${JSON.stringify(payload, null, 2)}</pre>
  `;

  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function sendHeartbeat() {
  const msgId = Math.random().toString(36).substring(2, 9);
  logOCPP('CALL', 'Heartbeat', [2, msgId, "Heartbeat", {}]);
  setTimeout(() => {
    logOCPP('RESULT', 'Heartbeat::Response', [3, msgId, { "currentTime": new Date().toISOString() }]);
  }, 400);
}

function clearOCPPLog() {
  const logContainer = document.getElementById('ocppLog');
  if (logContainer) logContainer.innerHTML = '';
}
