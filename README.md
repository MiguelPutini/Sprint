# ⚡ ChargeGrid Intelligence — EV Charge SP
### GoodWe · EV Challenge 2026 | Sprint 2

Sistema full-stack de gestão e recarga de veículos elétricos na cidade de São Paulo, com **assistente de IA integrado** baseado em GPT-4o-mini, memória de conversa e context injection com dados reais do banco de dados.

---

## 🤖 Sobre o Assistente IA (ChargeGrid Assistant)

O **ChargeGrid Assistant** é o núcleo inteligente do sistema, desenvolvido com técnicas avançadas de engenharia de prompt para o **EV Challenge 2026**.

### Técnicas Implementadas

| Técnica | Descrição |
|---|---|
| **Context Injection** | Dados reais do banco (saldo, plano, histórico de recargas, reservas) são injetados no system prompt a cada requisição |
| **Few-Shot Prompting** | Exemplos de Q&A inseridos no prompt guiam o comportamento e o tom da IA |
| **Conversation Memory** | Histórico de até 20 mensagens mantido em memória por usuário, permitindo diálogos multi-turno |
| **Scope Control** | Instruções explícitas restringem o escopo ao contexto de VEs, com exemplos de recusa |

### Parâmetros do Modelo

```python
model       = "gpt-4o-mini"   # Equilíbrio custo/performance
temperature = 0.7             # Natural, mas preciso
max_tokens  = 600             # Respostas completas
max_history = 20 mensagens    # ~10 trocas por sessão
```

---

## 🚀 Funcionalidades do Sistema

- **Autenticação:** Login e cadastro com criptografia Bcrypt + sessões JWT.
- **Gestão de Créditos:** Adição de saldo para pagamento de recargas.
- **Planos Customizados:** Básico (7kW) | Intermediário (11kW) | Premium (22kW).
- **Mapa de Vagas:** Seleção de vagas em tempo real por região de SP.
- **Simulador de Recarga:** Monitoramento visual do progresso e energia consumida.
- **Reservas Inteligentes:** Agendamento gratuito com política de multa por no-show (R$ 15,00).
- **Assistente IA:** Chat contextualizado com memória de conversa e dados reais da conta.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| **Frontend** | HTML5, CSS3 (Dark Theme Premium), JavaScript Vanilla |
| **Backend** | Python 3.10+ com Flask |
| **IA** | OpenAI GPT-4o-mini API |
| **Banco de Dados** | MySQL |
| **Segurança** | JWT (sessões) + Bcrypt (senhas) |
| **Config** | python-dotenv (variáveis de ambiente) |

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (baseado no `.env.example`):

```env
# ─── OpenAI API ───────────────────────────────────────────
# Obtenha em: https://platform.openai.com/api-keys
# NUNCA exponha esta chave no código ou no repositório!
OPENAI_API_KEY=sk-...sua_chave_aqui...

# ─── Banco de Dados MySQL ─────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=recarga_inteligente

# ─── Flask ────────────────────────────────────────────────
FLASK_PORT=5000
JWT_SECRET=troque_por_uma_string_secreta_longa
```

> ⚠️ **Segurança:** O arquivo `.env` já está no `.gitignore`. **Nunca** faça commit da sua API Key.

---

## 📦 Como Rodar o Projeto (Localmente)

### Pré-requisitos

- Python 3.10+
- MySQL instalado e rodando
- Uma chave de API da OpenAI

### Passo a Passo

**1. Clone o repositório:**
```bash
git clone https://github.com/SEU_USUARIO/SEU_REPO.git
cd SEU_REPO
```

**2. Instale as dependências:**
```bash
pip install -r requirements.txt
```

**3. Configure o banco de dados:**

Importe o schema no MySQL Workbench ou via terminal:
```bash
mysql -u root -p < database/schema.sql
```

**4. Configure as variáveis de ambiente:**
```bash
# Copie o arquivo de exemplo
copy .env.example .env
# Edite o .env com suas credenciais
```

**5. Execute o servidor:**
```bash
python app.py
```

**6. Acesse no navegador:**
```
http://localhost:5000
```

---

## 🧪 Como Rodar no Google Colab (Versão Standalone)

O arquivo `chatbot_goodwe_colab.py` é a versão independente do chatbot para execução no Google Colab, **sem necessidade de MySQL ou servidor Flask**.

### Passo a Passo no Colab

