import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import { PrismaClient } from "@prisma/client";
import { usageQueue } from "../lib/queue";

const prisma = new PrismaClient();

export class FailedUsageController {

  /**
   * Lista falhas por tenant
   */
  async list(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "Tenant missing" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const failed = await prisma.failedUsage.findMany({
        where: {
          tenantId,
          status: "PENDING"
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return reply.send({
        success: true,
        items: failed
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Failed usage list error"
      });
    }
  }

  async retry(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      const failed = await prisma.failedUsage.findFirst({
        where: {
          id,
          ...(actor.role !== "ADMIN" ? { tenantId: actor.tenantId } : {})
        }
      });

      if (!failed) {
        return reply.status(404).send({
          error: "Failed usage not found"
        });
      }

      await prisma.failedUsage.update({
        where: { id: failed.id },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          lastAttemptAt: new Date()
        }
      });

      await usageQueue.add(
        "usage",
        failed.payload,
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 }
        }
      );

      return reply.status(202).send({
        success: true,
        message: "Retry queued",
        requestId: failed.requestId
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Retry failed" });
    }
  }

  async retryTenant(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "Tenant missing" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const failed = await prisma.failedUsage.findMany({
        where: {
          tenantId,
          status: "PENDING"
        }
      });

      if (!failed.length) {
        return reply.send({
          success: true,
          message: "No failed usages found"
        });
      }

      for (const item of failed) {
        await prisma.failedUsage.update({
          where: { id: item.id },
          data: {
            status: "PROCESSING",
            attempts: { increment: 1 },
            lastAttemptAt: new Date()
          }
        });

        await usageQueue.add(
          "usage",
          item.payload,
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 3000 }
          }
        );
      }

      return reply.status(202).send({
        success: true,
        total: failed.length
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Tenant retry failed" });
    }
  }

}