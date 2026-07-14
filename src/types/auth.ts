import type { FastifyRequest } from 'fastify';
import type { SupportedProvider } from '../lib/providers';
import type { ProviderName } from '@prisma/client';

export type UserRole = 'OWNER' | 'MANAGER' | 'ANALYST' | 'DEV';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  tenantId?: string;
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

export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthenticatedUser;

  tenantId?: string;

  apiKey?: AuthenticatedApiKey;
}