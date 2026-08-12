import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import auditService from "../service/audit.service";

interface TagItem {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

// Armazenamento em memória para tags criadas, editadas e excluídas por tenant
const customTagsStore = new Map<string, Map<string, TagItem>>();
const deletedTagsStore = new Map<string, Set<string>>();

export class TagManagementController {
  private getTenantTagsMap(tenantId: string): Map<string, TagItem> {
    if (!customTagsStore.has(tenantId)) {
      customTagsStore.set(tenantId, new Map());
    }
    return customTagsStore.get(tenantId)!;
  }

  private getDeletedTagsSet(tenantId: string): Set<string> {
    if (!deletedTagsStore.has(tenantId)) {
      deletedTagsStore.set(tenantId, new Set());
    }
    return deletedTagsStore.get(tenantId)!;
  }

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

      const tenantTagsMap = this.getTenantTagsMap(tenantId);
      const deletedSet = this.getDeletedTagsSet(tenantId);

      // Tenta tabela do banco caso exista
      try {
        const dbTags = await (prisma as any).tag.findMany({
          where: { tenantId },
          orderBy: { name: "asc" }
        });
        if (Array.isArray(dbTags) && dbTags.length > 0) {
          return reply.status(200).send(dbTags);
        }
      } catch {
        // ignore caso o modelo não exista na tabela do prisma
      }

      // Extrai tags dos logs de consumo
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

      // Adiciona tags criadas customizadas
      for (const customTag of tenantTagsMap.values()) {
        set.add(customTag.name);
      }

      // Filtra as tags que foram marcadas como excluídas
      const resultList: TagItem[] = [];
      for (const tagName of set) {
        if (deletedSet.has(tagName.toLowerCase()) || deletedSet.has(tagName)) {
          continue;
        }
        const custom = tenantTagsMap.get(tagName);
        resultList.push({
          id: tagName,
          tenantId,
          name: tagName,
          createdAt: custom?.createdAt || new Date().toISOString()
        });
      }

      return reply.status(200).send(resultList);
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
      const { name } = body;
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
      const tenantTagsMap = this.getTenantTagsMap(tenantId);
      const deletedSet = this.getDeletedTagsSet(tenantId);

      deletedSet.delete(normalizedName);
      deletedSet.delete(normalizedName.toLowerCase());

      const newTag: TagItem = {
        id: normalizedName,
        tenantId,
        name: normalizedName,
        createdAt: new Date().toISOString()
      };

      tenantTagsMap.set(normalizedName, newTag);

      await auditService.logEvent({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'METADATA',
        action: 'TAG_CREATE',
        actionTitle: `Tag/Grupo "${normalizedName}" Criado`,
        details: `Tag de metadados "${normalizedName}" criada`,
        metadata: { tagName: normalizedName }
      });

      try {
        const tag = await (prisma as any).tag.create({
          data: { tenantId, name: normalizedName }
        });
        return reply.status(201).send(tag);
      } catch {
        return reply.status(201).send(newTag);
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
      const { name } = body;
      const paramTenantId = (request.params as any)?.tenantId;
      const tenantId = paramTenantId || actor.tenantId;

      if (!id) {
        return reply.status(400).send({ error: "id é obrigatório" });
      }

      const normalizedNewName = name ? name.trim() : id;
      const tenantTagsMap = this.getTenantTagsMap(tenantId);
      const deletedSet = this.getDeletedTagsSet(tenantId);

      if (id !== normalizedNewName) {
        tenantTagsMap.delete(id);
        deletedSet.add(id);
        deletedSet.add(id.toLowerCase());
      }

      deletedSet.delete(normalizedNewName);
      deletedSet.delete(normalizedNewName.toLowerCase());

      const updatedTag: TagItem = {
        id: normalizedNewName,
        tenantId,
        name: normalizedNewName,
        createdAt: new Date().toISOString()
      };
      tenantTagsMap.set(normalizedNewName, updatedTag);

      await auditService.logEvent({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'METADATA',
        action: 'TAG_UPDATE',
        actionTitle: `Tag "${normalizedNewName}" Atualizada`,
        details: `Tag de metadados atualizada para "${normalizedNewName}"`,
        metadata: { oldTag: id, newTag: normalizedNewName }
      });

      try {
        const updated = await (prisma as any).tag.update({
          where: { id },
          data: { name: normalizedNewName }
        });
        return reply.status(200).send(updated);
      } catch {
        return reply.status(200).send(updatedTag);
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
      const paramTenantId = (request.params as any)?.tenantId;
      const tenantId = paramTenantId || actor.tenantId;

      if (!id) {
        return reply.status(400).send({ error: "id é obrigatório" });
      }

      const tenantTagsMap = this.getTenantTagsMap(tenantId);
      const deletedSet = this.getDeletedTagsSet(tenantId);

      tenantTagsMap.delete(id);
      deletedSet.add(id);
      deletedSet.add(id.toLowerCase());

      try {
        await (prisma as any).tag.deleteMany({
          where: { OR: [{ id }, { name: id }] }
        });
      } catch {
        // ignore
      }

      await auditService.logEvent({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'METADATA',
        action: 'TAG_DELETE',
        actionTitle: `Tag "${id}" Excluída`,
        details: `Tag de metadados "${id}" foi removida`,
        metadata: { tagId: id }
      });

      return reply.status(200).send({ message: "Tag excluída com sucesso", id });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao excluir tag" });
    }
  }
}

export default new TagManagementController();
