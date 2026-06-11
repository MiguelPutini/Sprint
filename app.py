from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector
import bcrypt
import jwt
import datetime
import os
from openai import OpenAI, APIError, AuthenticationError
from functools import wraps
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv(override=True)

# ─── CONVERSATION HISTORY (in-memory, por sessão de usuário) ──────────────────
# Armazena até MAX_HISTORY mensagens por usuário para manter contexto de diálogo
MAX_HISTORY = 20
conversation_history = defaultdict(list)  # {user_id: [{role, content}, ...]}

app = Flask(__name__)
CORS(app)

JWT_SECRET = os.getenv('JWT_SECRET', 'recarga_inteligente_jwt_secret_2024')
JWT_ALGORITHM = 'HS256'

key = os.getenv('OPENAI_API_KEY')
if not key:
    print("[AVISO] OPENAI_API_KEY nao encontrada no .env")
else:
    # Mostra apenas o início e fim da chave para confirmar que foi carregada
    print(f"[OK] OpenAI API Key carregada: {key[:5]}...{key[-4:] if len(key) > 4 else ''}")

client = OpenAI(api_key=key)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'Miguel741414@'),
    'database': os.getenv('DB_NAME', 'recarga_inteligente'),
    'charset': 'utf8mb4'
}

LOCATIONS = {
    'Zona Sul': [
        {'id': 1, 'nome': 'Shopping Interlagos', 'endereco': 'Av. Interlagos, 2255'},
        {'id': 2, 'nome': 'Metrô Jabaquara', 'endereco': 'R. Maestro Cardim, 1100'},
        {'id': 3, 'nome': 'Supermercado Extra — Saúde', 'endereco': 'R. Domingos de Morais, 2564'},
    ],
    'Zona Leste': [
        {'id': 4, 'nome': 'Shopping Aricanduva', 'endereco': 'Av. Aricanduva, 5555'},
        {'id': 5, 'nome': 'Metrô Itaquera', 'endereco': 'Praça Pedro Braido, s/n'},
        {'id': 6, 'nome': 'Shopping Anália Franco', 'endereco': 'Av. Regente Feijó, 1739'},
    ],
    'Zona Oeste': [
        {'id': 7, 'nome': 'Shopping Iguatemi', 'endereco': 'Av. Brig. Faria Lima, 2232'},
        {'id': 8, 'nome': 'Metrô Faria Lima', 'endereco': 'Av. Brig. Faria Lima, s/n'},
        {'id': 9, 'nome': 'Shopping West Plaza', 'endereco': 'Av. Antártica, 381'},
    ],
    'Zona Norte': [
        {'id': 10, 'nome': 'Shopping Center Norte', 'endereco': 'Travessa Casalbuono, 120'},
        {'id': 11, 'nome': 'Metrô Santana', 'endereco': 'Av. Cruzeiro do Sul, 1775'},
        {'id': 12, 'nome': 'Shopping Pátio Paulista', 'endereco': 'R. Treze de Maio, 1947'},
    ],
}


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip()
        if not token:
            return jsonify({'error': 'Token necessário'}), 401
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            current_user_id = data['user_id']
        except Exception:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        return f(current_user_id, *args, **kwargs)
    return decorated


# ─── TEMPLATE ROUTES ────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/perfil')
def perfil():
    return render_template('perfil.html')

@app.route('/recarga')
def recarga():
    return render_template('recarga.html')

@app.route('/ia')
def ia():
    return render_template('ia.html')

@app.route('/reservas')
def reservas_page():
    return render_template('reservas.html')


