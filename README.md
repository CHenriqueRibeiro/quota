# quota

## Visão Geral

`quota` é um serviço backend em TypeScript para gerenciar ambientes multitenant, usuários, chaves de API e consumo de quota. Ele fornece:

- autenticação via JWT
- gerenciamento de tenants e usuários
- geração e validação de chaves de API
- limite de taxa/quota via Redis
- enfileiramento de logs de uso com BullMQ
- persistência de dados usando Prisma + PostgreSQL

## Tecnologias

- `bun` como runtime e gerenciador de pacotes
- `fastify` como servidor HTTP
- `typescript` para tipagem e qualidade de código
- `prisma` como ORM e controle de schema para PostgreSQL
- `ioredis` para conexão com Redis
- `bullmq` para enfileiramento de jobs de uso
- `argon2` para hashing de senha
- `jsonwebtoken` para tokens JWT
- `zod` está instalado, mas não usado diretamente no código atual

## Estrutura do Projeto

- `index.ts` - ponto de entrada do servidor
- `src/controllers` - lógica de negócio (autenticação, tenants, usuários, proxy)
- `src/routes` - definição de rotas HTTP
- `src/middleware` - autenticação, autorização, validação de API key e quota
- `src/lib` - integração com Redis, fila e providers
- `src/types` - tipos TypeScript compartilhados
- `prisma/schema.prisma` - modelos de dados e esquema do banco

## Instalação

```bash
bun install
```

## Configuração de Ambiente