1. Acesse [colab.research.google.com](https://colab.research.google.com/) e crie um novo notebook.

2. **Configure sua API Key com segurança:**
   - No painel lateral, clique no ícone de **🔑 Secrets**
   - Adicione um secret chamado `OPENAI_API_KEY` com sua chave

3. **Instale as dependências** (Célula 1):
```python
!pip install openai --quiet
```

4. **Cole e execute o conteúdo** do arquivo `chatbot_goodwe_colab.py` nas células seguintes.

5. **Escolha o modo de execução:**
   - `[1]` Chat interativo
   - `[2]` Executar os 5 casos de teste da Sprint 1
   - `[3]` Testes + Chat interativo

---

## 📊 Resultados dos Testes (Sprint 2)

Os 5 casos de teste do modelo da Sprint 1 foram executados e documentados em [`sprint2_test_results.md`](./sprint2_test_results.md).

| # | Caso de Teste | Resultado |
|---|---|---|
| 1 | Consulta de Saldo e Data de Cadastro | ✅ Adequada |
| 2 | Histórico de Gastos | ✅ Adequada |
| 3 | Detalhes do Plano | ✅ Adequada |
| 4 | Localização e Reservas | ✅ Adequada |
| 5 | Escopo (Out-of-Scope) | ✅ Adequada |

**Taxa de sucesso: 5/5 (100%)** — Veja o relatório completo em [`sprint2_test_results.md`](./sprint2_test_results.md).

---

## 🔌 Endpoints da API

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/register` | Cadastro de usuário |
| `POST` | `/api/login` | Login (retorna JWT) |

### Perfil
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/profile` | Dados do usuário |
| `PUT` | `/api/profile/plan` | Atualizar plano |
| `POST` | `/api/profile/credits` | Adicionar créditos |
| `GET` | `/api/transactions` | Histórico de transações |

### Recarga e Reservas
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/charging/start` | Iniciar recarga |
| `GET` | `/api/recharges` | Histórico de recargas |
| `POST` | `/api/reservations` | Criar reserva |
| `GET` | `/api/reservations/active` | Reservas ativas |
| `DELETE` | `/api/reservations/cancel/<id>` | Cancelar reserva |

### Assistente IA
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/ai/chat` | Enviar mensagem ao assistente |
| `DELETE` | `/api/ai/history/clear` | Limpar histórico de conversa |

#### Exemplo de uso da API do chat:
```bash
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{"message": "Qual é o meu saldo atual?"}'
```

Resposta:
```json
{
  "response": "Olá, João! Seu saldo atual é de **R$ 87,50**...",
  "history_length": 2
}
```

---

## 📁 Estrutura do Projeto

```
Sprint-de-ia/
├── app.py                      # Backend Flask + IA (principal)
├── chatbot_goodwe_colab.py     # Versão standalone para Google Colab
├── requirements.txt            # Dependências Python
├── .env.example                # Modelo de variáveis de ambiente
├── .gitignore                  # Exclui .env e arquivos sensíveis
│
├── database/
│   └── schema.sql              # Schema do banco de dados MySQL
│
├── static/
│   ├── css/                    # Estilos (dark theme premium)
│   └── js/
│       └── ia.js               # Frontend do chatbot com memória
│
├── templates/
│   ├── index.html              # Página de login/cadastro
│   ├── dashboard.html          # Dashboard principal
│   ├── recarga.html            # Simulador de recarga
│   ├── ia.html                 # Interface do chatbot
│   └── reservas.html           # Gestão de reservas
│
├── README.md                   # Este arquivo
├── logic_explanation.md        # Explicação técnica do sistema
├── ai_test_model.md            # Modelo de testes da Sprint 1
└── sprint2_test_results.md     # Resultados dos testes da Sprint 2
```

---

## 🎥 Vídeo de Demonstração

> 📹 Link do vídeo: **[A ser adicionado após gravação]**

O vídeo demonstra:
1. Login no sistema e acesso ao assistente
2. Consulta de saldo e histórico de recargas (context injection)
3. Diálogo multi-turno mostrando a memória de conversa
4. Teste de escopo com pergunta fora do tema (GoodWe EV Challenge)

---

## 👥 Integrantes do Grupo

| Nome | RM |
|---|---|
| [Nome 1] | [RM] |
| [Nome 2] | [RM] |
| [Nome 3] | [RM] |

---

*Desenvolvido para o Sprint de IA — FIAP · 2026*