# ─── AUTH ────────────────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json or {}
    nome = data.get('nome', '').strip()
    email = data.get('email', '').strip().lower()
    senha = data.get('senha', '')

    if not all([nome, email, senha]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
    if len(senha) < 6:
        return jsonify({'error': 'A senha deve ter ao menos 6 caracteres'}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT id FROM usuarios WHERE email = %s', (email,))
        if cursor.fetchone():
            return jsonify({'error': 'Este email já está cadastrado'}), 409

        senha_hash = bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()
        cursor.execute(
            'INSERT INTO usuarios (nome, email, senha_hash) VALUES (%s, %s, %s)',
            (nome, email, senha_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.execute(
            'INSERT INTO transacoes (usuario_id, tipo, valor, descricao) VALUES (%s, %s, %s, %s)',
            (user_id, 'sistema', 0, 'Conta criada com sucesso')
        )
        conn.commit()

        token = jwt.encode(
            {'user_id': user_id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)},
            JWT_SECRET, algorithm=JWT_ALGORITHM
        )
        return jsonify({'token': token, 'message': 'Cadastro realizado com sucesso!'})
    finally:
        cursor.close()
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    senha = data.get('senha', '')

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM usuarios WHERE email = %s', (email,))
        user = cursor.fetchone()
        if not user or not bcrypt.checkpw(senha.encode(), user['senha_hash'].encode()):
            return jsonify({'error': 'Email ou senha incorretos'}), 401

        token = jwt.encode(
            {'user_id': user['id'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)},
            JWT_SECRET, algorithm=JWT_ALGORITHM
        )
        return jsonify({'token': token, 'message': 'Login realizado!'})
    finally:
        cursor.close()
        conn.close()


# ─── PERFIL ───────────────────────────────────────────────────────────────────
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(uid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT id, nome, email, credito, plano, potencia_max, data_cadastro FROM usuarios WHERE id = %s',
            (uid,)
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        user['credito'] = float(user['credito'] or 0)
        user['potencia_max'] = float(user['potencia_max']) if user['potencia_max'] else None
        user['data_cadastro'] = user['data_cadastro'].strftime('%d/%m/%Y')
        return jsonify(user)
    finally:
        cursor.close()
        conn.close()


@app.route('/api/profile/plan', methods=['PUT'])
@token_required
def update_plan(uid):
    data = request.json or {}
    plano = data.get('plano', '')
    planos = {'Básico': 7, 'Intermediário': 11, 'Premium': 22}
    if plano not in planos:
        return jsonify({'error': 'Plano inválido'}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE usuarios SET plano = %s, potencia_max = %s WHERE id = %s',
            (plano, planos[plano], uid)
        )
        conn.commit()
        return jsonify({'message': f'Plano {plano} ativado com sucesso!'})
    finally:
        cursor.close()
        conn.close()


@app.route('/api/profile/credits', methods=['POST'])
@token_required
def add_credits(uid):
    data = request.json or {}
    try:
        valor = float(data.get('valor', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Valor inválido'}), 400
    if valor <= 0:
        return jsonify({'error': 'Valor deve ser maior que zero'}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('UPDATE usuarios SET credito = credito + %s WHERE id = %s', (valor, uid))
        cursor.execute(
            'INSERT INTO transacoes (usuario_id, tipo, valor, descricao) VALUES (%s, %s, %s, %s)',
            (uid, 'credito', valor, f'Adição de créditos — R$ {valor:.2f}')
        )
        conn.commit()
        cursor.execute('SELECT credito FROM usuarios WHERE id = %s', (uid,))
        row = cursor.fetchone()
        return jsonify({'message': f'R$ {valor:.2f} adicionados!', 'credito': float(row['credito'])})
    finally:
        cursor.close()
        conn.close()


@app.route('/api/transactions', methods=['GET'])
@token_required
def get_transactions(uid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT * FROM transacoes WHERE usuario_id = %s ORDER BY data_hora DESC LIMIT 20', (uid,)
        )
        rows = cursor.fetchall()
        for r in rows:
            r['valor'] = float(r['valor'])
            r['data_hora'] = r['data_hora'].strftime('%d/%m/%Y %H:%M')
        return jsonify(rows)
    finally:
        cursor.close()
        conn.close()


# ─── LOCAIS & VAGAS ──────────────────────────────────────────────────────────
@app.route('/api/locations', methods=['GET'])
@token_required
def get_locations(uid):
    return jsonify(LOCATIONS)


@app.route('/api/spots', methods=['GET'])
@token_required
def get_spots(uid):
    import random
    spots = []
    for row in ['A', 'B']:
        for col in range(1, 4):
            weights = ['L', 'L', 'L', 'R', 'O']
            spots.append({
                'id': f'{row}{col}',
                'row': row,
                'col': col,
                'status': random.choice(weights)
            })
    return jsonify(spots)


# ─── RESERVAS ────────────────────────────────────────────────────────────────
@app.route('/api/reservations', methods=['POST'])
@token_required
def create_reservation(uid):
    data = request.json or {}
    regiao = data.get('regiao', '')
    local = data.get('local', '')
    vaga = data.get('vaga', '')
    try:
        tempo_min = int(data.get('tempo_min', 30))
    except (ValueError, TypeError):
        return jsonify({'error': 'Tempo inválido'}), 400

    data_reserva = data.get('data_reserva')  # Novo campo

    valor_reserva = 0.00  # Reserva agora é gratuita

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # A reserva agora não desconta saldo no ato, mas cria o registro
        cursor.execute(
            'INSERT INTO reservas (usuario_id, regiao, local, vaga, tempo_min, valor, status, data_reserva) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
            (uid, regiao, local, vaga, tempo_min, valor_reserva, 'ativa', data_reserva)
        )
        reserva_id = cursor.lastrowid
        cursor.execute(
            'INSERT INTO transacoes (usuario_id, tipo, valor, descricao) VALUES (%s,%s,%s,%s)',
            (uid, 'sistema', 0, f'Reserva agendada: {vaga} — {local}')
        )
        conn.commit()
        return jsonify({
            'message': 'Reserva confirmada! Lembre-se: caso não compareça, uma taxa de não-comparecimento será aplicada.', 
            'reserva_id': reserva_id,
            'valor': valor_reserva, 
            'tempo_min': tempo_min
        })
    finally:
        cursor.close()
        conn.close()


@app.route('/api/reservations/active', methods=['GET'])
@token_required
def get_active_reservations(uid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT * FROM reservas WHERE usuario_id = %s AND status = "ativa" ORDER BY data_hora DESC', (uid,)
        )
        rows = cursor.fetchall()
        for r in rows:
            r['valor'] = float(r['valor'])
            r['data_hora'] = r['data_hora'].strftime('%d/%m/%Y %H:%M')
            if r['data_reserva']:
                r['data_reserva'] = r['data_reserva'].strftime('%d/%m/%Y %H:%M')
        return jsonify(rows)
    finally:
        cursor.close()
        conn.close()


@app.route('/api/reservations/cancel/<int:res_id>', methods=['DELETE'])
@token_required
def cancel_reservation(uid, res_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # Verificar se a reserva pertence ao usuário e está ativa
        cursor.execute('SELECT * FROM reservas WHERE id = %s AND usuario_id = %s AND status = "ativa"', (res_id, uid))
        reserva = cursor.fetchone()
        
        if not reserva:
            return jsonify({'error': 'Reserva não encontrada ou já cancelada'}), 404

        # Cancelar reserva
        cursor.execute('UPDATE reservas SET status = "cancelada" WHERE id = %s', (res_id,))
        cursor.execute(
            'INSERT INTO transacoes (usuario_id, tipo, valor, descricao) VALUES (%s,%s,%s,%s)',
            (uid, 'sistema', 0, f'Cancelamento de reserva: {reserva["vaga"]} — {reserva["local"]}')
        )
        conn.commit()
        return jsonify({'message': 'Reserva cancelada com sucesso!'})
    finally:
        cursor.close()
        conn.close()


@app.route('/api/reservations/check-noshow', methods=['POST'])
@token_required
def check_noshows(uid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # Busca reservas ativas cujo horário agendado já passou há mais de 15 minutos
        # Usamos 15 minutos de tolerância
        cursor.execute("""
            SELECT id, usuario_id, vaga, local, valor 
            FROM reservas 
            WHERE status = 'ativa' 
            AND data_reserva < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        """)
        overdue = cursor.fetchall()
        
        if not overdue:
            return jsonify({'message': 'Nenhuma reserva vencida encontrada.'})

        count = 0
        penalty = 15.00
        for res in overdue:
            # 1. Marcar como no-show
            cursor.execute('UPDATE reservas SET status = "no-show" WHERE id = %s', (res['id'],))
            
            # 2. Descontar do saldo do usuário
            cursor.execute('UPDATE usuarios SET credito = credito - %s WHERE id = %s', (penalty, res['usuario_id']))
            
            # 3. Registrar transação
            cursor.execute(
                'INSERT INTO transacoes (usuario_id, tipo, valor, descricao) VALUES (%s,%s,%s,%s)',
                (res['usuario_id'], 'debito', penalty, f'Taxa No-Show: {res["vaga"]} em {res["local"]}')
            )
            count += 1
        
        conn.commit()
        return jsonify({'message': f'Verificação concluída. {count} multa(s) aplicada(s).'})
    finally:
        cursor.close()
        conn.close()


# ─── RECARGA ─────────────────────────────────────────────────────────────────
@app.route('/api/charging/start', methods=['POST'])
@token_required
def start_charging(uid):
    data = request.json or {}
    regiao = data.get('regiao', '')
    local = data.get('local', '')
    vaga = data.get('vaga', '')
    try:
        tempo_min = int(data.get('tempo_min', 30))
    except (ValueError, TypeError):
        return jsonify({'error': 'Tempo inválido'}), 400

    tensao, corrente, fator = 380, 32, 1.73
    pot_carregador = (tensao * corrente * fator) / 1000
    pot_carro = 22
    pot_rede = 20

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT plano, potencia_max, credito FROM usuarios WHERE id = %s', (uid,))
        user = cursor.fetchone()
        pot_plano = float(user['potencia_max']) if user['potencia_max'] else 7

        pot_real = min(pot_carregador, pot_carro, pot_rede, pot_plano)
        energia_kwh = round((pot_real * tempo_min) / 60, 3)
        custo = round(energia_kwh * 1.8, 2)

        if float(user['credito']) < custo:
            return jsonify({'error': f'Crédito insuficiente. Necessário R$ {custo:.2f}'}), 400

        cursor.execute('UPDATE usuarios SET credito = credito - %s WHERE id = %s', (custo, uid))
        cursor.execute(
            'INSERT INTO recargas (usuario_id, regiao, local, vaga, energia_kwh, custo, potencia_real, status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
            (uid, regiao, local, vaga, energia_kwh, custo, round(pot_real, 2), 'concluida')
        )
        recarga_id = cursor.lastrowid
        cursor.execute(
            'INSERT INTO transacoes (usuario_id, tipo, valor, descricao) VALUES (%s,%s,%s,%s)',
            (uid, 'debito', custo, f'Recarga {energia_kwh} kWh — {local}')
        )
        conn.commit()
        cursor.execute('SELECT credito FROM usuarios WHERE id = %s', (uid,))
        novo = cursor.fetchone()

        return jsonify({
            'recarga_id': recarga_id,
            'potencia_real': round(pot_real, 2),
            'potencia_carregador': round(pot_carregador, 2),
            'potencia_rede': pot_rede,
            'potencia_plano': pot_plano,
            'energia_kwh': energia_kwh,
            'custo': custo,
            'tempo_min': tempo_min,
            'credito_restante': float(novo['credito']),
            'plano': user['plano']
        })
    finally:
        cursor.close()
        conn.close()


@app.route('/api/recharges', methods=['GET'])
@token_required
def get_recharges(uid):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT * FROM recargas WHERE usuario_id = %s ORDER BY data_hora DESC LIMIT 10', (uid,)
        )
        rows = cursor.fetchall()
        for r in rows:
            r['energia_kwh'] = float(r['energia_kwh'])
            r['custo'] = float(r['custo'])
            r['potencia_real'] = float(r['potencia_real'])
            r['data_hora'] = r['data_hora'].strftime('%d/%m/%Y %H:%M')
        return jsonify(rows)
    finally:
        cursor.close()
        conn.close()


# ─── IA CHAT ─────────────────────────────────────────────────────────────────
@app.route('/api/ai/chat', methods=['POST'])
@token_required
def ai_chat(uid):
    data = request.json or {}
    user_msg = data.get('message', '').strip()
    clear_history = data.get('clear_history', False)

    if not user_msg and not clear_history:
        return jsonify({'error': 'Mensagem vazia'}), 400

    # Limpar histórico se solicitado
    if clear_history:
        conversation_history[uid] = []
        return jsonify({'response': '🗑️ Histórico de conversa limpo com sucesso!'})

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Buscar Dados do Usuário
        cursor.execute('SELECT nome, email, credito, plano, potencia_max, data_cadastro FROM usuarios WHERE id = %s', (uid,))
        user = cursor.fetchone()

        # 2. Buscar Estatísticas Gerais
        cursor.execute('SELECT COALESCE(SUM(custo),0) as gasto_total, COALESCE(SUM(energia_kwh),0) as energia_total, COUNT(*) as qtd_recargas FROM recargas WHERE usuario_id=%s', (uid,))
        stats = cursor.fetchone()

        # 3. Buscar Últimas Recargas
        cursor.execute('SELECT local, regiao, vaga, energia_kwh, custo, potencia_real, data_hora FROM recargas WHERE usuario_id=%s ORDER BY data_hora DESC LIMIT 5', (uid,))
        recharge_history = cursor.fetchall()
        for r in recharge_history:
            r['data_hora'] = r['data_hora'].strftime('%d/%m/%Y %H:%M')
            r['energia_kwh'] = float(r['energia_kwh'])
            r['custo'] = float(r['custo'])
            r['potencia_real'] = float(r['potencia_real'])

        # 4. Buscar Últimas Reservas
        cursor.execute('SELECT local, vaga, tempo_min, valor, status, data_hora FROM reservas WHERE usuario_id=%s ORDER BY data_hora DESC LIMIT 3', (uid,))
        reservations = cursor.fetchall()
        for res in reservations:
            res['data_hora'] = res['data_hora'].strftime('%d/%m/%Y %H:%M')
            res['valor'] = float(res['valor'])

        # ─── Construção do System Prompt com Few-Shot Examples ────────────────
        system_prompt = f"""Você é o **ChargeGrid Assistant**, o assistente inteligente do sistema de Recarga de Veículos Elétricos da GoodWe — projeto desenvolvido para o EV Challenge 2026.

Sua missão é ajudar usuários a gerenciar suas recargas de veículos elétricos na cidade de São Paulo de forma eficiente, sustentável e personalizada.

═══════════════════════════════════════════
📋 DIRETRIZES DE COMPORTAMENTO:
═══════════════════════════════════════════
1. Sempre se dirija ao usuário pelo nome: **{user['nome']}**.
2. Responda APENAS sobre temas relacionados a: recargas de VEs, planos, saldo, reservas, sustentabilidade e tecnologia de carregamento.
3. Se perguntado sobre temas externos (esportes, política, entretenimento, etc.), recuse educadamente e redirecione ao contexto de VEs.
4. Use os DADOS REAIS do banco abaixo. Nunca invente valores.
5. Formate respostas com Markdown: **negrito**, listas com -, etc.
6. Seja conciso, mas completo. Máximo de 4 parágrafos.

═══════════════════════════════════════════
📊 DADOS REAIS DA CONTA DE {user['nome'].upper()}:
═══════════════════════════════════════════
- 💰 Saldo Atual: R$ {float(user['credito']):.2f}
- 📅 Membro desde: {user['data_cadastro'].strftime('%d/%m/%Y')}
- ⚡ Plano Ativo: {user['plano'] or 'Nenhum (padrão 7kW)'}
- 🔋 Potência Máxima: {float(user['potencia_max']) if user['potencia_max'] else 7:.1f} kW
- 💸 Total Gasto em Recargas: R$ {float(stats['gasto_total']):.2f}
- 🌱 Energia Consumida: {float(stats['energia_total']):.2f} kWh
- 🔌 Total de Sessões: {int(stats['qtd_recargas'])}

ÚLTIMAS RECARGAS:
{recharge_history if recharge_history else '- Nenhuma recarga registrada ainda.'}

RESERVAS RECENTES:
{reservations if reservations else '- Nenhuma reserva registrada ainda.'}

═══════════════════════════════════════════
ℹ️ INFORMAÇÕES DO SISTEMA ChargeGrid:
═══════════════════════════════════════════
- Rede de carregadores em: Zona Sul, Leste, Oeste e Norte de SP.
- Tarifa: R$ 1,80 por kWh.
- Reserva de vaga: Totalmente gratuita.
- Cancelamento: Gratuito a qualquer momento antes do horário.
- Multa por No-Show: R$ 15,00 (aplicada se o usuário não comparecer e não cancelar).
- Planos disponíveis: Básico (7kW) | Intermediário (11kW) | Premium (22kW).
- Tecnologia: Carregadores trifásicos 380V / 32A (potência máxima física: ~21,4 kW).

═══════════════════════════════════════════
💡 EXEMPLOS DE RESPOSTAS (Few-Shot):
═══════════════════════════════════════════
Usuário: "Qual meu saldo?"
Assistente: "Olá, **{user['nome']}**! Seu saldo atual é de **R$ {float(user['credito']):.2f}**. Com esse valor, você pode realizar aproximadamente **{float(user['credito']) / 1.80:.1f} kWh** de recarga. Precisa adicionar créditos?"

Usuário: "Quem ganhou o campeonato ontem?"
Assistente: "Desculpe, **{user['nome']}**, mas meu escopo é o sistema ChargeGrid de recargas de VEs. Não tenho acesso a informações sobre esportes. Posso te ajudar com seu histórico de recargas ou gerenciar suas reservas?"
"""

        # ─── Gerenciamento do Histórico de Conversa (Memória) ────────────────
        # Adiciona a nova mensagem do usuário ao histórico
        conversation_history[uid].append({"role": "user", "content": user_msg})

        # Monta a lista de mensagens: [system] + [histórico limitado]
        history_window = conversation_history[uid][-(MAX_HISTORY):]
        messages = [{"role": "system", "content": system_prompt}] + history_window

        # ─── Chamada à API OpenAI ─────────────────────────────────────────────
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=600
        )

        ai_response = response.choices[0].message.content

        # Salva a resposta da IA no histórico
        conversation_history[uid].append({"role": "assistant", "content": ai_response})

        # Limita o histórico ao máximo definido para evitar crescimento infinito
        if len(conversation_history[uid]) > MAX_HISTORY:
            conversation_history[uid] = conversation_history[uid][-MAX_HISTORY:]

        return jsonify({
            'response': ai_response,
            'history_length': len(conversation_history[uid])
        })

    except AuthenticationError:
        msg = "⚠️ **Erro de Configuração:** A chave da API OpenAI não foi encontrada ou é inválida. Por favor, configure a variável de ambiente `OPENAI_API_KEY` no arquivo `.env`."
        print("[AUTH ERROR] Chave da API invalida ou nao encontrada.")
        return jsonify({'response': msg})
    except APIError as e:
        msg = f"🔌 **Erro na API OpenAI:** Problema de conexão. Tente novamente em instantes. (Detalhe: {e})"
        print(f"[API ERROR] {str(e).encode('ascii', 'ignore').decode('ascii')}")
        return jsonify({'response': msg})
    except Exception as e:
        msg = "🤯 **Erro Inesperado:** Desculpe, ocorreu um problema interno. Por favor, tente novamente."
        print(f"[CHAT ERROR] {type(e).__name__}: {str(e).encode('ascii', 'ignore').decode('ascii')}")
        return jsonify({'response': msg})
    finally:
        cursor.close()
        conn.close()


@app.route('/api/ai/history/clear', methods=['DELETE'])
@token_required
def clear_chat_history(uid):
    """Limpa o histórico de conversa do usuário em memória."""
    cleared = len(conversation_history.get(uid, []))
    conversation_history[uid] = []
    return jsonify({'message': f'Histórico limpo. {cleared} mensagens removidas.'})


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    print(f"\n=== EV CHARGE SP ===")
    print(f"Servidor rodando em http://localhost:{port}")
    print(f"Banco: {DB_CONFIG['database']}@{DB_CONFIG['host']}")
    print(f"====================\n")
    app.run(debug=True, port=port)
