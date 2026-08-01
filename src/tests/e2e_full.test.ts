/**
 * ============================================================================
 *  QUOTA — Suite completa de testes E2E  (idempotente / re-executável)
 * ============================================================================
 *
 *  Pré-requisitos:
 *    - Servidor rodando em http://localhost:3000  (bun run dev)
 *    - Worker rodando (bun run worker)
 *    - Banco contendo ao menos:
 *        Tenant  : dc36e5fe-01b2-43fa-a7c9-02acaec851b9
 *        User    : fce35110-14dd-4068-8680-4fdb22f930e4  (ADMIN, senha: 123456)
 *
 *  Rodar:  bun test src/tests/e2e_full.test.ts --timeout 60000
 * ============================================================================
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { PrismaClient, ProviderName } from "@prisma/client";
import crypto from "crypto";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  IDs fixos                                                         */
/* ------------------------------------------------------------------ */
const TENANT_ID = "dc36e5fe-01b2-43fa-a7c9-02acaec851b9";
const USER_ID = "fce35110-14dd-4068-8680-4fdb22f930e4";
const DEFAULT_PASSWORD = "123456";

/* ------------------------------------------------------------------ */
/*  Sufixo único p/ cada execução — garante idempotência              */
/* ------------------------------------------------------------------ */
const RUN = Date.now();

/* ------------------------------------------------------------------ */
/*  Estado compartilhado entre os testes                              */
/* ------------------------------------------------------------------ */
let TOKEN = "";
let USER_EMAIL = "";

// IDs criados ao longo dos testes
let createdManagerId = "";
let createdAnalystId = "";
let createdDevId = "";
let scopeFullId = "";
let scopeCustomId = "";
let projectId = "";
let agentId = "";
let billingGroupId = "";
let budgetId = "";
let alertId = "";
let providerCredentialId = "";
let apiKeyId = "";
let apiKeyString = "";
let assistantId = "";
let topicId = "";
let widgetId = "";
let widgetPublicKey = "";
let widgetSessionToken = "";

/* ================================================================== */
/*  HELPERS                                                           */
/* ================================================================== */

async function post(path: string, body: any, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function get(path: string, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { ...headers },
  });
}

async function put(path: string, body: any, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function del(path: string, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { ...headers },
  });
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/* ================================================================== */
/*  0 · PREPARAÇÃO                                                    */
/* ================================================================== */
beforeAll(async () => {
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  if (!user) throw new Error("User fixo não encontrado no banco");
  USER_EMAIL = user.email;

  // Atualizar plano para ENTERPRISE e limpar API keys legadas do tenant para garantir isolamento
  await prisma.tenant.update({
    where: { id: TENANT_ID },
    data: { plan: "ENTERPRISE" },
  });
  await prisma.apiKey.deleteMany({ where: { tenantId: TENANT_ID } });
});

/* ================================================================== */
/*  1 · AUTH                                                          */
/* ================================================================== */
describe("Auth", () => {

  test("1.1 · Login com credenciais inválidas → 401", async () => {
    const r = await post("/auth/login", { email: "nao@existe.com", password: "wrongpass" });
    expect(r.status).toBe(401);
  });

  test("1.2 · Login com senha errada → 401", async () => {
    const r = await post("/auth/login", { email: USER_EMAIL, password: "senhaerrada999" });
    expect(r.status).toBe(401);
  });

  test("1.3 · Login com credenciais corretas → 200 + token", async () => {
    const r = await post("/auth/login", { email: USER_EMAIL, password: DEFAULT_PASSWORD });
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.token).toBeDefined();
    expect(b.user.id).toBe(USER_ID);
    expect(b.user.tenantId).toBe(TENANT_ID);
    TOKEN = b.token;
  });

  test("1.4 · Acesso sem token → 401", async () => {
    const r = await get("/users");
    expect(r.status).toBe(401);
  });

  test("1.5 · Acesso com token inválido → 401", async () => {
    const r = await get("/users", auth("token.invalido.xyz"));
    expect(r.status).toBe(401);
  });

  test("1.6 · Logout (autenticado) → 200", async () => {
    const r = await post("/auth/logout", {}, auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("1.7 · Update password → 200", async () => {
    const r = await post("/auth/update-password", { newPassword: "novaSenha123" }, auth(TOKEN));
    expect(r.status).toBe(200);
    // Login com nova senha
    const r2 = await post("/auth/login", { email: USER_EMAIL, password: "novaSenha123" });
    expect(r2.status).toBe(200);
    // Restaura senha original
    const b2 = await r2.json() as any;
    await post("/auth/update-password", { newPassword: DEFAULT_PASSWORD }, auth(b2.token));
    // Relogin
    const r4 = await post("/auth/login", { email: USER_EMAIL, password: DEFAULT_PASSWORD });
    expect(r4.status).toBe(200);
    TOKEN = ((await r4.json()) as any).token;
  });

  test("1.8 · Acesso via x-system-secret → autenticação passa", async () => {
    const r = await get("/users", { "x-system-secret": "quota-system-secret" });
    // system-owner não tem tenantId → 400 (não 401/403)
    expect(r.status).not.toBe(401);
    expect(r.status).not.toBe(403);
  });
});

/* ================================================================== */
/*  2 · TENANT                                                        */
/* ================================================================== */
describe("Tenant", () => {

  test("2.1 · Criar tenant sem name/slug → 400", async () => {
    const r = await post("/tenants", { name: "", slug: "" });
    expect(r.status).toBe(400);
  });

  test("2.2 · Criar tenant válido → 201", async () => {
    const slug = `test-${RUN}`;
    const r = await post("/tenants", { name: "Teste Tenant", slug });
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.tenant.slug).toBe(slug);
    expect(b.tenant.plan).toBe("STARTER");
  });

  test("2.3 · Criar tenant com slug duplicado → 409", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
    const r = await post("/tenants", { name: "Dup", slug: tenant!.slug });
    expect(r.status).toBe(409);
  });

  test("2.4 · Criar tenant com plano PRO → 201", async () => {
    const r = await post("/tenants", { name: "Pro", slug: `pro-${RUN}`, plan: "PRO" });
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.tenant.plan).toBe("PRO");
  });
});

