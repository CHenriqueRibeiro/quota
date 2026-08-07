# quota-sdk (Python)

SDK oficial em Python para telemetria, monitoramento de latência e consumo de tokens de modelos de IA (OpenAI, Anthropic, Gemini, Groq, etc.) para a plataforma **Quota**.

---

## 📦 Instalação

```bash
pip install quota-sdk
```

---

## 🚀 Uso Rápido (1 Linha de Configuração)

Basta chamar `Quota.init()` no início da sua aplicação (ex: `main.py` ou `app.py`).

```python
from quota import Quota
from openai import OpenAI

# 1. Inicializa o monitoramento do Quota (uma única vez na inicialização)
Quota.init(api_key="qta_live_sua_chave_de_api")

# 2. Use qualquer SDK oficial de IA normalmente!
client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Olá!"}]
)

print(response.choices[0].message.content)
```

---

## 🤖 Exemplos de Uso por Provedor em Python

Como o `Quota.init()` intercepta automaticamente chamadas via `httpx` e `requests`, você pode usar os SDKs oficiais das IAs diretamente:

### 1. OpenAI SDK (`openai`)
```python
from quota import Quota
from openai import OpenAI

Quota.init(api_key="qta_live_sua_chave")

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Resuma este artigo."}]
)
```

### 2. Anthropic SDK (`anthropic`)
```python
from quota import Quota
import anthropic

Quota.init(api_key="qta_live_sua_chave")

client = anthropic.Anthropic()
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Explique astrofísica."}]
)
```

### 3. Groq SDK (`groq`)
```python
from quota import Quota
from groq import Groq

Quota.init(api_key="qta_live_sua_chave")

client = Groq()
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Olá Groq!"}]
)
```

### 4. Google Gemini (`google-generativeai`)
```python
from quota import Quota
import google.generativeai as genai

Quota.init(api_key="qta_live_sua_chave")

genai.configure(api_key="SUA_CHAVE_GEMINI")
model = genai.GenerativeModel("gemini-1.5-pro")
response = model.generate_content("Escreva uma história curta.")
```

> [!IMPORTANT]
> **API Key do Quota é a ÚNICA configuração obrigatória!**
> Todos os cabeçalhos `x-quota-*` e metadados (`project`, `agent`, `environment`, `externalUserId`) são **100% opcionais**. Se você passar apenas a `api_key`, o Quota rastreará todas as chamadas de IA automaticamente.

---

## 🏷️ Passando Metadados Customizados (Opcional)

Se você desejar categorizar e filtrar suas métricas por **Agente**, **Projeto**, **Usuário Final** ou **Tags**, você pode passar cabeçalhos `x-quota-*` nas requisições:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Qual o meu saldo?"}],
    extra_headers={
        "x-quota-agent": "bot-suporte-financeiro",
        "x-quota-user-id": "usr_991823",
        "x-quota-tags": "vip,suporte"
    }
)
```

### Cabeçalhos Suportados:
- `x-quota-project`: Nome do projeto.
- `x-quota-agent`: Nome do agente/assistente.
- `x-quota-user-id`: ID do usuário final da sua aplicação.
- `x-quota-tags`: Tags separadas por vírgula (`tag1,tag2`).
- `x-quota-billing-group`: Grupo de faturamento.
- `x-quota-environment`: Ambiente (`production`, `staging`, `development`).

---

## 🛠️ Ambiente Local (Desenvolvimento)

Por padrão, a telemetria é enviada para a API em produção (`https://quota-api.up.railway.app/collector`). Para testar localmente contra o seu servidor de desenvolvimento:

```python
Quota.init(
    api_key="qta_live_sua_chave_de_api",
    endpoint="http://localhost:3000/collector"  # Sobrescreve para ambiente local
)
```

Ou definindo a variável de ambiente no `.env`:
```env
QUOTA_ENDPOINT=http://localhost:3000/collector
```

### 🔧 Configurando o Ambiente de Desenvolvimento Local (`.venv`)

Para rodar os exemplos locais e desenvolver a SDK Python:

1. **Crie e ative um ambiente virtual (`.venv`)**:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Instale as dependências em modo editável**:
   ```bash
   pip install -e .
   ```

3. **Resolução de Avisos do IDE / Type Checker (Pyright / Pylance)**:
   Se o seu editor (VS Code, Cursor, PyCharm) exibir avisos como `Cannot find module httpx` ou `Cannot find module requests`:
   - Selecione o interpretador Python do projeto apontando para `.venv/Scripts/python.exe` (`Ctrl + Shift + P` -> **Python: Select Interpreter**).
   - O projeto já inclui suporte a `pyrightconfig.json` e `[tool.pyright]` no `pyproject.toml` vinculados à pasta `.venv`.

---

## 📊 Rastreamento Manual (`Quota.track_usage`)

Para enviar eventos de uso customizados:

```python
from quota import Quota

Quota.track_usage({
    "provider": "openai",
    "model": "gpt-4o",
    "promptTokens": 150,
    "completionTokens": 50,
    "latencyMs": 380,
    "metadata": {
        "project": "meu-projeto",
        "agent": "bot-atendimento",
        "externalUserId": "user_123"
    }
})
```

---

## 🛡️ Segurança & Performance

- **Zero Latência (Thread Daemon Assíncrona):** O envio de dados é processado em background sem travar o loop de execução principal.
- **Fail-Safe:** Falhas na rede de telemetria nunca afetam ou interrompem o funcionamento da sua chamada de IA.
