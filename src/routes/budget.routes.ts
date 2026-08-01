import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../middleware/auth.middleware";
import budgetController from "../controllers/budget.controller";

export async function budgetRoutes(server: FastifyInstance) {
  // Lista orçamentos
  server.get(
    "/budgets",
    { preHandler: [authenticate] },
    budgetController.list.bind(budgetController)
  );

  server.get(
    "/tenants/:tenantId/budgets",
    { preHandler: [authenticate] },
    budgetController.list.bind(budgetController)
  );

  // Cria orçamento
  server.post(
    "/budgets",
    { preHandler: [authenticate, authorize("MANAGER")] },
    budgetController.create.bind(budgetController)
  );

  server.post(
    "/tenants/:tenantId/budgets",
    { preHandler: [authenticate, authorize("MANAGER")] },
    budgetController.create.bind(budgetController)
  );

  // Atualiza orçamento
  server.put(
    "/budgets/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    budgetController.update.bind(budgetController)
  );

  server.put(
    "/tenants/:tenantId/budgets/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    budgetController.update.bind(budgetController)
  );

  // Deleta orçamento
  server.delete(
    "/budgets/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    budgetController.delete.bind(budgetController)
  );

  server.delete(
    "/tenants/:tenantId/budgets/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    budgetController.delete.bind(budgetController)
  );
}
