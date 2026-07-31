# Quota Backend

## Visão Geral

`quota` é um serviço backend multitenant em TypeScript de alta performance projetado para gerenciar ambientes, usuários, chaves de API, credenciais de provedores de Inteligência Artificial (LLMs), controle de quota/rate-limiting via Redis, enfileiramento de telemetria de uso via BullMQ, assistentes de IA, tópicos de consulta, widgets interativos de chat e análises de consumo.

Ele oferece:
- **Autenticação & Autorização**: Autenticação via JWT com suporte a papéis (`OWNER`, `MANAGER`, `ANALYST`, `DEV`) e segredo de sistema (`x-system-secret`).
- **Multitenancy & Escopos**: Isolamento completo por Tenant e controle de visualização customizado via Scopes.
- **Proxy & Ingestão de Telemetria**: Endpoint Proxy para roteamento de chamadas a provedores reais (`OpenAI`, `Anthropic`, `Google`, `Groq`, `Mistral`) com aplicação de rate-limit e collector para registro de consumo assíncrono.
- **Assistentes, Tópicos e Widgets**: Criação de assistentes configuráveis com prompts de sistema, tópicos pré-definidos ou customizados e widgets web embarcáveis.
- **Alertas & Falhas**: Motor de alertas de consumo por limite de custo/tokens e gerenciamento de retentativas para logs de falha.
- **Analytics Completo**: Métricas detalhadas de chamadas, tokens, custos, latência, agrupados por provedor, modelo, projeto, agente, grupo de faturamento e usuário.

---

## Hierarquia de Recursos e Entidades

A arquitetura do `quota` segue uma hierarquia de dependência estrita entre suas entidades. Abaixo está a ordem lógica de prioridade das rotas e recursos do sistema:

1. **Tenant (Ambiente / Cliente Multitenant)**  
   É a raiz de tudo no sistema. Todos os demais recursos pertencem a um `Tenant` (`tenantId`).
2. **User (Usuário do Tenant)**  
   Usuários pertencem a um Tenant e possuem papéis hierárquicos (`OWNER` > `MANAGER` > `ANALYST` > `DEV`).
3. **Scope (Escopos de Permissão / Filtros)**  
   Define as regras de acesso e visualização de dados de um usuário dentro de um tenant (`ALL` ou `CUSTOM` filtrando por projetos, agentes, provedores, modelos, etc.).
4. **Provider Credential (Credenciais de Provedores LLM)**  
   Armazena as chaves de API e URLs base dos provedores de IA (`OpenAI`, `Anthropic`, `Google`, `Groq`, `Mistral`) de cada Tenant.
5. **API Key (Chaves de API do Quota)**  
   Chaves de autenticação emitidas pelo Quota vinculadas a um Tenant e a uma Credencial de Provider. Usadas para autenticar no `/proxy` e `/collector`.
6. **Billing Group (Grupos de Faturamento / Centros de Custo)**  
   Agrupadores opcionais dentro do tenant para categorização financeira do uso de IA.
7. **Assistant (Assistentes de IA)**  
   Configuração de assistentes de IA associados a um Tenant, Scope e API Key.
8. **Topic (Tópicos de Análise e Consultas)**  
   Perguntas e análises estruturadas associadas a um assistente de IA.
9. **Widget (Chat Widget Embutível)**  
   Widget público de chat configurado para um assistente do tenant, com validação de domínios permitidos.
10. **Widget Chat & Upload (Sessões Públicas de Chat)**  
    Endpoints de inicialização de sessão, seleção de tópico e upload de logos para o widget.
11. **Proxy & Collector (Roteamento e Ingestão de Telemetria)**  
    Endpoints de consumo de IA que processam chamadas reais e enfileiram métricas no Redis/BullMQ.
12. **Alerts & Notifications (Motor de Alertas)**  
    Regras para monitoramento de custos e notificação por e-mail.
13. **Failed Usage (Re-tentativa de Logs de Falha)**  
    Gestão de requisições de telemetria falhas para re-processamento.
14. **Analytics & Dashboard (Relatórios e Métricas)**  
    Consolidação de dados de consumo respeitando o Tenant e o Scope do usuário.
15. **Home (Visão Geral Resumida)**  
    Dashboard básico da aplicação.
16. **Autenticação (Login e Gerenciamento de Acesso)**  
    Login, logout e alteração de senha de usuários.

---

## Tecnologias

- **Runtime & Pacotes**: `bun`
- **Framework HTTP**: `fastify` (com suporte a `@fastify/cors`, `@fastify/static`, `@fastify/multipart`)
- **Linguagem**: `TypeScript`
- **Banco de Dados & ORM**: PostgreSQL via `Prisma`
- **Cache & Rate-Limit**: Redis via `ioredis`
- **Fila de Jobs**: `BullMQ`
- **Criptografia & Autenticação**: `argon2`, `jsonwebtoken`
- **Upload de Imagens**: Cloudinary (`cloudinary`)

---

## Estrutura do Projeto

