# @quota/sdk

SDK oficial em JavaScript / TypeScript para telemetria, monitoramento de latência e consumo de tokens de modelos de IA (OpenAI, Anthropic, Gemini, Groq, etc.) para a plataforma **Quota**.

---

## 📦 Instalação

```bash
npm install @quota/sdk
# ou
bun add @quota/sdk
# ou
yarn add @quota/sdk
```

---

## 🚀 Uso Rápido (1 Linha de Configuração)

Basta inicializar o `Quota.init()` na entrada da sua aplicação (ex: `index.ts` ou `server.ts`).

```typescript
import { Quota } from '@quota/sdk';
import OpenAI from 'openai';

// 1. Inicializa o monitoramento do Quota
Quota.init({
  apiKey: 'qta_live_sua_chave_de_api'
});

// 2. Use qualquer SDK de IA (OpenAI, Anthropic, etc.) normalmente!
const openai = new OpenAI();

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Olá, mundo!' }]
  });

  console.log(completion.choices[0].message.content);
}

main();
```

---

## 🏷️ Passando Metadados Customizados por Requisição

Você pode associar chamadas a **Agentes**, **Projetos**, **Usuários Finais** ou **Tags** passando cabeçalhos `x-quota-*` nas requisições:

```typescript
const response = await openai.chat.completions.create(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Qual o meu saldo?' }]
  },
  {
    headers: {
      'x-quota-agent': 'bot-financeiro',
      'x-quota-user-id': 'usr_991823',
      'x-quota-tags': 'vip,suporte'
    }
  }
);
```

### Cabeçalhos Suportados:
- `x-quota-project`: Nome do projeto.
- `x-quota-agent`: Nome do agente/assistente.
- `x-quota-user-id`: ID do usuário final da sua aplicação.
- `x-quota-tags`: Tags separadas por vírgula (`tag1,tag2`).
- `x-quota-billing-group`: Grupo de faturamento.
- `x-quota-environment`: Ambiente (`production`, `staging`, `development`).

---

## 🛠️ Testes Locais (Desenvolvimento)

Por padrão, a telemetria é enviada para a API em produção (`https://quota-api.up.railway.app/collector`). Para testar localmente contra o seu servidor de desenvolvimento:

```typescript
Quota.init({
  apiKey: 'qta_live_sua_chave_de_api',
  endpoint: 'http://localhost:3000/collector' // Sobrescreve para ambiente local
});
```

Ou usando variável de ambiente `.env`:
```env
QUOTA_ENDPOINT=http://localhost:3000/collector
```

---

## 📊 Rastreamento Manual (`Quota.trackUsage`)

Para enviar telemetria de eventos customizados ou chamadas de IA fora do escopo HTTP:

```typescript
import { Quota } from '@quota/sdk';

await Quota.trackUsage({
  provider: 'openai',
  model: 'gpt-4o',
  promptTokens: 120,
  completionTokens: 40,
  latencyMs: 350,
  metadata: {
    project: 'meu-projeto',
    agent: 'bot-cobranca',
    externalUserId: 'user_123'
  }
});
```

---

## 🛡️ Segurança & Performance

- **Zero Latência (Fail-Safe):** A extração e o envio da telemetria são executados de forma assíncrona (`queueMicrotask`).
- **Resiliência:** Se a API de telemetria estiver instável, a sua chamada para o provedor de IA **nunca** será interrompida ou quebrada.
