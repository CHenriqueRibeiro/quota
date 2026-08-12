import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import topicService from "../service/topic.service";
import auditService from "../service/audit.service";

export class TopicController {
  async listDefaults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { category } = request.query as { category?: string };
      const topics = topicService.listDefaultTopics(category);
      return reply.send({ data: topics });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async addDefaults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const topics = await topicService.addDefaultTopics(
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
        action: 'TOPIC_DEFAULTS_ADD',
        actionTitle: 'Tópicos Padrão Adicionados ao Quopilot',
        details: `Tópicos recomendados inseridos no Quopilot`,
      });

      return reply.status(201).send(topics);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const topic = await topicService.create(
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
        action: 'TOPIC_CREATE',
        actionTitle: `Tópico "${topic.name}" Criado no Quopilot`,
        details: `Novo tópico de conversa "${topic.name}" criado no Quopilot`,
        metadata: { topicId: topic.id, name: topic.name }
      });

      return reply.status(201).send({ data: topic });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const topics = await topicService.list(authRequest.user!);
      return reply.send({ data: topics });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  async listByAssistant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { assistantId } = request.params as { assistantId: string };
      const topics = await topicService.listByAssistant(authRequest.user!, assistantId);
      return reply.send({ data: topics });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const topic = await topicService.getById(authRequest.user!, id);
      return reply.send({ data: topic });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(404).send({ error: error.message });
    }
  }

  async execute(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const result = await topicService.execute(
        authRequest.user!,
        id,
        request.body as any
      );
      return reply.send({ data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const topic = await topicService.update(
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
        action: 'TOPIC_UPDATE',
        actionTitle: `Tópico "${topic.name}" Atualizado`,
        details: `Tópico de conversa "${topic.name}" atualizado no Quopilot`,
        metadata: { topicId: topic.id, name: topic.name }
      });

      return reply.send({ data: topic });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const topic = await topicService.delete(authRequest.user!, id);

      await auditService.logEvent({
        tenantId: authRequest.user!.tenantId,
        userId: authRequest.user!.id,
        userName: authRequest.user!.name,
        userEmail: authRequest.user!.email,
        userRole: authRequest.user!.role,
        category: 'QUOPILOT',
        action: 'TOPIC_DELETE',
        actionTitle: `Tópico "${topic.name || id}" Excluído`,
        details: `Tópico de conversa "${topic.name || id}" removido do Quopilot`,
        metadata: { topicId: id }
      });

      return reply.send({ data: topic, message: "Tópico removido com sucesso." });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(404).send({ error: error.message });
    }
  }
}