```text
.
├── index.ts                     # Ponto de entrada do servidor Fastify
├── prisma/
│   └── schema.prisma            # Esquema do banco de dados PostgreSQL
├── src/
│   ├── @types/                  # Extensões de tipo do Fastify
│   ├── controllers/             # Controladores das rotas HTTP
│   ├── lib/                     # Clientes de Redis, Queue (BullMQ), Providers LLM
│   ├── middleware/              # Auth, Authorize, API Key Validator, Quota Limiter
│   ├── routes/                  # Declaração e registro de rotas por módulo
│   ├── schemas/                 # Validações e tipos adicionais
│   ├── service/                 # Regras de negócio e integração com banco/LLMs
│   ├── types/                   # Interfaces TypeScript compartilhadas
│   └── workers/                 # Processadores de fila (BullMQ workers)
├── README.md                    # Documentação do projeto
└── package.json                 # Dependências e scripts
```

---

## Configuração de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000
DATABASE_URL="postgresql://usuario:senha@localhost:5432/quota?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="sua_chave_secreta_jwt_super_segura"
SYSTEM_OWNER_SECRET="segredo_opcional_para_acesso_sistema"

# Cloudinary (Upload de logos de widgets)
CLOUDINARY_CLOUD_NAME="seu_cloud_name"
CLOUDINARY_API_KEY="sua_api_key"
CLOUDINARY_API_SECRET="seu_api_secret"
```

---

## Instalação e Execução

### 1. Instalar dependências
```bash
bun install
```

### 2. Migrações do Banco de Dados
```bash
bun prisma generate
bun prisma migrate deploy
```

### 3. Iniciar o Servidor
```bash
bun run index.ts
```
O servidor será iniciado na porta especificada (`PORT` ou `3000`).

---

## Autenticação, Autorização e Escopos

- **Autenticação JWT**: Enviada no header `Authorization: Bearer <token>`.
- **Autenticação via API Key do Quota**: Enviada no header `x-api-key: quota_live_...`.
- **Autenticação de Sistema**: Enviada no header `x-system-secret: <SYSTEM_OWNER_SECRET>`.
- **Hierarquia de Roles**:
  - `OWNER`: Controle total do tenant. Pode criar outros OWNERs.
  - `MANAGER`: Gerencia usuários (exceto OWNER), API Keys, Credenciais de Provedores e Billing Groups.
  - `ANALYST`: Visualização de dados e relatórios.
  - `DEV`: Acesso operacional básico.
- **Mapeamento de Escopos (`Scope`)**:
  - `ALL`: Acesso ilimitado a todos os dados do tenant.
  - `CUSTOM`: Acesso restrito a billing groups, projetos, agentes, provedores e modelos específicos definidos nas regras do escopo.

---

## Documentação Detalhada das Rotas

> **Legenda de Parâmetros**:  
> - **(Obrigatório)**: Parâmetro requerido para a execução da rota.  
> - **(Opcional)**: Parâmetro opcional.  

---

### 1. Tenants (Ambientes Multitenant)

#### `POST /tenants`
Cria um novo ambiente/tenant no sistema.
- **Autenticação**: Nenhum (Público)
- **Body (JSON)**:
  - `name` (string, **Obrigatório**): Nome do ambiente/tenant.
  - `slug` (string, **Obrigatório**): Identificador único em minúsculas (ex: `"minha-empresa"`).
  - `plan` (string, **Opcional**): Plano do tenant (`STARTER` | `PRO` | `ENTERPRISE`). Padrão: `"STARTER"`.
- **Resposta (201 Created)**:
  ```json
  {
    "message": "Ambiente criado com sucesso",
    "tenant": {
      "id": "uuid",
      "name": "Minha Empresa",
      "slug": "minha-empresa",
      "plan": "STARTER",
      "isActive": true,
      "createdAt": "2026-07-31T00:00:00.000Z"
    }
  }
  ```

#### `POST /tenants/:tenantId/api-keys`
Gera uma nova chave de API do Quota associada a uma credencial de provider do tenant.
- **Autenticação**: `Bearer <token>` (Requer role `MANAGER` ou superior do tenant)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Body (JSON)**:
  - `providerCredentialId` (string, **Obrigatório**): ID da credencial de provider cadastrada no tenant.
  - `name` (string, **Opcional**): Nome identificador da API key. Padrão: `"default"`.
  - `allowedModels` (array de strings, **Opcional**): Lista de modelos permitidos para esta chave (ex: `["gpt-4o", "gpt-4o-mini"]`).
- **Resposta (201 Created)**:
  ```json
  {
    "message": "API key criada com sucesso",
    "apiKey": {
      "id": "uuid",
      "key": "quota_live_xxxxxxxxxxxxxxxxxxxxxxxx",
      "name": "Chave Producao",
      "provider": "OPENAI",
      "allowedModels": ["gpt-4o"],
      "isActive": true
    }
  }
  ```

#### `GET /tenants/:tenantId/api-keys`
Lista todas as chaves de API geradas para o tenant.
- **Autenticação**: `Bearer <token>` (Requer role `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**:
  ```json
  {
    "apiKeys": [
      {
        "id": "uuid",
        "name": "Chave Producao",
        "key": "quota_live_xxxxxxxxxxxxxxxxxxxxxxxx",
        "isActive": true,
        "createdAt": "2026-07-31T00:00:00.000Z"
      }
    ]
  }
  ```

