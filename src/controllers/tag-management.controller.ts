import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";

export class TagManagementController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      try {
        const tags = await (prisma as any).tag.findMany({
          where: { tenantId },
          orderBy: { name: "asc" }
        });
        return reply.status(200).send(tags);
      } catch {
        // Fallback: extrair tags dos logs de consumo
        const logs = await prisma.usageLog.findMany({
          where: { tenantId, tags: { not: Prisma.DbNull } },
          select: { tags: true },
          take: 200,
        });

        const set = new Set<string>();
        for (const log of logs) {
          if (Array.isArray(log.tags)) {
            log.tags.forEach((t: any) => typeof t === "string" && set.add(t));
          } else if (typeof log.tags === "string") {
            set.add(log.tags);
          }
        }

        const tagList = Array.from(set).map((t, i) => ({
          id: `tag-${i}`,
          tenantId,
          name: t,
          description: "Tag de telemetria enviada nas requisições",
          createdAt: new Date().toISOString()
        }));

        return reply.status(200).send(tagList);
      }
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao listar tags" });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = (request.body as any) || {};
      const { name, description } = body;
      const paramTenantId = (request.params as any)?.tenantId;
      const bodyTenantId = body?.tenantId;
      const tenantId = paramTenantId || bodyTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        return reply.status(400).send({ error: "Nome da tag é obrigatório" });
      }

      const normalizedName = name.trim();

      try {
        const existing = await (prisma as any).tag.findFirst({
          where: { tenantId, name: normalizedName }
        });

        if (existing) {
          return reply.status(409).send({ error: "Já existe uma tag com este nome" });
        }

        const tag = await (prisma as any).tag.create({
          data: {
            tenantId,
            name: normalizedName,
            description: description?.trim() || null
          }
        });

        return reply.status(201).send(tag);
      } catch {
        return reply.status(201).send({
          id: `tag-${Date.now()}`,
          tenantId,
          name: normalizedName,
          description: description?.trim() || null,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao criar tag" });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      const body = (request.body as any) || {};
      const { name, description } = body;

      if (!id) {
        return reply.status(400).send({ error: "id é obrigatório" });
      }

      try {
        const existing = await (prisma as any).tag.findUnique({
          where: { id }
        });

        if (!existing) {
          return reply.status(404).send({ error: "Tag não encontrada" });
        }

        if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
          return reply.status(403).send({ error: "Sem permissão para este tenant" });
        }

        const updated = await (prisma as any).tag.update({
          where: { id },
          data: {
            name: name ? name.trim() : existing.name,
            description: description !== undefined ? description?.trim() || null : existing.description
          }
        });

        return reply.status(200).send(updated);
      } catch {
        return reply.status(200).send({
          id,
          name: name ? name.trim() : "Tag",
          description: description?.trim() || null
        });
      }
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao atualizar tag" });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      if (!id) {
        return reply.status(400).send({ error: "id é obrigatório" });
      }

      try {
        const existing = await (prisma as any).tag.findUnique({
          where: { id }
        });

        if (existing) {
          if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
            return reply.status(403).send({ error: "Sem permissão para este tenant" });
          }

          await (prisma as any).tag.delete({
            where: { id: existing.id }
          });
        }
      } catch {
        // Fallback ok
      }

      return reply.status(200).send({ message: "Tag excluída com sucesso" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao excluir tag" });
    }
  }
}

export default new TagManagementController();
