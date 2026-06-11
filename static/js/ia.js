// ─── SHARED ──────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ev_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('ev_token'); window.location.href = '/'; }

if (!getToken()) { window.location.href = '/'; }

// ─── CHAT STATE ───────────────────────────────────────────────────────────────
let isTyping = false;
let turnCount = 0;  // Contador de turnos de conversa

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  addMessage('ai', '👋 Olá! Sou o **ChargeGrid Assistant**, seu assistente inteligente de recarga de VEs.\n\n🧠 **Tenho memória de conversa** — posso me lembrar do que você disse anteriormente nesta sessão.\n\nDigite **ajuda** para ver o que posso responder ou use as sugestões abaixo!');
  document.getElementById('chatInput').focus();
  updateHistoryBadge(0);
});

// ─── SEND ─────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg || isTyping) return;
  input.value = '';

  addMessage('user', msg);
  setTyping(true);

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: msg })
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    addMessage('ai', data.response || 'Sem resposta.');

    // Atualiza contador de histórico se retornou pelo servidor
    if (data.history_length !== undefined) {
      turnCount = data.history_length;
      updateHistoryBadge(Math.floor(turnCount / 2));
    }
  } catch (e) {
    addMessage('ai', '❌ Erro de conexão. Verifique se o servidor está rodando.');
  } finally {
    setTyping(false);
  }
}

function sendSuggestion(text) {
  document.getElementById('chatInput').value = text;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ─── LIMPAR CHAT (com histórico de servidor) ──────────────────────────────────
async function clearChat() {
  // Limpa visualmente
  document.getElementById('chatMessages').innerHTML = '';

  // Limpa o histórico no servidor via DELETE
  try {
    await fetch('/api/ai/history/clear', {
      method: 'DELETE',
      headers: authHeaders()
    });
  } catch (e) {
    console.warn('Não foi possível limpar histórico no servidor:', e);
  }

  turnCount = 0;
  updateHistoryBadge(0);
  addMessage('ai', '🗑️ Conversa e memória limpas! Estou pronto para uma nova conversa. Como posso ajudar?');
}

// ─── BADGE DE HISTÓRICO ───────────────────────────────────────────────────────
function updateHistoryBadge(turns) {
  const badge = document.getElementById('historyBadge');
  if (!badge) return;
  if (turns === 0) {
    badge.textContent = '🧠 Memória: Nova sessão';
    badge.style.opacity = '0.5';
  } else {
    badge.textContent = `🧠 Memória: ${turns} trocas`;
    badge.style.opacity = '1';
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function addMessage(role, text) {
  const box = document.getElementById('chatMessages');
  const isAI = role === 'ai';

  const wrapper = document.createElement('div');
  wrapper.className = `chat-msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = isAI ? '🤖' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = formatText(text);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function setTyping(active) {
  isTyping = active;
  const btn = document.getElementById('btnSend');
  const input = document.getElementById('chatInput');
  btn.disabled = active;
  input.disabled = active;

  const existing = document.getElementById('typingIndicator');
  if (active && !existing) {
    const box = document.getElementById('chatMessages');
    const indicator = document.createElement('div');
    indicator.className = 'chat-msg ai';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
      <div class="chat-avatar">🤖</div>
      <div class="chat-bubble chat-typing">
        <span style="display:inline-flex;gap:4px;align-items:center;">
          <span style="animation:bounce 0.8s infinite 0s">●</span>
          <span style="animation:bounce 0.8s infinite 0.15s">●</span>
          <span style="animation:bounce 0.8s infinite 0.3s">●</span>
        </span>
        <style>@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}</style>
      </div>`;
    box.appendChild(indicator);
    box.scrollTop = box.scrollHeight;
  } else if (!active && existing) {
    existing.remove();
  }
}
