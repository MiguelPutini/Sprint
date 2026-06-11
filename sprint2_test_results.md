# 🧪 Sprint 2 — Relatório de Testes do Chatbot ChargeGrid

## Contexto
- **Modelo de IA:** GPT-4o-mini (OpenAI)
- **Temperatura:** 0.7
- **Técnicas aplicadas:** Context Injection, Few-Shot Prompting, Conversation Memory
- **Data de execução:** Junho/2026
- **Projeto:** GoodWe — EV Challenge 2026

---

## Dados de Usuário Usados nos Testes (Simulado)

| Campo | Valor |
|---|---|
| Nome | João Silva |
| Saldo | R$ 87,50 |
| Plano | Intermediário (11 kW) |
| Membro desde | 15/03/2025 |
| Total gasto | R$ 142,20 |
| Energia consumida | 78,99 kWh |
| Total de sessões | 12 |

---

## Casos de Teste

---

### ✅ Caso 1 — Consulta de Saldo e Data de Cadastro

**Pergunta enviada:**
> "Olá! Qual é o meu saldo atual e quando eu me cadastrei?"

**Resposta obtida:**
> "Olá, **João Silva**! É um prazer ajudar. Seu saldo atual no sistema é de **R$ 87,50**. Você faz parte da nossa comunidade desde **15/03/2025**. Com esse saldo, você pode realizar aproximadamente **48,6 kWh** de recarga. Precisa de ajuda para adicionar mais créditos ou encontrar um local de recarga?"

**Avaliação:** ✅ **Adequada**

**Justificativa:** A IA utilizou corretamente os dados injetados via system prompt (saldo e data de cadastro), personalizou pelo nome do usuário, calculou corretamente o kWh equivalente e fez uma sugestão proativa alinhada ao contexto.

---

### ✅ Caso 2 — Histórico de Gastos

**Pergunta enviada:**
> "Quanto eu já gastei no total com recargas até agora?"

**Resposta obtida:**
> "Com base nos seus registros, **João Silva**, você já investiu um total de **R$ 142,20** em sessões de recarga. Isso resultou em um consumo acumulado de **78,99 kWh** em **12 sessões**. Sua última recarga foi no **Shopping Interlagos (Zona Sul)**, onde carregou **11 kWh** por **R$ 19,80**. Gostaria de ver mais detalhes ou comparar com outros locais?"

**Avaliação:** ✅ **Adequada**

**Justificativa:** A IA consolidou corretamente todas as estatísticas de uso (gasto total, energia, número de sessões) e complementou com informação da última recarga, demonstrando bom uso do contexto fornecido.

---

### ✅ Caso 3 — Detalhes do Plano

**Pergunta enviada:**
> "Qual é o meu plano atual e qual a potência máxima que posso usar?"

**Resposta obtida:**
> "Atualmente, **João Silva**, você está no plano **Intermediário**, que oferece uma potência máxima de **11 kW**. Isso significa que suas sessões de recarga são mais rápidas que o plano Básico (7 kW)! Caso deseje carregar ainda mais rápido, você pode considerar o upgrade para o plano **Premium (22 kW)** na área de perfil. Em 30 minutos de recarga, você consegue aproximadamente **5,5 kWh** com seu plano atual."

**Avaliação:** ✅ **Adequada**

**Justificativa:** A IA identificou corretamente o plano do usuário, explicou a potência, fez comparação com outros planos disponíveis e calculou exemplo prático de recarga. Resposta informativa e contextualizada.

---

### ✅ Caso 4 — Localização e Reservas

**Pergunta enviada:**
> "Onde foram minhas últimas recargas e eu tenho alguma reserva recente?"

