# quota-sdk

SDK oficial em JavaScript / TypeScript para telemetria, monitoramento de latência e consumo de tokens de modelos de IA (OpenAI, Anthropic, Gemini, Groq, etc.) para a plataforma **Quota**.

---

## 📦 Instalação

```bash
npm install quota-sdk
# ou
bun add quota-sdk
# ou
yarn add quota-sdk
```

---

## 🚀 Uso Rápido (1 Linha de Configuração)

Basta inicializar o `Quota.init()` na entrada da sua aplicação (ex: `index.ts` ou `server.ts`).

```typescript
import { Quota } from 'quota-sdk';
import OpenAI from 'openai';

// 1. Inicializa o monitoramento global do Quota (uma única vez na inicialização)
Quota.init({
  apiKey: 'qta_live_sua_chave_de_api'
});

// 2. Suas chamadas para a OpenAI, Anthropic, Gemini ou Groq são capturadas automaticamente!
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

## 🤖 Exemplos de Uso por Provedor

Como o `Quota.init()` intercepta requisições HTTP de forma transparente, você pode usar os SDKs oficiais das IAs sem modificar seu código:

### 1. OpenAI SDK (`openai`)
```typescript
import { Quota } from 'quota-sdk';
import OpenAI from 'openai';

Quota.init({ apiKey: 'qta_live_sua_chave' });

const openai = new OpenAI();
const res = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Resuma este texto.' }]
});
```

### 2. Anthropic SDK (`@anthropic-ai/sdk`)
```typescript
import { Quota } from 'quota-sdk';
import Anthropic from '@anthropic-ai/sdk';

Quota.init({ apiKey: 'qta_live_sua_chave' });

const anthropic = new Anthropic();
const res = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explique computação quântica.' }]
});
```

### 3. Groq SDK (`groq-sdk`)
```typescript
import { Quota } from 'quota-sdk';
import Groq from 'groq-sdk';

Quota.init({ apiKey: 'qta_live_sua_chave' });

const groq = new Groq();
const res = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Olá Groq!' }]
});
```

### 4. Google Gemini (`@google/generative-ai`)
```typescript
import { Quota } from 'quota-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

Quota.init({ apiKey: 'qta_live_sua_chave' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
const result = await model.generateContent('Escreva um poema sobre IA.');
```

### 5. Mistral AI SDK (`@mistralai/mistralai`)
```typescript
import { Quota } from 'quota-sdk';
import { Mistral } from '@mistralai/mistralai';

Quota.init({ apiKey: 'qta_live_sua_chave' });

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const response = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{ role: 'user', content: 'Olá Mistral!' }]
});
```

> [!IMPORTANT]
> **API Key do Quota é a ÚNICA configuração obrigatória!**
> Se você passar apenas a `apiKey`, o Quota registrará automaticamente todas as métricas essenciais de observabilidade: **Provedor, Modelo, Tokens de Prompt, Tokens de Resposta, Latência (ms), Custo e Status HTTP**.
> 
> Os parâmetros de categorização (Projeto, Agente, Ambiente, Usuário Final, Tags e Grupo de Faturamento) são **100% opcionais**.

---

## 🏷️ Passando Metadados de Observabilidade (Opcional)

Se você desejar categorizar e filtrar suas métricas no painel do Quota por **Agente**, **Projeto**, **Equipe/Grupo**, **Usuário Final** ou **Tags**, existem duas formas de enviar esses dados:

### Opção A: Metadados Globais na Inicialização (Recomendado)
Defina os parâmetros diretamente no `Quota.init()`. Todas as chamadas de IA da sua aplicação herdarão essas informações automaticamente:

```typescript
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'qta_live_sua_chave',
  project: 'portal-cliente',     // Projeto / Setor
  agent: 'bot-suporte',          // Agente / Assistente
  environment: 'production'      // Ambiente (production, staging, etc)
});
```

### Opção B: Metadados Dinâmicos por Requisição (via Cabeçalhos)
Para informações dinâmicas que mudam a cada requisição (como o ID do usuário logado ou tags específicas), passe os cabeçalhos `x-quota-*`:

```typescript
const response = await openai.chat.completions.create(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Qual o meu saldo?' }]
  },
  {
    headers: {
      'x-quota-user-id': 'usr_991823',        // ID do usuário final
      'x-quota-tags': 'vip,financeiro',        // Tags separadas por vírgula
      'x-quota-billing-group': 'equipe-vendas' // Grupo de faturamento/equipe
    }
  }
);
```

### 📋 Parâmetros e Cabeçalhos Suportados:
| Parâmetro no `Quota.init()` | Cabeçalho HTTP | Descrição |
| :--- | :--- | :--- |
| `project` | `x-quota-project` | Nome do Projeto ou Setor da empresa. |
| `agent` | `x-quota-agent` | Nome do Agente ou Robô de IA. |
| `environment` | `x-quota-environment` | Ambiente (`production`, `staging`, `development`). |
| `externalUserId` | `x-quota-user-id` | ID do usuário final da sua aplicação. |
| `billingGroup` | `x-quota-billing-group` | Grupo de faturamento, centro de custo ou equipe. |
| `tags` | `x-quota-tags` | Lista ou string de tags separadas por vírgula (`tag1,tag2`). |

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
import { Quota } from 'quota-sdk';

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
