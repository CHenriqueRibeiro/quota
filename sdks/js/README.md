# 🚀 Quota JavaScript & TypeScript SDK (`quota-sdk`)

[![npm version](https://img.shields.io/npm/v/quota-sdk.svg)](https://www.npmjs.com/package/quota-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

SDK oficial em JavaScript / TypeScript para telemetria, observabilidade unificada, monitoramento de latência, custos e consumo de tokens de modelos de IA (**OpenAI**, **Anthropic**, **Google Gemini**, **Groq**, **Mistral**) e **interceptação nativa de ferramentas do Model Context Protocol (MCP)** para a plataforma Quota.

**[🇧🇷 Português](#-português)** | **[🇺🇸 English](#-english)**

---

<a name="português"></a>
## 🇧🇷 Português

### 📦 Instalação

```bash
npm install quota-sdk
# ou
bun add quota-sdk
# ou
yarn add quota-sdk
```

---

### 🚀 Uso Rápido (1 Linha de Configuração)

Basta inicializar o `Quota.init()` na entrada da sua aplicação (ex: `index.ts` ou `server.ts`).

```typescript
import { Quota } from 'quota-sdk';
import OpenAI from 'openai';

// 1. Inicializa o monitoramento global do Quota (uma única vez na inicialização)
Quota.init({
  apiKey: 'quota_live_sua_chave_de_api'
});

// 2. Suas chamadas para a OpenAI, Anthropic, Gemini, Groq ou Mistral são capturadas automaticamente!
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

### 🤖 Exemplos de Uso por Provedor

Como o `Quota.init()` intercepta requisições HTTP de forma transparente, você pode usar os SDKs oficiais das IAs sem modificar seu código de negócio:

#### 1. OpenAI SDK (`openai`)
```typescript
import { Quota } from 'quota-sdk';
import OpenAI from 'openai';

Quota.init({ apiKey: 'quota_live_sua_chave' });

const openai = new OpenAI();
const res = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Resuma este texto.' }]
});
```

#### 2. Anthropic SDK (`@anthropic-ai/sdk`)
```typescript
import { Quota } from 'quota-sdk';
import Anthropic from '@anthropic-ai/sdk';

Quota.init({ apiKey: 'quota_live_sua_chave' });

const anthropic = new Anthropic();
const res = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explique computação quântica.' }]
});
```

#### 3. Google Gemini (`@google/generative-ai`)
```typescript
import { Quota } from 'quota-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

Quota.init({ apiKey: 'quota_live_sua_chave' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const result = await model.generateContent('Escreva um poema sobre IA.');
```

#### 4. Groq SDK (`groq-sdk`)
```typescript
import { Quota } from 'quota-sdk';
import Groq from 'groq-sdk';

Quota.init({ apiKey: 'quota_live_sua_chave' });

const groq = new Groq();
const res = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Olá Groq!' }]
});
```

#### 5. Mistral AI SDK (`@mistralai/mistralai`)
```typescript
import { Quota } from 'quota-sdk';
import { Mistral } from '@mistralai/mistralai';

Quota.init({ apiKey: 'quota_live_sua_chave' });

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const response = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{ role: 'user', content: 'Olá Mistral!' }]
});
```

---

### 🧠 Suporte Nativo a Model Context Protocol (MCP)

O `quota-sdk` possui suporte de primeira classe para o padrão **Model Context Protocol (MCP)**, permitindo auditar e monitorar chamadas de ferramentas (*Tool Calls*), *sampling* e ações de agentes.

#### Opção A: Envelopando um Cliente MCP (`Quota.wrapMcp`)
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_sua_chave',
  project: 'automacao-vendas',
  agent: 'agente-prospeccao'
});

const rawClient = new Client({ name: 'meu-agente', version: '1.0.0' });

// Envelopa o cliente MCP em 1 única linha
const mcpClient = Quota.wrapMcp(rawClient, {
  tags: ['mcp', 'tools', 'crm']
});

// Chame as tools normalmente: tokens, latência e status são interceptados automaticamente!
const resultado = await mcpClient.callTool({
  name: 'consultar_lead_crm',
  arguments: { email: 'contato@empresa.com' }
});
```

