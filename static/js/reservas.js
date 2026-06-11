// ─── SHARED ──────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ev_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('ev_token'); window.location.href = '/'; }

if (!getToken()) { window.location.href = '/'; }

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadActiveReservations();
});

async function loadActiveReservations() {
  const list = document.getElementById('reservationsList');
  
  try {
    const res = await fetch('/api/reservations/active', { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    
    const reservations = await res.json();
    
    if (reservations.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>Você não possui reservas ativas no momento.</p>
          <a href="/dashboard" class="btn btn-primary" style="margin-top:1rem; display:inline-block;">Fazer um agendamento</a>
        </div>
      `;
      return;
    }

    list.innerHTML = reservations.map(r => `
      <div class="reservation-card" id="res-${r.id}">
        <div class="res-info">
          <h3>${r.local}</h3>
          <p>📍 <strong>Região:</strong> ${r.regiao}</p>
          <p>🚗 <strong>Vaga:</strong> ${r.vaga}</p>
          <p>⏱️ <strong>Duração prevista:</strong> ${r.tempo_min} minutos</p>
          <p>📅 <strong>Agendado para:</strong> ${r.data_reserva || 'Não informado'}</p>
          <p style="font-size:0.75rem; color:var(--text-muted);">Registro criado em: ${r.data_hora}</p>
        </div>
        <div class="res-actions">
          <button class="btn btn-outline btn-danger" onclick="cancelReservation(${r.id})">
            Desmarcar Reserva
          </button>
        </div>
      </div>
    `).join('');

  } catch (e) {
    list.innerHTML = '<p class="error">Erro ao carregar reservas.</p>';
  }
}

async function cancelReservation(id) {
  if (!confirm('Tem certeza que deseja desmarcar esta reserva?')) return;

  try {
    const res = await fetch(`/api/reservations/cancel/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert(data.message);
      loadActiveReservations(); // Recarrega a lista
    } else {
      alert(data.error || 'Erro ao cancelar reserva.');
    }
  } catch (e) {
    alert('Erro de conexão ao tentar cancelar.');
  }
}

async function simulateNoShowCheck() {
  if (!confirm('Deseja rodar a verificação de No-Show? Isso aplicará multas de R$ 15,00 em todas as reservas atrasadas há mais de 15 minutos.')) return;

  try {
    const res = await fetch('/api/reservations/check-noshow', {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    alert(data.message);
    loadActiveReservations();
  } catch (e) {
    alert('Erro ao processar verificação.');
  }
}
