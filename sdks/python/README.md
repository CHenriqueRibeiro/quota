# 🐍 Quota Python SDK (`quota-sdk`)

[![PyPI version](https://img.shields.io/pypi/v/quota-sdk.svg)](https://pypi.org/project/quota-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

SDK oficial em Python para telemetria, observabilidade unificada, monitoramento de latência, custos e consumo de tokens de modelos de IA (**OpenAI**, **Anthropic**, **Google Gemini**, **Groq**, **Mistral**) e **interceptação nativa de ferramentas do Model Context Protocol (MCP)** para a plataforma Quota.

**[🇧🇷 Português](#-português)** | **[🇺🇸 English](#-english)**

---

<a name="português"></a>
## 🇧🇷 Português

### 📦 Instalação

```bash
pip install quota-sdk
```

---

### 🚀 Uso Rápido (1 Linha de Configuração)

Basta inicializar o `Quota.init()` no início da sua aplicação (ex: `main.py` ou `app.py`).

```python
from quota import Quota
import openai

# 1. Inicializa o monitoramento global do Quota (uma única vez na inicialização)
Quota.init(
    api_key="quota_live_sua_chave_de_api"
)

# 2. Executa chamadas com monitoramento automático
response = Quota.intercept_mcp(
    action=lambda: openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Olá, mundo!"}]
    ),
    provider="openai",
    model="gpt-4o"
)

print(response.choices[0].message.content)
```

---

### 🤖 Exemplos de Uso por Provedor

#### 1. OpenAI SDK (`openai`)
```python
from quota import Quota
import openai

Quota.init(api_key="quota_live_sua_chave")

client = openai.OpenAI()
res = Quota.intercept_mcp(
    action=lambda: client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Resuma este texto."}]
    ),
    provider="openai",
    model="gpt-4o"
)
```

#### 2. Anthropic SDK (`anthropic`)
```python
from quota import Quota
import anthropic

Quota.init(api_key="quota_live_sua_chave")

client = anthropic.Anthropic()
res = Quota.intercept_mcp(
    action=lambda: client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Explique computação quântica."}]
    ),
    provider="anthropic",
    model="claude-3-5-sonnet-20241022"
)
```

#### 3. Google Gemini (`google-generativeai`)
```python
from quota import Quota
import google.generativeai as genai

Quota.init(api_key="quota_live_sua_chave")

model = genai.GenerativeModel("gemini-2.0-flash")
res = Quota.intercept_mcp(
    action=lambda: model.generate_content("Escreva um poema sobre IA."),
    provider="google",
    model="gemini-2.0-flash"
)
```

#### 4. Groq SDK (`groq`)
```python
from quota import Quota
from groq import Groq

Quota.init(api_key="quota_live_sua_chave")

client = Groq()
res = Quota.intercept_mcp(
    action=lambda: client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Olá Groq!"}]
    ),
    provider="groq",
    model="llama-3.3-70b-versatile"
)
```

#### 5. Mistral SDK (`mistralai`)
```python
from quota import Quota
from mistralai import Mistral

Quota.init(api_key="quota_live_sua_chave")

client = Mistral()
res = Quota.intercept_mcp(
    action=lambda: client.chat.complete(
        model="mistral-large-latest",
        messages=[{"role": "user", "content": "Olá Mistral!"}]
    ),
    provider="mistral",
    model="mistral-large-latest"
)
```

---

### 🧠 Suporte Nativo a Model Context Protocol (MCP)

#### Opção A: Envelopando um Cliente MCP (`Quota.wrap_mcp`)
```python
from quota import Quota

Quota.init(
    api_key="quota_live_sua_chave",
    project="automacao-vendas",
    agent="agente-prospeccao"
)

# Envelopa o cliente MCP em 1 única linha
mcp_client = Quota.wrap_mcp(meu_mcp_client, tags=["mcp", "tools", "crm"])

# As chamadas a call_tool são automaticamente interceptadas com tokens, latência e status!
resultado = mcp_client.call_tool(name="consultar_lead_crm", email="contato@empresa.com")
```

#### Opção B: Interceptador Funcional Direto (`Quota.intercept_mcp`)
```python
from quota import Quota

resposta = Quota.intercept_mcp(
    action=lambda: minha_funcao_de_ia_ou_tool(),
    provider="anthropic",
    tags=["mcp-action", "juridico"]
)
```

---

### 🏷️ Passando Metadados de Observabilidade (Opcional)

#### Opção A: Metadados Globais na Inicialização (Recomendado)
```python
from quota import Quota

Quota.init(
    api_key="quota_live_sua_chave",
    project="portal-cliente",     # Projeto / Setor
    agent="bot-suporte",          # Agente / Assistente
    environment="production"      # Ambiente (production, staging, etc)
)
```

#### 📋 Parâmetros Suportados:

| Parâmetro no `Quota.init()` | Tipo | Descrição & Caso de Uso |
| :--- | :--- | :--- |
| `project` | `str` | Nome do Projeto ou Setor da empresa. |
| `agent` | `str` | Nome do Agente ou Robô de IA. |
| `environment` | `str` | Ambiente (`production`, `staging`, `development`). |
| `externalUserId` | `str` | ID do usuário final da sua aplicação. |
| `requestGroup` | `str` | Agrupamento de fluxo de execução. |
| `billingGroup` | `str` | Grupo de faturamento, centro de custo ou equipe. |
| `tags` | `list[str]` | Lista de tags (`["tag1", "tag2"]`). |

---

### 🛠️ Testes Locais (Desenvolvimento)

```python
Quota.init(
    api_key="quota_live_sua_chave",
    endpoint="http://localhost:3000/collector"  # Sobrescreve para ambiente local
)
```

Ou usando variável de ambiente `.env`:
```env
QUOTA_ENDPOINT=http://localhost:3000/collector
```

---

### 📊 Rastreamento Manual (`Quota.track_usage`)

```python
from quota import Quota

Quota.init(api_key="quota_live_sua_chave")

Quota.track_usage({
    "provider": "openai",
    "model": "gpt-4o",
    "promptTokens": 120,
    "completionTokens": 40,
    "cachedTokens": 20,
    "reasoningTokens": 10,
    "latencyMs": 350,
    "statusCode": 200,
    "success": True,
    "metadata": {
        "project": "meu-projeto",
        "agent": "bot-cobranca",
        "externalUserId": "user_123"
    }
})
```

---

### 🛡️ Segurança & Performance

- **Zero Latência (Fail-Safe)**: Envio assíncrono em thread daemon desacoplada.
- **Resiliência Anti-Crash**: Se a API de telemetria estiver instável ou sem conexão, a execução da sua IA **nunca é interrompida**.

---

<a name="english"></a>
## 🇺🇸 English

### 📦 Installation

```bash
pip install quota-sdk
```

---

### 🚀 Quickstart (1-Line Setup)

```python
from quota import Quota
import openai

# 1. Initialize Quota global monitoring
Quota.init(
    api_key="quota_live_YOUR_API_KEY"
)

# 2. Run your LLM calls with automatic monitoring
response = Quota.intercept_mcp(
    action=lambda: openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello, world!"}]
    ),
    provider="openai",
    model="gpt-4o"
)

print(response.choices[0].message.content)
```

---

### 🤖 Usage Examples by Provider

#### 1. OpenAI SDK (`openai`)
```python
from quota import Quota
import openai

Quota.init(api_key="quota_live_YOUR_KEY")

client = openai.OpenAI()
res = Quota.intercept_mcp(
    action=lambda: client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Summarize this text."}]
    ),
    provider="openai",
    model="gpt-4o"
)
```

#### 2. Anthropic SDK (`anthropic`)
```python
from quota import Quota
import anthropic

Quota.init(api_key="quota_live_YOUR_KEY")

client = anthropic.Anthropic()
res = Quota.intercept_mcp(
    action=lambda: client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Explain quantum computing."}]
    ),
    provider="anthropic",
    model="claude-3-5-sonnet-20241022"
)
```

#### 3. Google Gemini (`google-generativeai`)
```python
from quota import Quota
import google.generativeai as genai

Quota.init(api_key="quota_live_YOUR_KEY")

model = genai.GenerativeModel("gemini-2.0-flash")
res = Quota.intercept_mcp(
    action=lambda: model.generate_content("Write a poem about AI."),
    provider="google",
    model="gemini-2.0-flash"
)
```

#### 4. Groq SDK (`groq`)
```python
from quota import Quota
from groq import Groq

Quota.init(api_key="quota_live_YOUR_KEY")

client = Groq()
res = Quota.intercept_mcp(
    action=lambda: client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Hello Groq!"}]
    ),
    provider="groq",
    model="llama-3.3-70b-versatile"
)
```

#### 5. Mistral SDK (`mistralai`)
```python
from quota import Quota
from mistralai import Mistral

Quota.init(api_key="quota_live_YOUR_KEY")

client = Mistral()
res = Quota.intercept_mcp(
    action=lambda: client.chat.complete(
        model="mistral-large-latest",
        messages=[{"role": "user", "content": "Hello Mistral!"}]
    ),
    provider="mistral",
    model="mistral-large-latest"
)
```

---

### 🧠 Native Model Context Protocol (MCP) Support

#### Option A: Wrap an MCP Client (`Quota.wrap_mcp`)
```python
from quota import Quota

Quota.init(
    api_key="quota_live_YOUR_KEY",
    project="sales-automation",
    agent="lead-enricher"
)

mcp_client = Quota.wrap_mcp(my_raw_mcp_client, tags=["mcp", "tools", "sales"])

result = mcp_client.call_tool(name="query_customer_lead", email="client@company.com")
```

#### Option B: Functional Interceptor (`Quota.intercept_mcp`)
```python
from quota import Quota

response = Quota.intercept_mcp(
    action=lambda: call_my_ai_tool(),
    provider="anthropic",
    tags=["mcp-action", "legal"]
)
```

---

### 📋 Supported Observability Parameters

| Parameter in `Quota.init()` | Type | Description |
| :--- | :--- | :--- |
| `project` | `str` | Project or department name. |
| `agent` | `str` | AI Assistant or Bot name. |
| `environment` | `str` | Environment (`production`, `staging`, `development`). |
| `externalUserId` | `str` | End-user ID for per-user cost tracking. |
| `requestGroup` | `str` | Execution workflow or feature group. |
| `billingGroup` | `str` | Billing group, cost center, or team. |
| `tags` | `list[str]` | List of tags (`["tag1", "tag2"]`). |

---

### 🛠️ Local Testing (Development)

```python
Quota.init(
    api_key="quota_live_YOUR_KEY",
    endpoint="http://localhost:3000/collector"
)
```

---

### 📊 Manual Tracking (`Quota.track_usage`)

```python
from quota import Quota

Quota.init(api_key="quota_live_YOUR_KEY")

Quota.track_usage({
    "provider": "openai",
    "model": "gpt-4o",
    "promptTokens": 120,
    "completionTokens": 40,
    "cachedTokens": 20,
    "reasoningTokens": 10,
    "latencyMs": 350,
    "statusCode": 200,
    "success": True,
    "metadata": {
        "project": "my-project",
        "agent": "billing-bot",
        "externalUserId": "user_123"
    }
})
```

---

### 🛡️ Security & Performance

- **Zero Latency (Fail-Safe)**: Async background dispatch via daemon threads.
- **Anti-Crash Resilience**: If telemetry is down or unreachable, your AI request **never breaks or fails**.

---

## 📄 Licença / License
MIT © Quota
