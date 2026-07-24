import type {
  FastifyRequest,
  RouteGenericInterface,
} from "fastify";
import type { ProviderName } from "@prisma/client";

export type UserRole =
  | "OWNER"
  | "MANAGER"
  | "ANALYST"
  | "DEV";

export interface AuthenticatedUser {

  id: string;

  role: UserRole;

  tenantId: string;

  scopeId?: string;

}export interface AuthenticatedUser {

  id: string;

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
}