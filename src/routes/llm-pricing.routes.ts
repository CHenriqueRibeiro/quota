import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../middleware/auth.middleware";
import llmPricingController from "../controllers/llm-pricing.controller";

export async function llmPricingRoutes(server: FastifyInstance) {
  server.get(
    "/llm-prices",
    { preHandler: [authenticate] },
    llmPricingController.getPrices.bind(llmPricingController)
  );

  server.post(
    "/llm-prices/sync",
    { preHandler: [authenticate, authorize("MANAGER")] },
    llmPricingController.syncNow.bind(llmPricingController)
  );
}
