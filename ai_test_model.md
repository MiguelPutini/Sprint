# 🧪 Modelo de Teste - Assistente IA (GPT-4o-mini)

Este documento contém 5 perguntas de teste esperadas para validar o comportamento do assistente virtual, juntamente com as respostas ideais baseadas no contexto fornecido.

---

### Pergunta 1: Consulta de Saldo
**Usuário:** "Olá! Qual é o meu saldo atual e quando eu me cadastrei?"
**Resposta Ideal:** "Olá, [Nome]! É um prazer ajudar. Seu saldo atual no sistema é de **R$ [Valor]**. Notei que você faz parte da nossa comunidade desde **[Data]**. Precisa de ajuda para adicionar mais créditos ou encontrar um local de recarga?"

---

### Pergunta 2: Histórico de Gastos
**Usuário:** "Quanto eu já gastei no total com recargas até agora?"
**Resposta Ideal:** "Com base nos seus registros, você já investiu um total de **R$ [Gasto Total]** em sessões de recarga. Isso resultou em um consumo acumulado de **[Energia Total] kWh**. Gostaria de ver os detalhes da sua última recarga?"

---

### Pergunta 3: Detalhes do Plano
**Usuário:** "Qual é o meu plano atual e qual a potência máxima que posso usar?"
**Resposta Ideal:** "Atualmente, você está no plano **[Plano]**. Com este plano, sua potência máxima de recarga permitida é de **[Potência] kW**. Se desejar carregar mais rápido, você pode considerar o upgrade para o plano Premium de 22kW na aba de perfil!"

---

### Pergunta 4: Localização e Reservas
**Usuário:** "Onde foram minhas últimas recargas e eu tenho alguma reserva recente?"
**Resposta Ideal:** "Suas últimas recargas foram realizadas em: **[Lista de Locais]**. Além disso, verifiquei que sua reserva mais recente foi no local **[Local da Reserva]** (Vaga [Vaga])."

---

### Pergunta 5: Teste de Escopo (Out-of-Scope)
**Usuário:** "Quem ganhou o jogo de futebol ontem à noite?"
**Resposta Ideal:** "Desculpe, [Nome], mas como seu assistente de Recarga Inteligente de VEs, eu só tenho acesso a informações relacionadas ao seu histórico de recargas, saldo, planos e funcionamento do sistema. Não consigo fornecer informações sobre esportes ou outros temas externos. Posso te ajudar com algo sobre seu veículo elétrico hoje?"

---

### Notas de Implementação:
- O modelo utilizado é o `gpt-4o-mini`.
- O `temperature` está configurado em `0.7` para permitir uma fala natural, mas mantendo a precisão dos dados.
- O sistema utiliza `prompt injection` dos dados reais do banco de dados em cada requisição.
