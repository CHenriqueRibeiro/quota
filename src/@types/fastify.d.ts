import type { AuthenticatedApiKey, AuthenticatedUser } from "../types/auth";


declare module "fastify" {

  interface FastifyRequest {

    user?: AuthenticatedUser;

    tenantId?: string;

    apiKey?: AuthenticatedApiKey;

  }

}