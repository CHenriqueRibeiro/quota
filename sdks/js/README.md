# 🚀 Quota JavaScript & TypeScript SDK (`quota-sdk`)

[![npm version](https://img.shields.io/npm/v/quota-sdk.svg)](https://www.npmjs.com/package/quota-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**[🇺🇸 English](#-english)** | **[🇧🇷 Português](#-português)**

---

<a name="english"></a>
## 🇺🇸 English

Official SDK for **Quota**: Unified LLM Observability, Real-time Cost Tracking, Proxy & native **Model Context Protocol (MCP)** tool interception for Node.js, Bun, Deno, and TypeScript.

### 🎯 Supported AI Providers
The Quota platform supports and monitors all models from the following AI providers:
- **OpenAI**
- **Anthropic**
- **Google**
- **Groq**
- **Mistral**

---

### 📦 Installation

```bash
npm install quota-sdk
# or
bun add quota-sdk
# or
yarn add quota-sdk
```

### ⚡ Quickstart & Automatic Fetch Interception

When initialized with `Quota.init()`, the SDK automatically intercepts outgoing `fetch` calls to supported AI providers (**OpenAI**, **Anthropic**, **Google**, **Groq**, **Mistral**) and sends telemetry asynchronously:

```typescript
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_YOUR_API_KEY',
  endpoint: 'https://api.quota.ai/collector', // Optional (default: official endpoint)
  project: 'ecommerce-portal',               // Optional: Dashboard project grouping
  agent: 'customer-support-bot',             // Optional: Bot / Agent name
  environment: 'production',                 // Optional: production | staging | development
  debug: false
});
```

---

### 🧠 Model Context Protocol (MCP) Integration

#### Option 1: Wrap an MCP Client (`Quota.wrapMcp`)
If you use the official `@modelcontextprotocol/sdk`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_YOUR_API_KEY',
  project: 'sales-automation',
  agent: 'lead-enricher'
});

// 1. Create your raw MCP client
const rawClient = new Client({ name: 'my-agent', version: '1.0.0' });

// 2. Wrap it with Quota in 1 line
const mcpClient = Quota.wrapMcp(rawClient, {
  tags: ['mcp', 'tools', 'sales']
});

// 3. Call tools normally: Quota captures tokens, latency, status & costs!
const result = await mcpClient.callTool({
  name: 'enrich_company_data',
  arguments: { domain: 'google.com' }
});
```

#### Option 2: Functional Interceptor (`Quota.interceptMcp`)
Wrap any async LLM call or tool action directly:

```typescript
import { Quota } from 'quota-sdk';

const response = await Quota.interceptMcp(
  async () => {
    return await myAiFunction();
  },
  {
    provider: 'anthropic',
    tags: ['mcp-action', 'document-analysis']
  }
);
```

#### Option 3: Manual Tracking (`Quota.trackUsage`)
```typescript
import { Quota } from 'quota-sdk';

await Quota.trackUsage({
  provider: 'google',
  model: 'gemini-model',
  promptTokens: 150,
  completionTokens: 45,
  cachedTokens: 30,
  reasoningTokens: 10,
  latencyMs: 320,
  statusCode: 200,
  success: true,
  metadata: {
    project: 'bi-portal',
    agent: 'analytics-bot'
  }
});
```

---

### 🔌 IDE Configuration (Cursor, Claude Desktop, Windsurf, VS Code)

Monitor MCP tools executed in your IDE without modifying tool code:

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

<a name="português"></a>
## 🇧🇷 Português

SDK oficial do **Quota** para Node.js, Bun, Deno e TypeScript. Oferece observabilidade unificada de LLMs, monitoramento de custos em tempo real, proxy e **interceptação nativa de ferramentas do Model Context Protocol (MCP)**.

### 🎯 Provedores de IA Suportados
A plataforma Quota suporta e monitora modelos dos seguintes provedores:
- **OpenAI**
- **Anthropic**
- **Google**
- **Groq**
- **Mistral**

---

### 📦 Instalação

```bash
npm install quota-sdk
# ou
bun add quota-sdk
# ou
yarn add quota-sdk
```

### ⚡ Inicialização Rápida

Ao chamar `Quota.init()`, o SDK ativa automaticamente a interceptação transparente em chamadas `fetch` para todos os provedores suportados (**OpenAI**, **Anthropic**, **Google**, **Groq**, **Mistral**):

```typescript
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_sua_chave_aqui',
  endpoint: 'https://sua-api.com/collector', // Opcional (padrão: rota oficial Quota)
  project: 'meu-projeto',                   // Opcional: Agrupador padrão no Dashboard
  agent: 'assistente-ia',                   // Opcional: Nome do robô/agente
  environment: 'production',                // Opcional: production | staging | development
  debug: false
});
```

---

### 🧠 Integração com Model Context Protocol (MCP)

#### 🛠️ Opção 1: Envelopando um Cliente MCP (`Quota.wrapMcp`)
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Quota } from 'quota-sdk';

Quota.init({
  apiKey: 'quota_live_sua_chave_aqui',
  project: 'automacao-financeira',
  agent: 'bot-cobranca'
});

const rawClient = new Client({ name: 'meu-app', version: '1.0.0' });

// Envelopa o cliente em 1 linha
const mcpClient = Quota.wrapMcp(rawClient, {
  tags: ['mcp', 'tools', 'financeiro']
});

// Chame as tools normalmente: o Quota captura tokens, latência e status!
const resultado = await mcpClient.callTool({
  name: 'consultar_extrato',
  arguments: { contaId: '12345' }
});
```

#### ⚡ Opção 2: Interceptador Funcional Direto (`Quota.interceptMcp`)
```typescript
import { Quota } from 'quota-sdk';

const resposta = await Quota.interceptMcp(
  async () => {
    return await minhaFuncaoDeIA();
  },
  {
    provider: 'anthropic',
    tags: ['analise-documentos']
  }
);
```

#### 📊 Opção 3: Envio Manual de Telemetria (`Quota.trackUsage`)
```typescript
import { Quota } from 'quota-sdk';

await Quota.trackUsage({
  provider: 'google',
  model: 'gemini-model',
  promptTokens: 150,
  completionTokens: 45,
  cachedTokens: 30,
  reasoningTokens: 10,
  latencyMs: 320,
  statusCode: 200,
  success: true,
  metadata: {
    project: 'portal-bi',
    agent: 'agente-metricas'
  }
});
```

---

## 📄 Licença / License
MIT © Quota
