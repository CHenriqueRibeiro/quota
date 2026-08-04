import type { FastifyReply, FastifyRequest } from "fastify";
import llmPricingService from "../service/llm-pricing.service";

class LLMPricingController {
  async getPrices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await llmPricingService.getPrices();
      return reply.status(200).send(data);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao obter tabela de preços de LLM" });
    }
  }

  async syncNow(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await llmPricingService.syncPrices();
      return reply.status(200).send({
        message: "Tabela de preços de LLM atualizada com sucesso a partir de openrouter.ai",
        data
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao sincronizar preços com openrouter.ai" });
    }
  }
}

export default new LLMPricingController();