Crie um arquivo `.env` na raiz com as variáveis abaixo:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/quota
JWT_SECRET=uma_chave_secreta
SYSTEM_OWNER_SECRET=segredo_do_sistema
REDIS_URL=redis://localhost:6379
```

### Variáveis necessárias

- `DATABASE_URL` - conexão com PostgreSQL
- `JWT_SECRET` - chave para assinar tokens JWT
- `REDIS_URL` - endereço do Redis

### Variável opcional

- `SYSTEM_OWNER_SECRET` - permite autenticação de sistema via `x-system-secret`

## Executando o Projeto

```bash
bun run index.ts
```

O servidor expõe as rotas na porta configurada em `PORT` ou `3000` por padrão.

## Banco de Dados e Prisma

O projeto usa Prisma com o modelo definido em `prisma/schema.prisma`.

### Modelos principais

- `Tenant` - ambiente/cliente que usa o serviço
- `User` - usuário de um tenant com `role` e `tenantId`
- `ApiKey` - chave de API usada para chamadas ao endpoint de proxy
- `ProviderCredential` - credenciais de LLM por tenant para proxy de providers
- `Quota` - controle de consumo mensal de quota por tenant
- `BillingGroup` - opcional para agrupar consumo por centro de custo
- `UsageLog` - histórico de uso enviado para fila

Para rodar migrations:

```bash
bun prisma migrate deploy
```

## Endpoints

### Health Check

- `GET /health`
- Retorna status do serviço e timestamp.

### Autenticação

#### Login

- `POST /auth/login`
- Body:
  - `email` (string)
  - `password` (string)
- Resposta:
  - `token`

#### Logout

- `POST /auth/logout`
- Requer `Authorization: Bearer <token>`

#### Atualizar senha

- `POST /auth/update-password`
- Requer `Authorization: Bearer <token>`
- Body:
  - `newPassword` (string)

### Usuários

#### Criar usuário

- `POST /users`
- Requer `Authorization: Bearer <token>`
- Body:
  - `email` (string)
  - `name` (string, opcional)
  - `role` (`OWNER` | `MANAGER` | `ANALYST` | `DEV`)
  - `tenantId` (string, opcional)

#### Criar owner

- `POST /users/create-owner`
- Requer `Authorization: Bearer <token>` com role `OWNER`
- Body:
  - `email` (string)
  - `tenantId` (string)
  - `name` (string, opcional)

### Tenants

#### Criar tenant

- `POST /tenants`
- Body:
  - `name` (string)
  - `slug` (string)
  - `plan` (string, opcional)
  - `isActive` (boolean, opcional)

#### Gerar API key

- `POST /tenants/:tenantId/api-keys`
- Requer `Authorization: Bearer <token>` com role `MANAGER` ou superior
- Body:
  - `name` (string, opcional)

#### Listar API keys

- `GET /tenants/:tenantId/api-keys`
- Requer `Authorization: Bearer <token>` com role `MANAGER` ou superior

#### Criar credenciais de provider

- `POST /tenants/:tenantId/provider-credentials`
- Requer `Authorization: Bearer <token>` com role `MANAGER` ou superior
- Body:
  - `provider` (`openai` | `anthropic` | `google` | `groq` | `mistral`)
  - `apiKey` (string)
  - `baseUrl` (string, opcional)
  - `isActive` (boolean, opcional)

#### Listar credenciais de provider

- `GET /tenants/:tenantId/provider-credentials`
- Requer `Authorization: Bearer <token>` com role `MANAGER` ou superior

### Proxy / Consumo

#### Executar proxy

- `POST /proxy`
- Requer header `x-api-key: <apiKey>`
- Requer `validateApiKey` e `quotaLimiter`
- Limite atual: `100` requisições por minuto por tenant
- O endpoint encaminha a requisição para o provider configurado no tenant
- Body sugerido:
  - `provider` (string)
  - `model` (string)
  - `requestId` (string)
  - `promptTokens` (number, opcional)
  - `completionTokens` (number, opcional)
  - `totalTokens` (number, opcional)
  - `estimatedCostUsd` (number, opcional)
  - demais campos específicos do provider (ex: `messages`, `input`, `temperature`)

Headers opcionais:

- `x-billing-group` - agrupa uso para cobrança interna
- `x-provider` - provider fallback se `provider` não estiver no body

O `proxy` agora usa as credenciais de provider cadastradas em `/tenants/:tenantId/provider-credentials` e encaminha a chamada para a LLM real.

## Autenticação e autorização

- `authenticate` verifica o token JWT no header `Authorization: Bearer <token>`.
- `authorize(requiredRole)` valida hierarquia de roles:
  - `OWNER` > `MANAGER` > `ANALYST` > `DEV`
- `x-system-secret` pode ser usado para autenticar como sistema se `SYSTEM_OWNER_SECRET` estiver configurado.

## Quota e Redis

- `quotaLimiter(100)` aplica limite de 100 requisições por minuto por tenant.
- Usa Redis para incrementar a chave `quota:limit:<tenantId>` e aplicar TTL de 60 segundos.
- Retorna headers:
  - `X-Quota-Limit`
  - `X-Quota-Remaining`

## Fila de Uso

- `src/lib/queue.ts` cria uma fila BullMQ chamada `usage`
- `ProxyController.execute` enfileira payloads de uso com `addUsageJob`
- O job contém metadados como `tenantId`, `provider`, `model`, `promptTokens`, `completionTokens`, `totalTokens` e `estimatedCostUsd`

## Observações

- No `ProxyController`, o endpoint agora encaminha a requisição para o provider real usando credenciais de provider do tenant.
- O proxy grava métricas de uso e status em fila para persistência posterior.
- As senhas de novos usuários são criadas com valor padrão `123456` e devem ser alteradas com `/auth/update-password`.
- O projeto espera uso de Bun e suporte a import ES modules.

## Comandos úteis

```bash
bun install
bun run index.ts
bun prisma generate
bun prisma migrate deploy
```

## Estrutura de permissões

- `OWNER` - controle total, pode criar outros OWNERs e gerenciar tenants/API keys
- `MANAGER` - pode criar usuários e gerar/listar API keys no tenant
- `ANALYST` - acesso limitado, usado para usuários de consumo interno
- `DEV` - papel com menor privilégio

## Como contribuir / estender

- adicionar validação de schema com `zod` em cada rota
- criar consumers BullMQ para processar `UsageLog`
- adicionar testes automatizados e documentação de API