#### Opção B: Interceptador Funcional Direto (`Quota.interceptMcp`)
```typescript
import { Quota } from 'quota-sdk';

const resposta = await Quota.interceptMcp(
  async () => {
    return await minhaFuncaoDeIAOuTool();
  },
  {
    provider: 'anthropic',
    tags: ['mcp-action', 'juridico']
  }
);
```

#### Opção C: Monitorando MCP em IDEs (Cursor, Claude Desktop, Windsurf, VS Code)
Adicione o wrapper no seu arquivo de configuração MCP:
```json
{
  "mcpServers": {
    "meu-servidor-postgres": {
      "command": "npx",
      "args": [
        "-y", "quota-sdk", "wrap",
        "--", "npx", "-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"
      ],
      "env": {
        "QUOTA_API_KEY": "quota_live_sua_chave_aqui",
        "QUOTA_PROJECT": "ambiente-desenvolvimento",
        "QUOTA_AGENT": "cursor-assistant",
        "QUOTA_ENVIRONMENT": "local"
      }
    }
  }
}
```

---

### 🏷️ Passando Metadados de Observabilidade (Opcional)

Se você desejar categorizar e filtrar suas métricas no painel do Quota por Agente, Projeto, Equipe/Grupo, Usuário Final ou Tags:

#### Opção A: Metadados Globais na Inicialização (Recomendado)
```typescript
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_sua_chave',
  project: 'portal-cliente',     // Projeto / Setor
  agent: 'bot-suporte',          // Agente / Assistente
  environment: 'production'      // Ambiente (production, staging, etc)
});
```

#### Opção B: Metadados Dinâmicos por Requisição (via Cabeçalhos)
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

#### 📋 Parâmetros e Cabeçalhos Suportados:

| Parâmetro no `Quota.init()` | Cabeçalho HTTP | Descrição & Caso de Uso |
| :--- | :--- | :--- |
| `project` | `x-quota-project` | Nome do Projeto ou Setor da empresa. |
| `agent` | `x-quota-agent` | Nome do Agente ou Robô de IA. |
| `environment` | `x-quota-environment` | Ambiente (`production`, `staging`, `development`). |
| `externalUserId` | `x-quota-user-id` | ID do usuário final da sua aplicação. |
| `requestGroup` | `x-quota-request-group` | Agrupamento de fluxo de execução. |
| `billingGroup` | `x-quota-billing-group` | Grupo de faturamento, centro de custo ou equipe. |
| `tags` | `x-quota-tags` | Lista ou string de tags separadas por vírgula (`tag1,tag2`). |
| `traceId` | `x-quota-trace-id` | ID de rastreamento/tracing distribuído. |

---

### 🛠️ Testes Locais (Desenvolvimento)

Por padrão, a telemetria é enviada para a API oficial (`https://quota-api.up.railway.app/collector`). Para testar localmente contra o seu servidor de desenvolvimento:

```typescript
Quota.init({
  apiKey: 'quota_live_sua_chave_de_api',
  endpoint: 'http://localhost:3000/collector' // Sobrescreve para ambiente local
});
```

Ou usando variável de ambiente no seu `.env`:
```env
QUOTA_ENDPOINT=http://localhost:3000/collector
```

---

### 📊 Rastreamento Manual (`Quota.trackUsage`)

Para enviar telemetria de eventos customizados ou chamadas fora do escopo HTTP:

