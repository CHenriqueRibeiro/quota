import type {
  FastifyRequest,
  RouteGenericInterface,
} from "fastify";
import type { ProviderName } from "@prisma/client";

export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "ANALYST"
  | "DEV";

export interface CliKeyMeta {
  agent?: string | null;
  project?: string | null;
  billingGroup?: string | null;
  environment?: string | null;
  tags?: string[] | null;
}

export interface AuthenticatedUser {
  id: string;
  name?: string;
  email?: string;
  role: UserRole;
  tenantId: string;
  scopeId?: string;
}

export interface AuthenticatedApiKey {
  id: string;
  key: string;
  name: string;
  tenantId: string;
  provider: ProviderName;
  providerCredentialId: string;
  allowedModels?: string[] | null;
}

export interface AuthenticatedRequest<
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface
> extends FastifyRequest<RouteGeneric> {
  user?: AuthenticatedUser;
  tenantId?: string;
  apiKey?: AuthenticatedApiKey;
  cliKeyMeta?: CliKeyMeta;
}