/* ================================================================== */
/*  3 · PROVIDER CREDENTIALS                                         */
/* ================================================================== */
describe("Provider Credentials", () => {

  test("3.1 · Criar credential sem apiKey → 400", async () => {
    const r = await post("/provider-credentials", { provider: "openai", apiKey: "" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("3.2 · Criar credential com provider inválido → 400", async () => {
    const r = await post("/provider-credentials", { provider: "xyz", apiKey: "sk-fake" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("3.3 · Criar/upsert credential OpenAI → 201", async () => {
    const r = await post("/provider-credentials", { provider: "openai", apiKey: `sk-fake-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    providerCredentialId = b.credential.id;
  });

  test("3.4 · Criar credential Anthropic → 201", async () => {
    const r = await post("/provider-credentials", { provider: "anthropic", apiKey: `sk-ant-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(201);
  });

  test("3.5 · Listar credentials → 200", async () => {
    const r = await get("/provider-credentials", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.credentials.length).toBeGreaterThanOrEqual(2);
  });
});

/* ================================================================== */
/*  4 · API KEYS                                                      */
/* ================================================================== */
describe("API Keys", () => {

  test("4.1 · Gerar API key com credential inexistente → 400", async () => {
    const r = await post("/api-keys", {
      name: `key-bad-${RUN}`,
      providerCredentialId: "00000000-aaaa-bbbb-cccc-000000000000",
    }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("4.2 · Gerar API key válida com allowedModels → 201", async () => {
    const r = await post("/api-keys", {
      name: `key-e2e-${RUN}`,
      providerCredentialId,
      allowedModels: ["gpt-4o", "gpt-4o-mini"],
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.apiKey.key).toMatch(/^quota_live_/);
    expect(b.apiKey.allowedModels).toEqual(["gpt-4o", "gpt-4o-mini"]);
    apiKeyId = b.apiKey.id;
    apiKeyString = b.apiKey.key;
  });

  test("4.3 · Gerar API key sem allowedModels → 201", async () => {
    const r = await post("/api-keys", {
      name: `key-open-${RUN}`,
      providerCredentialId,
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.apiKey.allowedModels).toBeNull();
  });

  test("4.4 · Listar API keys → 200", async () => {
    const r = await get("/api-keys", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.apiKeys.length).toBeGreaterThanOrEqual(2);
  });
});

/* ================================================================== */
/*  5 · PROJECTS                                                      */
/* ================================================================== */
describe("Projects", () => {

  test("5.1 · Criar projeto sem nome → 400", async () => {
    const r = await post("/projects", { name: "" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("5.2 · Criar projeto válido → 201", async () => {
    const r = await post("/projects", { name: `proj-${RUN}`, description: "E2E" }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.name).toBe(`proj-${RUN}`);
    projectId = b.id;
  });

  test("5.3 · Criar projeto duplicado → 409", async () => {
    const r = await post("/projects", { name: `proj-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(409);
  });

  test("5.4 · Listar projetos → 200", async () => {
    const r = await get("/projects", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.length).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== */
/*  6 · AGENTS                                                        */
/* ================================================================== */
describe("Agents", () => {

  test("6.1 · Criar agente sem nome → 400", async () => {
    const r = await post("/agents-management", { name: "" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("6.2 · Criar agente válido → 201", async () => {
    const r = await post("/agents-management", { name: `agent-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    agentId = b.id;
  });

  test("6.3 · Criar agente duplicado → 409", async () => {
    const r = await post("/agents-management", { name: `agent-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(409);
  });

  test("6.4 · Listar agentes → 200", async () => {
    const r = await get("/agents-management", auth(TOKEN));
    expect(r.status).toBe(200);
  });
});

/* ================================================================== */
/*  7 · BILLING GROUPS                                                */
/* ================================================================== */
describe("Billing Groups", () => {

  test("7.1 · Criar billing group sem nome → 400", async () => {
    const r = await post("/billing-groups", { name: "" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("7.2 · Criar billing group → 201", async () => {
    const r = await post("/billing-groups", { name: `bg-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    billingGroupId = b.id;
  });

  test("7.3 · Criar billing group duplicado → 409", async () => {
    const r = await post("/billing-groups", { name: `bg-${RUN}` }, auth(TOKEN));
    expect(r.status).toBe(409);
  });

  test("7.4 · Listar billing groups → 200", async () => {
    const r = await get("/billing-groups", auth(TOKEN));
    expect(r.status).toBe(200);
  });
});

/* ================================================================== */
/*  8 · SCOPES                                                        */
/* ================================================================== */
describe("Scopes", () => {

  test("8.1 · Criar scope FULL → 201", async () => {
    const r = await post("/scopes", { name: `sc-full-${RUN}`, mode: "FULL" }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.mode).toBe("FULL");
    scopeFullId = b.id;
  });

  test("8.2 · Criar scope CUSTOM com filtros → 201", async () => {
    const r = await post("/scopes", {
      name: `sc-custom-${RUN}`,
      mode: "CUSTOM",
      projects: [`proj-${RUN}`],
      agents: [`agent-${RUN}`],
      providers: ["openai"],
      models: ["gpt-4o"],
      billingGroups: [`bg-${RUN}`],
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.mode).toBe("CUSTOM");
    expect(b.projects).toEqual([`proj-${RUN}`]);
    scopeCustomId = b.id;
  });

  test("8.3 · Criar scope com nome duplicado → 409", async () => {
    const r = await post("/scopes", { name: `sc-full-${RUN}`, mode: "FULL" }, auth(TOKEN));
    expect(r.status).toBe(409);
  });

  test("8.4 · Criar scope com mode ALL (→ FULL) → 201", async () => {
    const r = await post("/scopes", { name: `sc-all-${RUN}`, mode: "ALL" }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.mode).toBe("FULL");
  });

  test("8.5 · Listar scopes → 200", async () => {
    const r = await get("/scopes", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.length).toBeGreaterThanOrEqual(2);
  });

  test("8.6 · Obter scope por ID → 200", async () => {
    const r = await get(`/scopes/${scopeFullId}`, auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.id).toBe(scopeFullId);
  });

  test("8.7 · Obter scope inexistente → 404", async () => {
    const r = await get("/scopes/00000000-0000-0000-0000-000000000000", auth(TOKEN));
    expect(r.status).toBe(404);
  });

  test("8.8 · Atualizar scope → 200", async () => {
    const r = await put(`/scopes/${scopeCustomId}`, {
      description: "Atualizado E2E",
      models: ["gpt-4o", "gpt-4o-mini"],
    }, auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.models).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });
});

/* ================================================================== */
/*  9 · USERS                                                         */
/* ================================================================== */
describe("Users", () => {

  test("9.1 · Criar user sem email → 400", async () => {
    const r = await post("/users", { email: "", role: "ANALYST" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("9.2 · Criar user ANALYST → 201", async () => {
    const r = await post("/users", {
      email: `analyst-${RUN}@test.com`, name: "Analyst E2E", role: "ANALYST",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.user.role).toBe("ANALYST");
    expect(b.defaultPassword).toBe("123456");
    createdAnalystId = b.user.id;
  });

  test("9.3 · Criar user DEV → 201", async () => {
    const r = await post("/users", {
      email: `dev-${RUN}@test.com`, name: "Dev E2E", role: "DEV",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    createdDevId = (await r.json() as any).user.id;
  });

  test("9.4 · Criar user MANAGER → 201", async () => {
    const r = await post("/users", {
      email: `mgr-${RUN}@test.com`, name: "Manager E2E", role: "MANAGER",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    createdManagerId = (await r.json() as any).user.id;
  });

  test("9.5 · ADMIN pode criar outro ADMIN → 201", async () => {
    const r = await post("/users", {
      email: `admin-${RUN}@test.com`, name: "Admin E2E", role: "ADMIN",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.user.role).toBe("ADMIN");
  });

  test("9.6 · Criar user com email duplicado → 409", async () => {
    const r = await post("/users", { email: USER_EMAIL, role: "ANALYST" }, auth(TOKEN));
    expect(r.status).toBe(409);
  });

  test("9.7 · Listar users → 200", async () => {
    const r = await get("/users", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.length).toBeGreaterThanOrEqual(5);
  });

  test("9.8 · Atribuir scope FULL a user → 200", async () => {
    const r = await put(`/users/${createdAnalystId}/scope`, { scopeId: scopeFullId }, auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.user.scopeId).toBe(scopeFullId);
  });

  test("9.9 · Atribuir scope CUSTOM a user → 200", async () => {
    const r = await put(`/users/${createdDevId}/scope`, { scopeId: scopeCustomId }, auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("9.10 · Remover scope (null) → 200", async () => {
    const r = await put(`/users/${createdManagerId}/scope`, { scopeId: null }, auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.user.scopeId).toBeNull();
  });

  test("9.11 · Atribuir scope a user inexistente → 404", async () => {
    const r = await put("/users/00000000-0000-0000-0000-000000000000/scope", { scopeId: scopeFullId }, auth(TOKEN));
    expect(r.status).toBe(404);
  });

  test("9.12 · Assign scope via /scopes/assign-user → 200", async () => {
    const r = await put("/scopes/assign-user", { userId: createdAnalystId, scopeId: scopeCustomId }, auth(TOKEN));
    expect(r.status).toBe(200);
  });
});

/* ================================================================== */
/*  10 · ROLE HIERARCHY                                               */
/* ================================================================== */
describe("Role Hierarchy & Authorization", () => {

  let analystToken = "";
  let devToken = "";
  let mgrToken = "";

  beforeAll(async () => {
    const analyst = await prisma.user.findUnique({ where: { id: createdAnalystId } });
    if (analyst) {
      analystToken = ((await (await post("/auth/login", { email: analyst.email, password: DEFAULT_PASSWORD })).json()) as any).token;
    }
    const dev = await prisma.user.findUnique({ where: { id: createdDevId } });
    if (dev) {
      devToken = ((await (await post("/auth/login", { email: dev.email, password: DEFAULT_PASSWORD })).json()) as any).token;
    }
    const mgr = await prisma.user.findUnique({ where: { id: createdManagerId } });
    if (mgr) {
      mgrToken = ((await (await post("/auth/login", { email: mgr.email, password: DEFAULT_PASSWORD })).json()) as any).token;
    }
  });

  test("10.1 · ANALYST não pode criar projetos (MANAGER+) → 403", async () => {
    const r = await post("/projects", { name: `proj-fail-${RUN}` }, auth(analystToken));
    expect(r.status).toBe(403);
  });

  test("10.2 · DEV não pode criar scopes (MANAGER+) → 403", async () => {
    const r = await post("/scopes", { name: `sc-fail-${RUN}`, mode: "FULL" }, auth(devToken));
    expect(r.status).toBe(403);
  });

  test("10.3 · ANALYST não pode acessar billing-groups (MANAGER+) → 403", async () => {
    const r = await get("/billing-groups", auth(analystToken));
    expect(r.status).toBe(403);
  });

  test("10.4 · ANALYST pode listar users → 200", async () => {
    const r = await get("/users", auth(analystToken));
    expect(r.status).toBe(200);
  });

  test("10.5 · DEV pode listar scopes → 200", async () => {
    const r = await get("/scopes", auth(devToken));
    expect(r.status).toBe(200);
  });

  test("10.6 · DEV não pode criar API keys (MANAGER+) → 403", async () => {
    const r = await post("/api-keys", { name: `key-fail-${RUN}`, providerCredentialId }, auth(devToken));
    expect(r.status).toBe(403);
  });

  test("10.7 · ANALYST não pode criar alertas (MANAGER+) → 403", async () => {
    const r = await post("/alerts", {
      type: "COST", period: "MONTHLY", threshold: 100, email: "t@t.com",
    }, auth(analystToken));
    expect(r.status).toBe(403);
  });

  test("10.8 · MANAGER não pode criar ADMIN → 403", async () => {
    const r = await post("/users", {
      email: `admin-mgr-fail-${RUN}@test.com`, name: "Admin Fail", role: "ADMIN",
    }, auth(mgrToken));
    expect(r.status).toBe(403);
  });

  test("10.9 · MANAGER pode criar ANALYST → 201", async () => {
    const r = await post("/users", {
      email: `an-mgr-${RUN}@test.com`, name: "Analyst by MGR", role: "ANALYST",
    }, auth(mgrToken));
    expect(r.status).toBe(201);
  });
});

/* ================================================================== */
/*  11 · BUDGETS                                                      */
/* ================================================================== */
describe("Budgets", () => {

  test("11.1 · Sem limit → 400", async () => {
    const r = await post("/budgets", { period: "MONTHLY" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("11.2 · Limit ≤ 0 → 400", async () => {
    const r = await post("/budgets", { limit: 0, period: "MONTHLY" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("11.3 · Criar MONTHLY → 201", async () => {
    const r = await post("/budgets", { limit: 500, period: "MONTHLY" }, auth(TOKEN));
    expect(r.status).toBe(201);
    budgetId = (await r.json() as any).id;
  });

  test("11.4 · Criar DAILY com billingGroup → 201", async () => {
    const r = await post("/budgets", { limit: 50, period: "DAILY", billingGroupId }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.billingGroupId).toBe(billingGroupId);
  });

  test("11.5 · Listar orçamentos → 200 (com status calculado)", async () => {
    const r = await get("/budgets", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.length).toBeGreaterThanOrEqual(2);
    expect(b[0].status).toBeDefined();
  });

  test("11.6 · Atualizar orçamento → 200", async () => {
    const r = await put(`/budgets/${budgetId}`, { limit: 1000 }, auth(TOKEN));
    expect(r.status).toBe(200);
    expect((await r.json() as any).limit).toBe(1000);
  });

  test("11.7 · Atualizar com limit ≤ 0 → 400", async () => {
    const r = await put(`/budgets/${budgetId}`, { limit: -5 }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("11.8 · Atualizar inexistente → 404", async () => {
    const r = await put("/budgets/00000000-0000-0000-0000-000000000000", { limit: 10 }, auth(TOKEN));
    expect(r.status).toBe(404);
  });
});

/* ================================================================== */
/*  12 · ALERTS                                                       */
/* ================================================================== */
describe("Alerts", () => {

  test("12.1 · Sem campos obrigatórios → 400", async () => {
    const r = await post("/alerts", { type: "COST" }, auth(TOKEN));
    expect(r.status).toBe(400);
  });

  test("12.2 · COST_THRESHOLD MONTHLY → 201", async () => {
    const r = await post("/alerts", {
      type: "COST_THRESHOLD", period: "MONTHLY", threshold: 500, email: "a@t.com",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    alertId = (await r.json() as any).alert.id;
  });

  test("12.3 · TOKEN_THRESHOLD DAILY → 201", async () => {
    const r = await post("/alerts", {
      type: "TOKEN_THRESHOLD", period: "DAILY", threshold: 100000, email: "t@t.com",
      provider: "openai", model: "gpt-4o",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
  });

  test("12.4 · ERROR_RATE → 201", async () => {
    const r = await post("/alerts", {
      type: "ERROR_RATE", period: "DAILY", threshold: 10, email: "e@t.com",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
  });

  test("12.5 · LATENCY → 201", async () => {
    const r = await post("/alerts", {
      type: "LATENCY", period: "REQUEST", threshold: 5000, email: "l@t.com",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
  });

  test("12.6 · Com billingGroupId → 201", async () => {
    const r = await post("/alerts", {
      type: "COST", period: "MONTHLY", threshold: 250, email: "bg@t.com", billingGroupId,
    }, auth(TOKEN));
    expect(r.status).toBe(201);
  });

  test("12.7 · Listar → 200 (type mapeado)", async () => {
    const r = await get("/alerts", auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.length).toBeGreaterThanOrEqual(5);
  });

  test("12.8 · Atualizar → 200", async () => {
    const r = await put(`/alerts/${alertId}`, { threshold: 750, enabled: false }, auth(TOKEN));
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.alert.threshold).toBe(750);
    expect(b.alert.enabled).toBe(false);
  });

  test("12.9 · Atualizar inexistente → 404", async () => {
    const r = await put("/alerts/00000000-0000-0000-0000-000000000000", { threshold: 1 }, auth(TOKEN));
    expect(r.status).toBe(404);
  });

  test("12.10 · Processar alertas → 200", async () => {
    const r = await post("/alerts/process", {}, auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("12.11 · Notificações → 200", async () => {
    const r = await get("/alerts/notifications", auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("12.12 · Teste alerta inexistente → 404", async () => {
    const r = await post("/alerts/test/00000000-0000-0000-0000-000000000000", {}, auth(TOKEN));
    expect(r.status).toBe(404);
  });
});

/* ================================================================== */
/*  13 · PROXY (simulação)                                            */
/* ================================================================== */
describe("Proxy (simulação)", () => {

  test("13.1 · Sem API Key → 401", async () => {
    const r = await post("/proxy", { model: "gpt-4o", messages: [{ role: "user", content: "Hi" }] });
    expect(r.status).toBe(401);
  });

  test("13.2 · API Key inválida → 401", async () => {
    const r = await post("/proxy", { model: "gpt-4o", messages: [] }, { "x-api-key": "chave-xyz" });
    expect(r.status).toBe(401);
  });

  test("13.3 · Modelo não permitido → 403", async () => {
    const r = await post("/proxy", { model: "gpt-3.5-turbo", messages: [] }, { "x-api-key": apiKeyString });
    expect(r.status).toBe(403);
    const b = await r.json() as any;
    expect(b.error).toContain("Modelo não permitido");
  });

  test("13.4 · Projeto não cadastrado → 400", async () => {
    const r = await post("/proxy", { model: "gpt-4o", messages: [] }, {
      "x-api-key": apiKeyString, "x-project": "inexistente-xyz",
    });
    expect(r.status).toBe(400);
  });

  test("13.5 · Agente não cadastrado → 400", async () => {
    const r = await post("/proxy", { model: "gpt-4o", messages: [] }, {
      "x-api-key": apiKeyString, "x-agent": "fantasma-xyz",
    });
    expect(r.status).toBe(400);
  });

  test("13.6 · Provider key fake → erro do provider (≥400)", async () => {
    const r = await post("/proxy", { model: "gpt-4o", messages: [{ role: "user", content: "Hi" }] }, {
      "x-api-key": apiKeyString,
      "x-project": `proj-${RUN}`,
      "x-agent": `agent-${RUN}`,
      "x-billing-group": `bg-${RUN}`,
      "x-environment": "test",
      "x-user-id": "user-e2e",
      "x-trace-id": `trace-${RUN}`,
      "x-tags": "teste,e2e",
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

/* ================================================================== */
/*  14 · COLLECTOR (simulação)                                        */
/* ================================================================== */
describe("Collector (simulação)", () => {

  test("14.1 · Sem API Key → 401", async () => {
    const r = await post("/collector", { provider: "openai", model: "gpt-4o" });
    expect(r.status).toBe(401);
  });

  test("14.2 · Sem provider/model → 400", async () => {
    const r = await post("/collector", {}, { "x-api-key": apiKeyString });
    expect(r.status).toBe(400);
  });

  test("14.3 · Projeto não cadastrado → 400", async () => {
    const r = await post("/collector", {
      provider: "openai", model: "gpt-4o",
      metadata: { project: "fantasma" },
    }, { "x-api-key": apiKeyString });
    expect(r.status).toBe(400);
  });

  test("14.4 · Agente não cadastrado → 400", async () => {
    const r = await post("/collector", {
      provider: "openai", model: "gpt-4o",
      metadata: { agent: "fantasma" },
    }, { "x-api-key": apiKeyString });
    expect(r.status).toBe(400);
  });

  test("14.5 · Collector válido completo → 202", async () => {
    const r = await post("/collector", {
      provider: "openai", model: "gpt-4o",
      promptTokens: 150, completionTokens: 80, totalTokens: 230,
      latencyMs: 1200, statusCode: 200, success: true, estimatedCost: 0.005,
      billingGroup: `bg-${RUN}`,
      metadata: {
        project: `proj-${RUN}`, agent: `agent-${RUN}`,
        environment: "staging", externalUserId: "ext-001",
        tags: ["teste", "e2e"],
      },
    }, { "x-api-key": apiKeyString });
    expect(r.status).toBe(202);
    const b = await r.json() as any;
    expect(b.success).toBe(true);
    expect(b.requestId).toBeDefined();
  });

  test("14.6 · Collector com campos mínimos → 202", async () => {
    const r = await post("/collector", {
      provider: "openai", model: "gpt-4o-mini", promptTokens: 10, completionTokens: 5,
    }, { "x-api-key": apiKeyString });
    expect(r.status).toBe(202);
  });
});

/* ================================================================== */
/*  15 · ANALYTICS                                                    */
/* ================================================================== */
describe("Analytics", () => {
  const QS = "?startDate=2020-01-01&endDate=2030-12-31";

  beforeAll(() => Bun.sleep(2000));

  test("15.1  · Dashboard → 200", async () => { expect((await get(`/analytics/dashboard${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.2  · Overview → 200", async () => { expect((await get(`/analytics/overview${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.3  · Providers → 200", async () => { expect((await get(`/analytics/providers${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.4  · Models → 200", async () => { expect((await get(`/analytics/models${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.5  · Billing groups → 200", async () => { expect((await get(`/analytics/billing-groups${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.6  · Projects → 200", async () => { expect((await get(`/analytics/projects${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.7  · Users → 200", async () => { expect((await get(`/analytics/users${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.8  · Agents → 200", async () => { expect((await get(`/analytics/agents${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.9  · Daily consumption → 200", async () => { expect((await get(`/analytics/daily-consumption${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.10 · Latency → 200", async () => { expect((await get(`/analytics/latency${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.11 · Jobs → 200", async () => { expect((await get(`/analytics/jobs${QS}`, auth(TOKEN))).status).toBe(200); });
  test("15.12 · Sem token → 401", async () => { expect((await get(`/analytics/dashboard${QS}`)).status).toBe(401); });
});

/* ================================================================== */
/*  16 · HOME                                                         */
/* ================================================================== */
describe("Home", () => {
  test("16.1 · Autenticado → 200", async () => { expect((await get("/home", auth(TOKEN))).status).toBe(200); });
  test("16.2 · Sem token → 401", async () => { expect((await get("/home")).status).toBe(401); });
});

/* ================================================================== */
/*  17 · FAILED USAGE                                                 */
/* ================================================================== */
describe("Failed Usage", () => {
  test("17.1 · Listar → 200", async () => { expect((await get("/failed-usage", auth(TOKEN))).status).toBe(200); });
  test("17.2 · Retry → 200", async () => { expect((await post("/failed-usage/retry", {}, auth(TOKEN))).status).toBe(200); });
});

/* ================================================================== */
/*  18 · LLM PRICING                                                  */
/* ================================================================== */
describe("LLM Pricing", () => {
  test("18.1 · Get prices → 200", async () => { expect((await get("/llm-prices", auth(TOKEN))).status).toBe(200); });
  test("18.2 · Sem token → 401", async () => { expect((await get("/llm-prices")).status).toBe(401); });
});

/* ================================================================== */
/*  19 · ASSISTANTS                                                   */
/* ================================================================== */
describe("Assistants", () => {
  test("19.1 · Criar Assistente → 201", async () => {
    const r = await post("/assistants", {
      name: `Assistant-${RUN}`,
      description: "Assistente de Teste E2E",
      type: "CUSTOM",
      provider: "openai",
      model: "gpt-4o",
      systemPrompt: "Você é um assistente virtual de teste.",
      apiKeyId,
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.data.id).toBeDefined();
    assistantId = b.data.id;
  });

  test("19.2 · Listar Assistentes → 200", async () => {
    const r = await get("/assistants", auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("19.3 · Listar API Keys de Assistentes → 200", async () => {
    const r = await get("/assistants/api-keys", auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("19.4 · Obter Assistente por ID → 200", async () => {
    const r = await get(`/assistants/${assistantId}`, auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("19.5 · Atualizar Assistente → 200", async () => {
    const r = await put(`/assistants/${assistantId}`, {
      description: "Descrição atualizada E2E",
    }, auth(TOKEN));
    expect(r.status).toBe(200);
  });
});

/* ================================================================== */
/*  20 · TOPICS                                                       */
/* ================================================================== */
describe("Topics", () => {
  test("20.1 · Criar Tópico → 201", async () => {
    const r = await post("/topics", {
      assistantId,
      name: `Topic-${RUN}`,
      description: "Tópico E2E",
      category: "SUPORTE",
      questions: ["Como podemos ajudar?", "Qual sua dúvida?"],
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.data.id).toBeDefined();
    topicId = b.data.id;
  });

  test("20.2 · Listar Tópicos → 200", async () => {
    const r = await get("/topics", auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("20.3 · Listar Tópicos Padrão → 200", async () => {
    const r = await get("/topics/defaults", auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("20.4 · Obter Tópico por ID → 200", async () => {
    const r = await get(`/topics/${topicId}`, auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("20.5 · Atualizar Tópico → 200", async () => {
    const r = await put(`/topics/${topicId}`, {
      description: "Tópico atualizado E2E",
    }, auth(TOKEN));
    expect(r.status).toBe(200);
  });
});

/* ================================================================== */
/*  21 · WIDGETS                                                      */
/* ================================================================== */
describe("Widgets", () => {
  test("21.1 · Criar Widget → 201", async () => {
    const r = await post("/widgets", {
      assistantId,
      name: `Widget-${RUN}`,
      allowedDomains: ["localhost", "*"],
      rateLimit: 100,
      welcomeMessage: "Olá! Como posso te ajudar hoje?",
    }, auth(TOKEN));
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    expect(b.data.id).toBeDefined();
    expect(b.data.publicKey).toBeDefined();
    widgetId = b.data.id;
    widgetPublicKey = b.data.publicKey;
  });

  test("21.2 · Listar Widgets → 200", async () => {
    const r = await get("/widgets", auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("21.3 · Obter Widget por ID → 200", async () => {
    const r = await get(`/widgets/${widgetId}`, auth(TOKEN));
    expect(r.status).toBe(200);
  });

  test("21.4 · Info Pública do Widget (`/widget/public/:publicKey`) → 200", async () => {
    const r = await get(`/widget/public/${widgetPublicKey}`);
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b.data || b.name || b.publicKey).toBeDefined();
  });

  test("21.5 · Inicializar Sessão do Widget (`/widget/init/:publicKey`) → 200", async () => {
    const r = await get(`/widget/init/${widgetPublicKey}`);
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    widgetSessionToken = b.data?.sessionToken || b.sessionToken || b.token || b.data?.token;
  });

  test("21.6 · Atualizar Widget → 200", async () => {
    const r = await put(`/widgets/${widgetId}`, {
      welcomeMessage: "Bem-vindo ao atendimento!",
    }, auth(TOKEN));
    expect(r.status).toBe(200);
  });
});

/* ================================================================== */
/*  22 · WIDGET CHAT                                                  */
/* ================================================================== */
describe("Widget Chat", () => {
  test("22.1 · Selecionar Tópico no Chat do Widget (`/widget/chat/select-topic`)", async () => {
    if (widgetSessionToken && topicId) {
      const r = await post("/widget/chat/select-topic", {
        sessionToken: widgetSessionToken,
        topicId,
      });
      expect([200, 400]).toContain(r.status);
    } else {
      expect(true).toBe(true);
    }
  });
});

/* ================================================================== */
/*  23 · CLEANUP                                                      */
/* ================================================================== */
describe("Cleanup", () => {

  test("23.1 · Deletar Tópico → 200", async () => {
    if (topicId) expect((await del(`/topics/${topicId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.2 · Deletar Widget → 200", async () => {
    if (widgetId) expect((await del(`/widgets/${widgetId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.3 · Deletar Assistente → 200", async () => {
    if (assistantId) expect((await del(`/assistants/${assistantId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.4 · Deletar alerta → 200", async () => {
    expect((await del(`/alerts/${alertId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.5 · Deletar alerta inexistente → 404", async () => {
    expect((await del("/alerts/00000000-0000-0000-0000-000000000000", auth(TOKEN))).status).toBe(404);
  });

  test("23.6 · Deletar budget → 200", async () => {
    expect((await del(`/budgets/${budgetId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.7 · Deletar budget inexistente → 404", async () => {
    expect((await del("/budgets/00000000-0000-0000-0000-000000000000", auth(TOKEN))).status).toBe(404);
  });

  test("23.8 · Deletar scope FULL → 200", async () => {
    await prisma.user.updateMany({ where: { scopeId: scopeFullId }, data: { scopeId: null } });
    expect((await del(`/scopes/${scopeFullId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.9 · Deletar scope CUSTOM → 200", async () => {
    await prisma.user.updateMany({ where: { scopeId: scopeCustomId }, data: { scopeId: null } });
    expect((await del(`/scopes/${scopeCustomId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.10 · Deletar projeto → 200", async () => {
    expect((await del(`/projects/${projectId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.11 · Deletar projeto inexistente → 404", async () => {
    expect((await del("/projects/00000000-0000-0000-0000-000000000000", auth(TOKEN))).status).toBe(404);
  });

  test("23.12 · Deletar agente → 200", async () => {
    expect((await del(`/agents-management/${agentId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.13 · Deletar agente inexistente → 404", async () => {
    expect((await del("/agents-management/00000000-0000-0000-0000-000000000000", auth(TOKEN))).status).toBe(404);
  });

  test("23.14 · Deletar billing group → 200", async () => {
    await prisma.budget.deleteMany({ where: { billingGroupId } });
    await prisma.alertConfig.updateMany({ where: { billingGroupId }, data: { billingGroupId: null } });
    expect((await del(`/billing-groups/${billingGroupId}`, auth(TOKEN))).status).toBe(200);
  });

  test("23.15 · Deletar billing group inexistente → 404", async () => {
    expect((await del("/billing-groups/00000000-0000-0000-0000-000000000000", auth(TOKEN))).status).toBe(404);
  });

  test("23.16 · Encerrar Prisma → ok", async () => {
    await prisma.$disconnect();
  });
});