```typescript
import { Quota } from 'quota-sdk';

// 1. Inicializa com a sua Quota API Key
Quota.init({ apiKey: 'quota_live_sua_chave' });

// 2. Envia o evento de telemetria manual
await Quota.trackUsage({
  provider: 'openai',
  model: 'gpt-4o',
  promptTokens: 120,
  completionTokens: 40,
  cachedTokens: 20,
  reasoningTokens: 10,
  latencyMs: 350,
  statusCode: 200,
  success: true,
  metadata: {
    project: 'meu-projeto',
    agent: 'bot-cobranca',
    externalUserId: 'user_123'
  }
});
```

---

### 🛡️ Segurança & Performance

- **Zero Latência (Fail-Safe)**: A extração e o envio da telemetria são executados de forma 100% assíncrona (`queueMicrotask`).
- **Resiliência Anti-Crash**: Se a API de telemetria estiver instável ou sem conexão, a sua chamada para o provedor de IA **nunca será interrompida ou quebrada**.

---

<a name="english"></a>
## 🇺🇸 English

### 📦 Installation

```bash
npm install quota-sdk
# or
bun add quota-sdk
# or
yarn add quota-sdk
```

---

### 🚀 Quickstart (1-Line Setup)

Initialize `Quota.init()` at the entry point of your application (e.g., `index.ts` or `server.ts`).

```typescript
import { Quota } from 'quota-sdk';
import OpenAI from 'openai';

// 1. Initialize Quota global monitoring (once at startup)
Quota.init({
  apiKey: 'quota_live_YOUR_API_KEY'
});

// 2. Outgoing calls to OpenAI, Anthropic, Gemini, Groq, or Mistral are automatically captured!
const openai = new OpenAI();

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello, world!' }]
  });

  console.log(completion.choices[0].message.content);
}

main();
```

---

### 🤖 Usage Examples by Provider

Because `Quota.init()` transparently intercepts HTTP fetch requests, you can use official AI SDKs without modifying your application logic:

#### 1. OpenAI SDK (`openai`)
```typescript
import { Quota } from 'quota-sdk';
import OpenAI from 'openai';

Quota.init({ apiKey: 'quota_live_YOUR_KEY' });

const openai = new OpenAI();
const res = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Summarize this text.' }]
});
```

#### 2. Anthropic SDK (`@anthropic-ai/sdk`)
```typescript
import { Quota } from 'quota-sdk';
import Anthropic from '@anthropic-ai/sdk';

Quota.init({ apiKey: 'quota_live_YOUR_KEY' });

const anthropic = new Anthropic();
const res = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explain quantum computing.' }]
});
```

#### 3. Google Gemini (`@google/generative-ai`)
```typescript
import { Quota } from 'quota-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

Quota.init({ apiKey: 'quota_live_YOUR_KEY' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const result = await model.generateContent('Write a poem about AI.');
```

#### 4. Groq SDK (`groq-sdk`)
```typescript
import { Quota } from 'quota-sdk';
import Groq from 'groq-sdk';

Quota.init({ apiKey: 'quota_live_YOUR_KEY' });

const groq = new Groq();
const res = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Hello Groq!' }]
});
```

#### 5. Mistral AI SDK (`@mistralai/mistralai`)
```typescript
import { Quota } from 'quota-sdk';
import { Mistral } from '@mistralai/mistralai';

Quota.init({ apiKey: 'quota_live_YOUR_KEY' });

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const response = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{ role: 'user', content: 'Hello Mistral!' }]
});
```

---

### 🧠 Native Model Context Protocol (MCP) Support

`quota-sdk` provides first-class support for the **Model Context Protocol (MCP)** standard to audit Tool Calls, sampling, and agent workflows.

#### Option A: Wrap an MCP Client (`Quota.wrapMcp`)
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_YOUR_KEY',
  project: 'sales-automation',
  agent: 'lead-enricher'
});

const rawClient = new Client({ name: 'my-agent', version: '1.0.0' });

// Wrap client in 1 line
const mcpClient = Quota.wrapMcp(rawClient, {
  tags: ['mcp', 'tools', 'crm']
});

