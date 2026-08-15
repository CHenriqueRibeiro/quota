# quota-cli

> **CLI oficial do Quota para monitoramento transparente de consumo de IA** (Claude Code, Codex, Gemini).

O `quota-cli` permite monitorar automaticamente o consumo de tokens, requisições e custos de assistentes de IA diretamente da sua máquina em tempo real.

---

## 🚀 Instalação

Você pode instalar a CLI globalmente via `npm`:

```bash
npm install -g quota-cli
```

Ou executar diretamente com `npx`:

```bash
npx quota-cli --help
```

---

## 🛠️ Comandos e Funcionalidades

### 1. Autenticação (`quota login`)
Autentica a CLI vinculando sua máquina à sua conta Quota através de uma `QUOTA_USER_KEY`.

```bash
# Autenticar com a chave diretamente
quota login <SUA_QUOTA_USER_KEY>

# Ou abrir o navegador para copiar a chave na sua conta Quota
quota login --open
```

### 2. Monitoramento Transparente (`quota watch`)
Inicia o monitoramento automático de logs e uso de LLMs em segundo plano (background daemon).

```bash
quota watch
```

**Assistentes Suportados:**
- 🤖 **Claude Code** (monitora logs do Claude Code CLI em `~/.claude/`)
- 🤖 **Codex** (monitora logs de sessões do Codex em `~/.codex/`)
- 🤖 **Gemini** (monitora logs do Gemini CLI em `~/.gemini/`)

O `quota watch` detecta requisições, modelo utilizado, quantidade de tokens de prompt/resposta e reporta a telemetria ao Quota de forma transparente.

### 3. Verificar Status (`quota status`)
Exibe o status atual da conexão, chave salva e o estado do processo daemon em segundo plano.

```bash
quota status
```

### 4. Parar Monitoramento (`quota stop`)
Encerra o processo de monitoramento em segundo plano.

```bash
quota stop
```

---

## 🌐 Configuração de Ambiente

Por padrão, a CLI se conecta ao servidor oficial do Quota. Caso esteja utilizando um servidor próprio (self-hosted), você pode definir a URL base durante o login:

```bash
quota login <SUA_CHAVE> --url https://meu-servidor-quota.com
```

---

## 📄 Licença
[MIT](LICENSE)
