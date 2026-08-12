import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import assistantService from "../service/assistant.service";
import auditService from "../service/audit.service";

export class AssistantController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const assistant = await assistantService.create(
        authRequest.user!,
        request.body as any
      );

      await auditService.logEvent({
        tenantId: authRequest.user!.tenantId,
        userId: authRequest.user!.id,
        userName: authRequest.user!.name,
        userEmail: authRequest.user!.email,
        userRole: authRequest.user!.role,
        category: 'QUOPILOT',
        action: 'ASSISTANT_CREATE',
        actionTitle: `Assistente Quopilot "${assistant.name}" Criado`,
        details: `Novo assistente Quopilot "${assistant.name}" (${assistant.provider}/${assistant.model}) criado`,
        metadata: { assistantId: assistant.id, name: assistant.name, provider: assistant.provider, model: assistant.model }
      });

      return reply.status(201).send({ data: assistant });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const assistants = await assistantService.list(authRequest.user!);
      return reply.send({ data: assistants });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  async listAvailableApiKeys(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const apiKeys = await assistantService.listAvailableApiKeys(authRequest.user!);
      return reply.send({ data: apiKeys });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const assistant = await assistantService.getById(authRequest.user!, id);
      return reply.send({ data: assistant });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(404).send({ error: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const assistant = await assistantService.update(
        authRequest.user!,
        id,
        request.body as any
      );

      await auditService.logEvent({
        tenantId: authRequest.user!.tenantId,
        userId: authRequest.user!.id,
        userName: authRequest.user!.name,
        userEmail: authRequest.user!.email,
        userRole: authRequest.user!.role,
        category: 'QUOPILOT',
        action: 'ASSISTANT_UPDATE',
        actionTitle: `Assistente Quopilot "${assistant.name}" Atualizado`,
        details: `Assistente Quopilot "${assistant.name}" atualizado com sucesso`,
        metadata: { assistantId: assistant.id, name: assistant.name }
      });

      return reply.send({ data: assistant });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const assistant = await assistantService.delete(authRequest.user!, id);

      await auditService.logEvent({
        tenantId: authRequest.user!.tenantId,
        userId: authRequest.user!.id,
        userName: authRequest.user!.name,
        userEmail: authRequest.user!.email,
        userRole: authRequest.user!.role,
        category: 'QUOPILOT',
        action: 'ASSISTANT_DELETE',
        actionTitle: `Assistente Quopilot "${assistant.name || id}" Excluído`,
        details: `Assistente Quopilot "${assistant.name || id}" removido`,
        metadata: { assistantId: id }
      });

      return reply.send({ data: assistant, message: "Assistente removido com sucesso." });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(404).send({ error: error.message });
    }
  }
}