// Call tools normally: tokens, latency, and status are tracked automatically!
const result = await mcpClient.callTool({
  name: 'query_customer_lead',
  arguments: { email: 'contact@company.com' }
});
```

#### Option B: Functional Interceptor (`Quota.interceptMcp`)
```typescript
import { Quota } from 'quota-sdk';

const response = await Quota.interceptMcp(
  async () => {
    return await myAiFunctionOrTool();
  },
  {
    provider: 'anthropic',
    tags: ['mcp-action', 'legal']
  }
);
```

#### Option C: Monitor MCP in IDEs (Cursor, Claude Desktop, Windsurf, VS Code)
```json
{
  "mcpServers": {
    "my-postgres-tool": {
      "command": "npx",
      "args": [
        "-y", "quota-sdk", "wrap",
        "--", "npx", "-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"
      ],
      "env": {
        "QUOTA_API_KEY": "quota_live_YOUR_API_KEY",
        "QUOTA_PROJECT": "local-development",
        "QUOTA_AGENT": "cursor-assistant",
        "QUOTA_ENVIRONMENT": "local"
      }
    }
  }
}
```

---

### 🏷️ Observability Metadata (Optional)

#### Option A: Global Metadata on Init (Recommended)
```typescript
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_YOUR_KEY',
  project: 'customer-portal',    // Project / Department
  agent: 'support-bot',          // Agent / Bot Name
  environment: 'production'      // Environment
});
```

#### Option B: Dynamic Per-Request Metadata (via Headers)
```typescript
const response = await openai.chat.completions.create(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'What is my balance?' }]
  },
  {
    headers: {
      'x-quota-user-id': 'usr_991823',
      'x-quota-tags': 'vip,finance',
      'x-quota-billing-group': 'sales-team'
    }
  }
);
```

#### 📋 Supported Parameters & Headers:

| Parameter in `Quota.init()` | HTTP Header | Description & Business Use Case |
| :--- | :--- | :--- |
| `project` | `x-quota-project` | Project or department name. |
| `agent` | `x-quota-agent` | AI Assistant or Bot name. |
| `environment` | `x-quota-environment` | Environment (`production`, `staging`, `development`). |
| `externalUserId` | `x-quota-user-id` | End-user ID for per-user cost tracking. |
| `requestGroup` | `x-quota-request-group` | Execution workflow or feature group. |
| `billingGroup` | `x-quota-billing-group` | Billing group, cost center, or team. |
| `tags` | `x-quota-tags` | Comma-separated tags (`tag1,tag2`). |
| `traceId` | `x-quota-trace-id` | Distributed tracing ID. |

---

### 🛠️ Local Testing (Development)

```typescript
Quota.init({
  apiKey: 'quota_live_YOUR_KEY',
  endpoint: 'http://localhost:3000/collector'
});
```

Or via `.env`:
```env
QUOTA_ENDPOINT=http://localhost:3000/collector
```

---

### 📊 Manual Tracking (`Quota.trackUsage`)

```typescript
import { Quota } from 'quota-sdk';

Quota.init({ apiKey: 'quota_live_YOUR_KEY' });

await Quota.trackUsage({
  provider: 'openai',
  model: 'gpt-4o',
  promptTokens: 120,
  completionTokens: 40,
  cachedTokens: 20,
  reasoningTokens: 10,
  latencyMs: 350,
  statusCode: 200,
  success: true,
  metadata: {
    project: 'my-project',
    agent: 'billing-bot',
    externalUserId: 'user_123'
  }
});
```

---

### 🛡️ Security & Performance

- **Zero Latency (Fail-Safe)**: Async telemetry dispatch via `queueMicrotask`.
- **Anti-Crash Resilience**: If telemetry is down or unreachable, your AI request **never breaks or fails**.

---

## 📄 Licença / License
MIT © Quota