**Resposta obtida:**
> "Suas últimas recargas foram realizadas em:\n- 🏪 **Shopping Interlagos** (Zona Sul) — Vaga A2, 11 kWh em 05/06\n- 🚇 **Metrô Jabaquara** (Zona Sul) — Vaga B1, 5,5 kWh em 01/06\n- 🏪 **Shopping Aricanduva** (Zona Leste) — Vaga A3, 7,33 kWh em 28/05\n\nAlém disso, você tem uma reserva **ativa** no **Shopping Iguatemi** (Zona Oeste), Vaga B2, agendada para **10/06 às 14:00**. Não se esqueça: caso não compareça sem cancelar, a multa de R$ 15,00 será aplicada."

**Avaliação:** ✅ **Adequada**

**Justificativa:** A IA listou corretamente o histórico de recargas com todos os detalhes relevantes, identificou a reserva ativa e proativamente alertou sobre a política de no-show — demonstrando excelente uso do contexto.

---

### ✅ Caso 5 — Teste de Escopo (Out-of-Scope)

**Pergunta enviada:**
> "Quem ganhou o jogo de futebol ontem à noite?"

**Resposta obtida:**
> "Desculpe, **João Silva**, mas como seu assistente **ChargeGrid** de Recarga Inteligente de VEs, eu só tenho acesso a informações relacionadas ao sistema de recargas — como seu histórico de sessões, saldo, planos e reservas. Não consigo fornecer informações sobre esportes ou outros temas externos.\n\nPosso te ajudar com algo sobre seu veículo elétrico? Por exemplo, verificar sua reserva no Shopping Iguatemi amanhã ou consultar locais de recarga próximos a você! 🔋"

**Avaliação:** ✅ **Adequada**

**Justificativa:** A IA recusou corretamente a pergunta fora do escopo, manteve tom educado e profissional, e redirecionou o usuário para funcionalidades relevantes com base no contexto atual (lembrou da reserva ativa).

---

## Resumo dos Resultados

| # | Caso de Teste | Avaliação | Técnica Destacada |
|---|---|---|---|
| 1 | Consulta de Saldo | ✅ Adequada | Context Injection + cálculo derivado |
| 2 | Histórico de Gastos | ✅ Adequada | Context Injection + dados agregados |
| 3 | Detalhes do Plano | ✅ Adequada | Few-Shot + informação comparativa |
| 4 | Localização e Reservas | ✅ Adequada | Context Injection + alerta proativo |
| 5 | Teste de Escopo (OOS) | ✅ Adequada | Scope Control + Few-Shot Prompting |

**Taxa de sucesso: 5/5 (100%)**

---

## Observações Técnicas

### Técnicas Implementadas (Diferenciais)

1. **Few-Shot Prompting** — Exemplos de Q&A incorporados ao system prompt guiam o comportamento da IA, resultando em respostas mais consistentes e dentro do escopo.

2. **Context Injection (RAG simplificado)** — Dados reais do banco de dados MySQL são injetados no system prompt a cada requisição, garantindo respostas personalizadas e precisas.

3. **Conversation Memory** — Histórico de mensagens mantido em memória no servidor (até 20 mensagens por usuário), permitindo diálogos coerentes e multi-turno.

4. **Scope Control Explícito** — Instruções rígidas no system prompt definem o que a IA pode e não pode responder, com exemplos concretos de recusa.

### Parâmetros do Modelo

| Parâmetro | Valor | Justificativa |
|---|---|---|
| `model` | `gpt-4o-mini` | Equilíbrio custo/performance para assistência |
| `temperature` | `0.7` | Natural, mas preservando precisão factual |
| `max_tokens` | `600` | Respostas completas sem desperdício |
| `max_history` | `20 msgs` | ~10 trocas de diálogo em memória |

---

## Conclusão

O chatbot **ChargeGrid Assistant** demonstrou desempenho excelente em todos os 5 casos de teste, incluindo o crítico teste de escopo (caso 5). A combinação de Context Injection + Few-Shot Prompting resultou em respostas personalizadas, precisas e dentro do contexto definido para o projeto GoodWe EV Challenge 2026.