#### `POST /tenants/:tenantId/provider-credentials`
Cadastra ou atualiza (upsert) as credenciais de um provedor LLM real para o tenant.
- **Autenticação**: `Bearer <token>` (Requer role `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Body (JSON)**:
  - `provider` (string, **Obrigatório**): Provedor suportado (`openai` | `anthropic` | `google` | `groq` | `mistral`).
  - `apiKey` (string, **Obrigatório**): Chave de API original do provedor de IA.
  - `baseUrl` (string, **Opcional**): URL base customizada para requisições ao provedor.
  - `isActive` (boolean, **Opcional**): Status da credencial. Padrão: `true`.
- **Resposta (201 Created)**:
  ```json
  {
    "message": "Provider credential criada com sucesso",
    "credential": {
      "id": "uuid",
      "provider": "OPENAI",
      "baseUrl": null,
      "isActive": true,
      "createdAt": "2026-07-31T00:00:00.000Z",
      "updatedAt": "2026-07-31T00:00:00.000Z"
    }
  }
  ```

#### `GET /tenants/:tenantId/provider-credentials`
Lista as credenciais de provedores configuradas para o tenant.
- **Autenticação**: `Bearer <token>` (Requer role `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**:
  ```json
  {
    "credentials": [
      {
        "id": "uuid",
        "provider": "OPENAI",
        "baseUrl": null,
        "isActive": true,
        "createdAt": "2026-07-31T00:00:00.000Z",
        "updatedAt": "2026-07-31T00:00:00.000Z"
      }
    ]
  }
  ```

---

### 2. Users (Usuários)

#### `POST /users`
Cria um novo usuário no tenant com senha padrão (`123456`).
- **Autenticação**: `Bearer <token>` (Requer autenticação; MANAGER não pode criar OWNER)
- **Body (JSON)**:
  - `email` (string, **Obrigatório**): E-mail do usuário.
  - `role` (string, **Obrigatório**): Papel (`OWNER` | `MANAGER` | `ANALYST` | `DEV`).
  - `name` (string, **Opcional**): Nome do usuário. Se omitido, utiliza o e-mail.
  - `tenantId` (string, **Opcional**): ID do tenant. Se omitido, utiliza o tenantId do usuário logado.
- **Resposta (201 Created)**:
  ```json
  {
    "message": "Usuário criado com sucesso",
    "user": {
      "id": "uuid",
      "email": "user@dominio.com",
      "tenantId": "uuid",
      "role": "ANALYST"
    },
    "defaultPassword": "123456"
  }
  ```

#### `POST /users/create-owner`
Cria um novo usuário com papel `OWNER`.
- **Autenticação**: `Bearer <token>` (Requer role `OWNER`)
- **Body (JSON)**:
  - `email` (string, **Obrigatório**): E-mail do usuário OWNER.
  - `tenantId` (string, **Obrigatório**): ID do tenant.
  - `name` (string, **Opcional**): Nome do usuário.
- **Resposta (201 Created)**:
  ```json
  {
    "message": "Owner criado com sucesso",
    "user": {
      "id": "uuid",
      "email": "owner@dominio.com",
      "tenantId": "uuid",
      "role": "OWNER"
    },
    "defaultPassword": "123456"
  }
  ```

#### `PUT /users/:id/scope`
Vincula ou altera o `Scope` de permissões de um usuário.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do usuário target.
- **Body (JSON)**:
  - `scopeId` (string ou `null`, **Opcional**): ID do Scope a vincular ou `null` para desvincular.
- **Resposta (200 OK)**:
  ```json
  {
    "message": "Scope vinculado com sucesso",
    "user": {
      "id": "uuid",
      "scopeId": "uuid_do_scope"
    }
  }
  ```

#### `GET /users` ou `GET /tenants/:tenantId/users`
Lista todos os usuários do tenant do usuário logado (ou do tenant especificado).
- **Autenticação**: `Bearer <token>`
- **Path Params / Query Params**:
  - `tenantId` (string, **Opcional**): ID do tenant. Se omitido, utiliza o `tenantId` do usuário autenticado.
- **Resposta (200 OK)**:
  ```json
  [
    {
      "id": "uuid",
      "email": "user@dominio.com",
      "name": "Nome do Usuário",
      "role": "ANALYST",
      "tenantId": "uuid",
      "scopeId": "uuid_opcional",
      "createdAt": "2026-07-31T00:00:00.000Z",
      "scope": {
        "id": "uuid_opcional",
        "name": "Nome do Escopo",
        "mode": "CUSTOM"
      }
    }
  ]
  ```

---

### 3. Scopes (Escopos de Permissão)

#### `POST /scopes`
Cria um novo Scope de filtragem para restringir a visualização de métricas e recursos.
- **Autenticação**: `Bearer <token>` (Requer role `OWNER` ou `MANAGER`)
- **Body (JSON)**:
  - `name` (string, **Obrigatório**): Nome do escopo.
  - `mode` (string, **Obrigatório**): Modo de acesso (`ALL` | `CUSTOM`).
  - `description` (string, **Opcional**): Descrição funcional.
  - `billingGroups` (array de strings, **Opcional**): Nomes dos billing groups permitidos.
  - `projects` (array de strings, **Opcional**): Nomes dos projetos permitidos.
  - `agents` (array de strings, **Opcional**): Nomes dos agentes permitidos.
  - `providers` (array de strings, **Opcional**): Provedores permitidos (`OPENAI`, `ANTHROPIC`, etc.).
  - `models` (array de strings, **Opcional**): Modelos permitidos.
- **Resposta (201 Created)**: Objeto `Scope` criado.

#### `GET /scopes/tenant/:tenantId`
Lista todos os escopos cadastrados no tenant.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**: Array de objetos `Scope`.

#### `GET /scopes/:id`
Busca os detalhes de um escopo por ID.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do escopo.
- **Resposta (200 OK)**: Objeto `Scope`.

#### `PUT /scopes/:id`
Atualiza as configurações de um escopo existente.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do escopo.
- **Body (JSON)** (Todos os campos opcionais):
  - `name` (string, **Opcional**)
  - `description` (string, **Opcional**)
  - `mode` (string, **Opcional**)
  - `billingGroups` (array de strings, **Opcional**)
  - `projects` (array de strings, **Opcional**)
  - `agents` (array de strings, **Opcional**)
  - `providers` (array de strings, **Opcional**)
  - `models` (array de strings, **Opcional**)
- **Resposta (200 OK)**: Objeto `Scope` atualizado.

#### `DELETE /scopes/:id`
Remove um escopo por ID.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do escopo.
- **Resposta (200 OK)**: `{ "success": true }`

#### `PUT /scopes/assign-user`
Atribui ou altera o escopo de um usuário.
- **Autenticação**: `Bearer <token>` (Requer `OWNER` ou `MANAGER`)
- **Body (JSON)**:
  - `userId` (string, **Obrigatório**): ID do usuário.
  - `scopeId` (string ou `null`, **Opcional**): ID do escopo ou `null`.
- **Resposta (200 OK)**: Objeto `User` atualizado.

---

### 4. Billing Groups (Grupos de Faturamento)

#### `GET /tenants/:tenantId/billing-groups`
Lista os grupos de faturamento/centros de custo do tenant.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**: Array de objetos `BillingGroup`.

#### `POST /tenants/:tenantId/billing-groups`
Cria um novo grupo de faturamento no tenant.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Body (JSON)**:
  - `name` (string, **Obrigatório**): Nome do grupo de faturamento (ex: `"Departamento de Vendas"`).
- **Resposta (201 Created)**: Objeto `BillingGroup` criado.

#### `DELETE /tenants/:tenantId/billing-groups/:id`
Exclui um grupo de faturamento do tenant.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
  - `id` (string, **Obrigatório**): ID do grupo de faturamento a ser excluído.
- **Resposta (200 OK)**:
  ```json
  {
    "message": "Billing group deleted successfully"
  }
  ```

---

### 5. Assistants (Assistentes de IA)

#### `POST /assistants`
Cria um novo assistente de IA no tenant.
- **Autenticação**: `Bearer <token>`
- **Body (JSON)**:
  - `name` (string, **Obrigatório**): Nome do assistente.
  - `systemPrompt` (string, **Obrigatório**): Prompt do sistema / Instruções base.
  - `apiKeyId` (string, **Obrigatório**): ID da API key do Quota vinculada ao assistente.
  - `type` (string, **Obrigatório**): Categoria do assistente (`GENERAL`, `SUPPORT`, `FINANCE`, `SALES`, etc.).
  - `model` (string, **Obrigatório**): Nome do modelo (ex: `"gpt-4o"`).
  - `description` (string, **Opcional**): Descrição funcional.
  - `temperature` (number, **Opcional**): Temperatura da resposta (0.0 a 1.0). Padrão: `0.2`.
  - `maxTokens` (number, **Opcional**): Máximo de tokens na resposta. Padrão: `4096`.
  - `enabled` (boolean, **Opcional**): Status ativo/inativo. Padrão: `true`.
  - `scopeId` (string, **Opcional**): ID do Scope associado ao assistente.
  - `isDefault` (boolean, **Opcional**): Define se é o assistente padrão do tenant. Padrão: `false`.
  - `sortOrder` (number, **Opcional**): Ordem de exibição. Padrão: `0`.
- **Resposta (201 Created)**: `{ "data": Assistant }`

#### `GET /assistants`
Lista todos os assistentes cadastrados no tenant.
- **Autenticação**: `Bearer <token>`
- **Resposta (200 OK)**: `{ "data": Array<Assistant> }`

#### `GET /assistants/api-keys`
Lista as API keys ativas do tenant disponíveis para vínculo com assistentes.
- **Autenticação**: `Bearer <token>`
- **Resposta (200 OK)**: `{ "data": Array<{ id, name, provider }> }`

#### `GET /assistants/:id`
Exibe os detalhes de um assistente específico (incluindo escopo, API Key e tópicos).
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do assistente.
- **Resposta (200 OK)**: `{ "data": AssistantCompleto }`

#### `PUT /assistants/:id`
Atualiza dados de um assistente de IA.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do assistente.
- **Body (JSON)** (Campos opcionais):
  - `name` (string, **Opcional**)
  - `description` (string, **Opcional**)
  - `type` (string, **Opcional**)
  - `apiKeyId` (string, **Opcional**)
  - `model` (string, **Opcional**)
  - `systemPrompt` (string, **Opcional**)
  - `temperature` (number, **Opcional**)
  - `maxTokens` (number, **Opcional**)
  - `enabled` (boolean, **Opcional**)
  - `scopeId` (string, **Opcional**)
  - `isDefault` (boolean, **Opcional**)
  - `sortOrder` (number, **Opcional**)
- **Resposta (200 OK)**: `{ "data": Assistant }`

#### `DELETE /assistants/:id`
Remove um assistente.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do assistente.
- **Resposta (200 OK)**: `{ "data": Assistant, "message": "Assistente removido com sucesso." }`

---

### 6. Topics (Tópicos de Análise)

#### `GET /topics/defaults`
Lista a biblioteca de tópicos padrões disponíveis no sistema.
- **Autenticação**: `Bearer <token>`
- **Query Params**:
  - `category` (string, **Opcional**): Categoria para filtro (`GENERAL` | `FINANCE` | `OPERATIONS` | `SUPPORT` | `SALES`).
- **Resposta (200 OK)**: `{ "data": Array<DefaultTopic> }`

#### `POST /topics/defaults`
Importa tópicos padrões da biblioteca para um assistente.
- **Autenticação**: `Bearer <token>`
- **Body (JSON)**:
  - `assistantId` (string, **Obrigatório**): ID do assistente destino.
  - `topicKeys` (array de strings, **Obrigatório**): Lista de chaves dos tópicos a importar (ex: `["general_usage_summary", "finance_month_spend"]`).
- **Resposta (201 Created)**: `{ "created": number, "skipped": number, "data": Array<Topic> }`

#### `POST /topics`
Cria um tópico customizado.
- **Autenticação**: `Bearer <token>`
- **Body (JSON)**:
  - `name` (string, **Obrigatório**): Nome do tópico.
  - `description` (string, **Opcional**): Descrição.
  - `category` (string, **Opcional**): Categoria.
  - `assistantId` (string, **Opcional**): ID do assistente associado.
  - `questions` (array de strings, **Opcional**): Perguntas de sugestão.
  - `enabled` (boolean, **Opcional**): Status. Padrão: `true`.
  - `sortOrder` (number, **Opcional**): Ordem. Padrão: `0`.
- **Resposta (201 Created)**: `{ "data": Topic }`

#### `GET /topics`
Lista os tópicos do tenant.
- **Autenticação**: `Bearer <token>`
- **Resposta (200 OK)**: `{ "data": Array<Topic> }`

#### `GET /topics/:id`
Busca detalhes de um tópico por ID.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do tópico.
- **Resposta (200 OK)**: `{ "data": Topic }`

#### `POST /topics/:id/execute`
Executa a análise do tópico agregando dados de consumo do tenant no período e submetendo à LLM do assistente.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do tópico.
- **Body (JSON)**:
  - `startDate` (string ISO, **Opcional**): Data inicial para filtro.
  - `endDate` (string ISO, **Opcional**): Data final para filtro.
- **Resposta (200 OK)**:
  ```json
  {
    "data": {
      "topic": "Resumo de utilização",
      "answer": "Texto gerado pela IA sintetizando os dados...",
      "tokens": 450,
      "latencyMs": 1200
    }
  }
  ```

#### `PUT /topics/:id`
Atualiza um tópico customizado.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do tópico.
- **Body (JSON)** (Campos opcionais):
  - `name` (string, **Opcional**)
  - `description` (string, **Opcional**)
  - `category` (string, **Opcional**)
  - `assistantId` (string, **Opcional**)
  - `questions` (array/json, **Opcional**)
  - `enabled` (boolean, **Opcional**)
  - `sortOrder` (number, **Opcional**)
- **Resposta (200 OK)**: `{ "data": Topic }`

#### `DELETE /topics/:id`
Remove um tópico por ID.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do tópico.
- **Resposta (200 OK)**: `{ "data": Topic, "message": "Tópico removido com sucesso." }`

---

### 7. Widgets (Configuração do Chat Embarcável)

#### `POST /widgets`
Configura um novo Widget para um assistente de IA.
- **Autenticação**: `Bearer <token>`
- **Body (JSON)**:
  - `assistantId` (string, **Obrigatório**): ID do assistente a ser embarcado.
  - `name` (string, **Obrigatório**): Nome do widget.
  - `allowedDomains` (array de strings, **Obrigatório**): Domínios permitidos para execução (ex: `["meusite.com"]`).
  - `securityLevel` (string, **Opcional**): Nível de segurança (`STANDARD` | `STRICT`). Padrão: `"STANDARD"`.
  - `rateLimit` (number, **Opcional**): Limite de chamadas por IP/minuto.
  - `logo` (string, **Opcional**): URL do logo.
  - `primaryColor` (string, **Opcional**): Cor primária em formato Hex.
  - `welcomeMessage` (string, **Opcional**): Mensagem de boas-vindas.
- **Resposta (201 Created)**: `{ "data": Widget }` (inclui a `publicKey`).

#### `GET /widget/public/:publicKey`
Obtém os dados visuais públicos do widget sem autenticação.
- **Autenticação**: Nenhum (Público)
- **Path Params**:
  - `publicKey` (string, **Obrigatório**): Chave pública do widget.
- **Resposta (200 OK)**: Dados de personalização visual do widget.

#### `GET /widget/init/:publicKey`
Inicializa uma nova sessão de chat no widget validando a origem.
- **Autenticação**: Nenhum (Público)
- **Path Params**:
  - `publicKey` (string, **Obrigatório**): Chave pública do widget.
- **Headers HTTP**:
  - `origin` (string, **Opcional**): Valida se a origem corresponde a `allowedDomains`.
  - `user-agent` (string, **Opcional**): Identificação do cliente.
- **Resposta (200 OK)**: `{ "sessionToken": "jwt_da_sessao", "widget": {...}, "topics": [...] }`

#### `PUT /widgets/:id/logo`
Upload de logo em formato imagem para o widget via Multipart Form.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do widget.
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `file` (arquivo de imagem, **Obrigatório**).
- **Resposta (200 OK)**: `{ "data": Widget }`

---

### 8. Widget Chat & Upload (Interação do Usuário Final)

#### `POST /widget/chat/select-topic`
Executa uma consulta de tópico dentro de uma sessão pública de chat no widget.
- **Autenticação**: Nenhum (Público - usa `sessionToken`)
- **Body (JSON)**:
  - `sessionToken` (string, **Obrigatório**): Token de sessão obtido na rota `/widget/init`.
  - `topicId` (string, **Obrigatório**): ID do tópico selecionado pelo usuário.
- **Resposta (200 OK)**: Objeto com a resposta gerada para o chat.

#### `POST /widget/upload-logo`
Rota auxiliar de upload de imagem para o Cloudinary.
- **Autenticação**: Nenhum (Público)
- **Body (JSON)**:
  - `image` (string, **Obrigatório**): Imagem em formato Base64 ou URL de origem.
- **Resposta (200 OK)**: `{ "url": "https://res.cloudinary.com/..." }`

---

### 9. Proxy & Collector (Ingestão e Telemetria)

#### `POST /proxy`
Encaminha requisições de IA para o provider configurado no tenant, aplicando rate-limiting de quota e enfileirando dados de telemetria.
- **Autenticação**: Header `x-api-key: quota_live_...` (**Obrigatório**) + Middleware `quotaLimiter(100 req/min)`
- **Headers HTTP**:
  - `x-api-key` (string, **Obrigatório**): Chave de API do Quota.
  - `x-billing-group` (string, **Opcional**): Nome do grupo de faturamento/centro de custo.
  - `x-agent` (string, **Opcional**): Nome do agente chamador.
  - `x-project` (string, **Opcional**): Nome do projeto.
  - `x-environment` (string, **Opcional**): Ambiente (`production`, `staging`, etc.).
  - `x-user-id` (string, **Opcional**): ID do usuário final.
  - `x-request-group` (string, **Opcional**): Agrupador customizado.
  - `x-trace-id` (string, **Opcional**): ID de rastreamento (gera UUID se omitido).
  - `x-tags` (string separada por vírgulas, **Opcional**): Tags para indexação (ex: `"v1,chat"`).
- **Body (JSON)**:
  - `model` (string, **Obrigatório**): Modelo a ser executado (ex: `"gpt-4o"`). Validado se houver restrições na API key.
  - *Demais propriedades*: Payload livre repassado diretamente para a API do provider (ex: `messages`, `temperature`, `max_tokens`).
- **Resposta (200 OK / Status do Provider)**:
  ```json
  {
    "provider": "OPENAI",
    "model": "gpt-4o",
    "billingGroup": "Vendas",
    "requestId": "req_uuid",
    "success": true,
    "statusCode": 200,
    "latencyMs": 850,
    "promptTokens": 120,
    "completionTokens": 80,
    "totalTokens": 200,
    "response": { ... }
  }
  ```

#### `POST /collector`
Registra métricas de uso de IA consumidas externamente sem realizar proxy.
- **Autenticação**: Header `x-api-key: quota_live_...` (**Obrigatório**) + Middleware `quotaLimiter(100 req/min)`
- **Body (JSON)**:
  - `provider` (string, **Obrigatório**): Nome do provedor utilizado.
  - `model` (string, **Obrigatório**): Nome do modelo utilizado.
  - `promptTokens` (number, **Opcional**): Tokens de entrada. Padrão: `0`.
  - `completionTokens` (number, **Opcional**): Tokens de saída. Padrão: `0`.
  - `totalTokens` (number, **Opcional**): Total de tokens. Padrão: `0`.
  - `latencyMs` (number, **Opcional**): Latência em milissegundos. Padrão: `0`.
  - `statusCode` (number, **Opcional**): Código HTTP do status. Padrão: `200`.
  - `success` (boolean, **Opcional**): Indicador de sucesso. Padrão: `true`.
  - `requestId` (string, **Opcional**): ID da requisição.
  - `traceId` (string, **Opcional**): ID de rastreamento.
  - `billingGroup` (string, **Opcional**): Grupo de faturamento.
  - `metadata` (object, **Opcional**):
    - `agent` (string, **Opcional**)
    - `project` (string, **Opcional**)
    - `environment` (string, **Opcional**)
    - `externalUserId` (string, **Opcional**)
    - `requestGroup` (string, **Opcional**)
    - `tags` (array de strings, **Opcional**)
- **Resposta (202 Accepted)**: `{ "success": true, "requestId": "uuid" }`

---

### 10. Alerts & Notifications (Sistema de Alertas)

#### `POST /alerts`
Cria uma regra de alerta para disparar e-mails caso limites de custo ou tokens sejam atingidos.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Body (JSON)**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
  - `type` (string, **Obrigatório**): Tipo de alerta (`COST_THRESHOLD` | `TOKEN_THRESHOLD` | `ERROR_RATE`).
  - `period` (string, **Obrigatório**): Período (`DAILY` | `MONTHLY`).
  - `threshold` (number, **Obrigatório**): Valor limite gatilho.
  - `email` (string, **Obrigatório**): E-mail de destino.
  - `provider` (string, **Opcional**): Filtro de provider.
  - `model` (string, **Opcional**): Filtro de modelo.
  - `project` (string, **Opcional**): Filtro de projeto.
  - `agent` (string, **Opcional**): Filtro de agente.
  - `billingGroupId` (string, **Opcional**): Filtro de grupo de faturamento.
- **Resposta (201 Created)**: `{ "message": "Alerta criado com sucesso", "alert": AlertConfig }`

#### `GET /alerts/tenants/:tenantId`
Lista todas as regras de alerta configuradas no tenant.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**: Array de regras `AlertConfig`.

#### `POST /alerts/process/:tenantId`
Executa o processamento manual da verificação de regras de alerta do tenant.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**: `{ "message": "Alertas processados com sucesso" }`

#### `POST /alerts/test/:alertConfigId`
Dispara uma notificação de e-mail de teste para validar a configuração de um alerta.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `alertConfigId` (string, **Obrigatório**): ID da regra de alerta.
- **Resposta (200 OK)**: `{ "message": "Alerta de teste enviado" }`

#### `GET /alerts/notifications/:tenantId`
Lista o histórico das últimas 100 notificações de alerta geradas para o tenant.
- **Autenticação**: `Bearer <token>` (Requer `MANAGER` ou superior)
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (200 OK)**: Array de notificações (`Notification`).

---

### 11. Failed Usage (Logs de Falha)

#### `GET /failed-usage`
Lista registros de falha de telemetria pendentes de re-processamento no tenant do usuário.
- **Autenticação**: `Bearer <token>`
- **Resposta (200 OK)**: `{ "success": true, "items": Array<FailedUsage> }`

#### `POST /failed-usage/:id/retry`
Submete novamente uma falha específica para a fila de telemetria do BullMQ.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `id` (string, **Obrigatório**): ID do registro de falha.
- **Resposta (202 Accepted)**: `{ "success": true, "message": "Retry queued", "requestId": "uuid" }`

#### `POST /failed-usage/tenant/:tenantId/retry`
Re-enfileira em lote todas as falhas pendentes de um tenant.
- **Autenticação**: `Bearer <token>`
- **Path Params**:
  - `tenantId` (string, **Obrigatório**): ID do tenant.
- **Resposta (202 Accepted)**: `{ "success": true, "total": number }`

---

### 12. Analytics & Dashboard (Métricas de Consumo)

> **Nota**: Todos os endpoints de Analytics exigem `Bearer <token>` e respeitam o `Scope` atribuído ao usuário logado.

#### `GET /analytics/dashboard`
Retorna um relatório analítico consolidado do tenant.
- **Autenticação**: `Bearer <token>`
- **Query Params**:
  - `startDate` (string ISO, **Opcional**): Data inicial (Padrão: 1º dia do mês atual).
  - `endDate` (string ISO, **Opcional**): Data final (Padrão: Data/hora atual).
- **Resposta (200 OK)**:
  ```json
  {
    "summary": { ... },
    "providers": [ ... ],
    "models": [ ... ],
    "projects": [ ... ],
    "billingGroups": [ ... ],
    "users": [ ... ],
    "agents": [ ... ],
    "dailyConsumption": [ ... ],
    "latency": [ ... ],
    "errors": [ ... ],
    "jobs": [ ... ]
  }
  ```

#### `GET /analytics/overview`
Resumo quantitativo de chamadas, tokens e custos.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Totais de requisições, tokens (input/output/total), custo total estimado e latência média.

#### `GET /analytics/providers`
Distribuição de consumo agrupada por Provedor LLM.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: `{ "period": {...}, "providers": [{ "name": "OPENAI", "requests": 500, "tokens": 150000, "cost": 0.45, "percentage": 75.0 }] }`

#### `GET /analytics/models`
Distribuição de consumo agrupada por Modelo.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Array com métricas por modelo de IA.

#### `GET /analytics/billing-groups`
Consumo de tokens e custos por Grupo de Faturamento.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Array com métricas por billing group.

#### `GET /analytics/projects`
Consumo agrupado por nome de Projeto (oriundo do header `x-project`).
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Array com métricas por projeto.

#### `GET /analytics/users`
Consumo agrupado por Usuário Externo (oriundo do header `x-user-id`).
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Array com métricas por usuário externo.

#### `GET /analytics/agents`
Consumo agrupado por Agente (oriundo do header `x-agent`).
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Array com métricas por agente.

#### `GET /analytics/daily-consumption`
Série temporal de requisições, tokens e custos por dia.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Array ordenado por data com totais diários.

#### `GET /analytics/latency`
Análise e tempo médio de resposta (latência em ms) por provedor e modelo.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Dados analíticos de latência.

#### `GET /analytics/jobs`
Métricas de tempo de execução e status dos jobs de processamento de telemetria.
- **Autenticação**: `Bearer <token>`
- **Query Params**: `startDate` (opcional), `endDate` (opcional)
- **Resposta (200 OK)**: Resumo de execução de jobs.

---

### 13. Home (Visão Geral)

#### `GET /home`
Retorna um compilado básico de indicadores para a página inicial do painel web.
- **Autenticação**: `Bearer <token>`
- **Resposta (200 OK)**: `{ "data": { ... } }`

---

### 14. Autenticação (Gerenciamento de Acesso)

#### `POST /auth/login`
Autentica um usuário existente e retorna o token JWT de acesso.
- **Autenticação**: Nenhum (Público)
- **Body (JSON)**:
  - `email` (string, **Obrigatório**): E-mail do usuário.
  - `password` (string, **Obrigatório**): Senha.
- **Resposta (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "id": "uuid",
      "email": "user@dominio.com",
      "name": "Nome Usuario",
      "role": "OWNER",
      "tenantId": "uuid_tenant"
    }
  }
  ```

#### `POST /auth/logout`
Realiza o encerramento da sessão do usuário.
- **Autenticação**: `Bearer <token>`
- **Resposta (200 OK)**: `{ "message": "Logout realizado com sucesso" }`

#### `POST /auth/update-password`
Atualiza a senha do usuário autenticado logado.
- **Autenticação**: `Bearer <token>`
- **Body (JSON)**:
  - `newPassword` (string, **Obrigatório**): Nova senha.
- **Resposta (200 OK)**: `{ "message": "Senha atualizada com sucesso" }`

---

## Quota & Redis (Rate Limiting)

O middleware `quotaLimiter(100)` limita as requisições a **100 chamadas por minuto** por tenant nos endpoints `/proxy` e `/collector`.

Chaves de controle no Redis:
- `quota:limit:<tenantId>` - TTL de 60 segundos.

Headers retornados em todas as requisições do Proxy:
- `X-Quota-Limit`: Limite configurado (ex: `100`).
- `X-Quota-Remaining`: Quantidade restante de requisições na janela atual.

---

## Fila de Telemetria (BullMQ)

- O arquivo `src/lib/queue.ts` configura a fila BullMQ denominada `usage`.
- Chamadas ao `/proxy` ou `/collector` disparam `addUsageJob(...)` enviando o payload da requisição.
- Em caso de indisponibilidade ou falha persistente de banco, a requisição é gravada na tabela `FailedUsage` com status `PENDING` para execução posterior via endpoints de retry (`/failed-usage/...`).

---

## Comandos Úteis

```bash
# Instalar dependências
bun install

# Iniciar servidor em desenvolvimento
bun run index.ts

# Gerar tipos do Prisma
bun prisma generate

# Aplicar migrações ao banco de dados
bun prisma migrate deploy

# Abrir Prisma Studio (interface visual do banco de dados)
bun prisma studio
```
