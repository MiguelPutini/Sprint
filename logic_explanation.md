# 🧠 Explicação da Lógica do Sistema — EV Charge SP

Este documento detalha o funcionamento interno do backend em Python (Flask), explicando como as diferentes tecnologias se integram para criar uma experiência de recarga de veículos elétricos segura e inteligente.

---

## 1. Arquitetura do Servidor e Banco de Dados

O backend utiliza o framework **Flask**. A principal característica da nossa arquitetura é o gerenciamento eficiente de recursos:

- **Conexão Sob Demanda:** Utilizamos a função `get_db()` para abrir uma conexão com o MySQL apenas quando necessário.
- **Ciclo de Vida:** Toda rota que interage com o banco segue o fluxo: `Abrir Conexão -> Executar SQL -> Commit (se houver alteração) -> Fechar Conexão`. Isso evita vazamentos de memória e conexões "penduradas".

```python
def get_db():
    return mysql.connector.connect(**DB_CONFIG)
```

---

## 2. Fluxo de Segurança e Autenticação

A segurança é baseada em duas frentes: proteção de dados sensíveis e controle de acesso.

### Criptografia de Senhas (Bcrypt)
Ao registrar um usuário, a senha nunca é salva em texto puro. Usamos o **Bcrypt** para gerar um "hash" único. No login, comparamos o hash salvo com a senha digitada.

### Proteção de Rotas (JWT)
Após o login, o servidor gera um token **JWT (JSON Web Token)**. Esse token é enviado em todas as requisições subsequentes.
O decorador `@token_required` funciona como um "pedágio": ele intercepta a requisição, valida o token e extrai o `user_id` antes de permitir que a lógica da rota seja executada.

```python
@token_required
def rota_protegida(uid):
    # 'uid' é extraído do token e usado para identificar o usuário
```

---

## 3. Lógica de Recarga e Cálculos de Potência

O simulador de recarga não usa valores aleatórios. Ele calcula a **Potência Real** de carregamento baseada em três limitadores:

1.  **Limite do Plano do Usuário** (ex: 7kW, 11kW ou 22kW).
2.  **Capacidade da Rede Elétrica** (simulada em 20kW).
3.  **Limite do Carregador Físico** (simulado em 21.4kW).

O sistema usa a função `Math.min()` para definir que a potência real será sempre o menor desses valores, garantindo segurança elétrica e fidelidade ao plano contratado.

---

## 4. Sistema de Reservas e "No-Show"

### Agendamento
As reservas são inseridas na tabela `reservas` com o status `ativa`. Diferente da recarga imediata, a reserva é gratuita no ato do agendamento, permitindo que o usuário escolha um local, dia e horário.

### Taxa de Cancelamento e Multa
- **Cancelamento:** O usuário pode remover a reserva via API `DELETE`, o que simplesmente muda o status para `cancelada`.
- **Lógica de No-Show:** Foi implementado um sistema de verificação (`/api/reservations/check-noshow`) que identifica reservas cujo horário já passou há mais de 15 minutos sem que uma recarga tenha sido iniciada. Nesse caso:
    - O status muda para `no-show`.
    - Uma multa fixa de **R$ 15,00** é debitada do saldo do usuário como penalidade por bloquear a vaga.

---

## 5. Inteligência Artificial com Injeção de Contexto

Este é o componente mais avançado do sistema. Em vez de uma IA genérica, usamos a técnica de **Injeção de Contexto (RAG - Retrieval-Augmented Generation)**:

1.  **Extração de Fatos:** Quando o usuário pergunta algo, o Flask busca no MySQL o nome, saldo, plano, histórico de recargas e reservas ativas desse usuário específico.
2.  **Construção do Prompt de Sistema:** Criamos uma "instrução mestra" que contém todos esses fatos reais.
3.  **Processamento:** Enviamos para o modelo `gpt-4o-mini` a pergunta do usuário + as instruções + os dados reais.
4.  **Resultado:** A IA responde de forma personalizada (ex: "Olá Miguel, notei que você gastou R$ 45,00 na sua última recarga no Shopping Interlagos").

---

## 6. Fluxo de uma Sessão Completa

1.  **Auth:** Usuário faz login e recebe um JWT.
2.  **Dashboard:** O JS usa o JWT para buscar o plano e locais.
3.  **Ação:** O usuário escolhe entre **Carregar Agora** (débito imediato) ou **Agendar** (reserva gratuita).
4.  **Simulação:** Se carregar agora, o frontend simula o ganho de energia e o custo em tempo real.
5.  **Finalização:** Os dados finais (kWh consumidos, custo real) são persistidos na tabela `recargas`.
