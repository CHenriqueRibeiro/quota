# 🐍 Quota Python SDK (`quota-sdk`)

[![PyPI version](https://img.shields.io/pypi/v/quota-sdk.svg)](https://pypi.org/project/quota-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**[🇺🇸 English](#-english)** | **[🇧🇷 Português](#-português)**

---

<a name="english"></a>
## 🇺🇸 English

Official Python SDK for **Quota**: Unified LLM Observability, Real-time Cost Tracking, Proxy & native **Model Context Protocol (MCP)** tool interception for Python applications, autonomous agents, and workflows.

### 🎯 Supported AI Providers
The Quota platform natively monitors, audits, and extracts tokens/costs for the following AI providers:
- **OpenAI**
- **Anthropic**
- **Google**
- **Groq**
- **Mistral**

---

### 🚀 Installation

```bash
pip install quota-sdk
```

---

### ⚡ Quickstart & Initialization

Initialize the Quota SDK once at the entry point of your application:

```python
from quota import Quota

Quota.init(
    api_key="quota_live_YOUR_API_KEY",
    endpoint="https://api.quota.ai/collector",  # Optional (default: official endpoint)
    project="ecommerce-portal",                 # Optional: Dashboard project grouping
    agent="customer-support-bot",               # Optional: Bot / Agent name
    environment="production",                   # Optional: production | staging | development
    debug=False
)
```

---

### 🧠 Model Context Protocol (MCP) Integration

The `quota-sdk` provides native, first-class support for the **Model Context Protocol (MCP)** standard, allowing you to intercept and track tools, sampling, and agent executions with zero friction.

#### 🛠️ Option 1: Wrap an MCP Client (`Quota.wrap_mcp`)
Wrap any Python MCP Client (e.g. `mcp`, `fastmcp`, `langchain`, etc.) with a single line of code:

```python
from quota import Quota

# 1. Initialize Quota
Quota.init(
    api_key="quota_live_YOUR_API_KEY",
    project="sales-automation",
    agent="lead-enricher",
    environment="production"
)

# 2. Wrap your MCP client
mcp_client = Quota.wrap_mcp(my_raw_mcp_client, tags=["mcp", "tools", "sales"])

# 3. Call tools normally: Quota automatically captures tokens, latency, status & costs!
result = mcp_client.call_tool(name="query_customer_lead", email="client@company.com")
```

#### ⚡ Option 2: Functional Interceptor (`Quota.intercept_mcp`)
Wrap any asynchronous or synchronous AI function or tool execution:

```python
from quota import Quota
import openai

response = Quota.intercept_mcp(
    action=lambda: openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Summarize this ticket."}]
    ),
    provider="openai",
    model="gpt-4o-mini",
    tags=["mcp-action", "ticket-summary"]
)
```

#### 📊 Option 3: Manual Tracking (`Quota.track_usage`)
Send telemetry events directly:

```python
from quota import Quota

Quota.track_usage({
    "provider": "google",
    "model": "gemini-model",
    "promptTokens": 150,
    "completionTokens": 45,
    "cachedTokens": 30,
    "reasoningTokens": 10,
    "latencyMs": 320,
    "statusCode": 200,
    "success": True,
    "metadata": {
        "project": "bi-portal",
        "agent": "analytics-bot",
        "tags": ["dashboard", "bi"]
    }
})
```

---

### 📋 Observability & Metadata Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `project` | `str` | Project or department name (e.g. `"financial-portal"`, `"sales-bot"`). |
| `agent` | `str` | AI Assistant or Bot name (e.g. `"customer-service"`, `"billing-agent"`). |
| `environment` | `str` | Runtime environment (`"production"`, `"staging"`, `"development"`). |
| `externalUserId` | `str` | End-user ID for per-user cost tracking and quota controls. |
| `billingGroup` | `str` | Cost center or billing group for financial chargeback. |
| `tags` | `list[str]` | Custom array of tags for filtering in the Quota dashboard. |

---

### 🎯 Token & Metric Extraction by Provider

| Provider | Input Tokens | Output Tokens | Cached Tokens | Reasoning / Thoughts |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `prompt_tokens` | `completion_tokens` | `prompt_tokens_details.cached_tokens` | `completion_tokens_details.reasoning_tokens` |
| **Anthropic** | `input_tokens` | `output_tokens` | `cache_read_input_tokens` | N/A |
| **Google** | `promptTokenCount` | `candidatesTokenCount` | `cachedContentTokenCount` | `thoughtsTokenCount` |
| **Groq** | `prompt_tokens` | `completion_tokens` | N/A | N/A |
| **Mistral** | `prompt_tokens` | `completion_tokens` | N/A | N/A |

---

<a name="português"></a>
## 🇧🇷 Português

SDK oficial em Python do **Quota**: Observabilidade unificada de LLMs, monitoramento de custos em tempo real, proxy e **interceptação nativa de ferramentas do Model Context Protocol (MCP)** para aplicações, agentes autônomos e pipelines em Python.

### 🎯 Provedores de IA Suportados
A plataforma Quota monitora, audita e extrai métricas de uso de forma nativa para os seguintes provedores:
- **OpenAI**
- **Anthropic**
- **Google**
- **Groq**
- **Mistral**

---

### 🚀 Instalação

```bash
pip install quota-sdk
```

---

### ⚡ Inicialização Rápida

Inicialize o SDK do Quota uma única vez no ponto de entrada da sua aplicação:

```python
from quota import Quota

Quota.init(
    api_key="quota_live_sua_chave_aqui",
    endpoint="https://sua-api.com/collector",  # Opcional (padrão: rota oficial)
    project="portal-vendas",                   # Opcional: Agrupador no Dashboard
    agent="assistente-atendimento",            # Opcional: Nome do robô/agente
    environment="production",                  # Opcional: production | staging | development
    debug=False
)
```

---

### 🧠 Integração com Model Context Protocol (MCP)

O `quota-sdk` oferece suporte nativo e direto ao padrão **Model Context Protocol (MCP)**, permitindo rastrear execuções de ferramentas (*Tool Calls*), mensagens e ações de agentes sem atrito.

#### 🛠️ Opção 1: Envelopando um Cliente MCP (`Quota.wrap_mcp`)
Envelopa qualquer cliente MCP em Python (`mcp`, `fastmcp`, `langchain`, etc.) com apenas uma linha de código:

```python
from quota import Quota

# 1. Inicializa o Quota
Quota.init(
    api_key="quota_live_sua_chave_aqui",
    project="automacao-vendas",
    agent="agente-prospeccao"
)

# 2. Envelopa o cliente MCP
mcp_client = Quota.wrap_mcp(meu_mcp_client, tags=["mcp", "ferramentas-crm"])

# 3. Chame as tools normalmente: o Quota captura tokens, latência e status automaticamente!
resultado = mcp_client.call_tool(name="consultar_lead_crm", email="cliente@empresa.com")
```

#### ⚡ Opção 2: Interceptador Funcional Direto (`Quota.intercept_mcp`)
Envolva qualquer função de IA ou execução de ferramenta isolada:

```python
from quota import Quota
import openai

resposta = Quota.intercept_mcp(
    action=lambda: openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Resuma este contrato."}]
    ),
    provider="openai",
    model="gpt-4o-mini",
    tags=["mcp-action", "analise-contratos"]
)
```

#### 📊 Opção 3: Envio Manual de Telemetria (`Quota.track_usage`)
Envie eventos de telemetria manualmente:

```python
from quota import Quota

Quota.track_usage({
    "provider": "google",
    "model": "gemini-model",
    "promptTokens": 150,
    "completionTokens": 45,
    "cachedTokens": 30,
    "reasoningTokens": 10,
    "latencyMs": 320,
    "statusCode": 200,
    "success": True,
    "metadata": {
        "project": "relatorios-bi",
        "agent": "bot-analista",
        "tags": ["dashboard", "bi"]
    }
})
```

---

### 📋 Tabela de Parâmetros de Observabilidade

| Parâmetro | Tipo | Descrição & Caso de Uso |
| :--- | :--- | :--- |
| `project` | `str` | Nome do Projeto ou Setor da Empresa (ex: `"portal-financeiro"`, `"app-vendas"`). |
| `agent` | `str` | Nome do Agente ou Robô de IA (ex: `"bot-cobranca"`, `"assistente-juridico"`). |
| `environment` | `str` | Ambiente de Execução (`"production"`, `"staging"`, `"development"`). |
| `externalUserId` | `str` | ID do Usuário Final da aplicação para auditoria por cliente e rateios. |
| `billingGroup` | `str` | Centro de Custo / Grupo de Faturamento para rateio financeiro. |
| `tags` | `list[str]` | Etiquetas personalizadas para filtros flexíveis no Dashboard. |

---

### 🎯 Extração de Tokens por Provedor

| Provedor | Tokens de Entrada | Tokens de Saída | Tokens em Cache (*Cached*) | Raciocínio / Pensamento (*Reasoning*) |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `prompt_tokens` | `completion_tokens` | `prompt_tokens_details.cached_tokens` | `completion_tokens_details.reasoning_tokens` |
| **Anthropic** | `input_tokens` | `output_tokens` | `cache_read_input_tokens` | N/A |
| **Google** | `promptTokenCount` | `candidatesTokenCount` | `cachedContentTokenCount` | `thoughtsTokenCount` |
| **Groq** | `prompt_tokens` | `completion_tokens` | N/A | N/A |
| **Mistral** | `prompt_tokens` | `completion_tokens` | N/A | N/A |

---

## 📄 Licença / License
MIT © Quota
