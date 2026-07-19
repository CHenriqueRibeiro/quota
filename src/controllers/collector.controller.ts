import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { usageQueue } from '../lib/queue';
import { randomUUID } from 'node:crypto';

export class CollectorController {
  async execute(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const body = request.body as any;


      const {
        provider,
        model
      } = body;


      const tenantId =
        request.user?.tenantId ?? request.tenantId;


      const apiKeyId =
        request.apiKey?.id;


      if (!apiKeyId) {
        return reply.status(401).send({
          error: 'API Key missing'
        });
      }


      if (!tenantId) {
        return reply.status(403).send({
          error: 'Tenant missing'
        });
      }


      if (!provider || !model) {
        return reply.status(400).send({
          error: 'provider and model are required'
        });
      }


      const event = {
        source: 'collector',

        tenantId,

        apiKeyId,

        traceId:
          body.traceId ?? randomUUID(),
        requestId:
          body.requestId ?? randomUUID(),


        provider:
          body.provider,


        model:
          body.model,


        promptTokens:
          Number(body.promptTokens ?? 0),


        completionTokens:
          Number(body.completionTokens ?? 0),


        totalTokens:
          Number(body.totalTokens ?? 0),


        latencyMs:
          Number(body.latencyMs ?? 0),


        statusCode:
          Number(body.statusCode ?? 200),


        success:
          body.success ?? true,


        agent:
          body.metadata?.agent ?? null,


        project:
          body.metadata?.project ?? null,


        environment:
          body.metadata?.environment ?? null,

        billingGroup: body.billingGroup ?? null,
        externalUserId:
          body.metadata?.externalUserId ?? null,


        requestGroup:
          body.metadata?.requestGroup ?? null,


        tags:
          body.metadata?.tags ?? [],



      };

console.dir(event, { depth: null });
      await usageQueue.add(
        'usage',
        event
      );


      return reply.status(202).send({
        success: true,
        requestId: event.requestId
      });


    } catch (error) {

      request.log.error(error);


      return reply.status(500).send({
        error: 'Collector failed'
      });
    }
  }
}