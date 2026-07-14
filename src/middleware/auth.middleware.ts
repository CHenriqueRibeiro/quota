import jwt from 'jsonwebtoken';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest, UserRole } from '../types/auth';

const roleHierarchy: Record<UserRole, number> = {
  OWNER: 4,
  MANAGER: 3,
  ANALYST: 2,
  DEV: 1
};

const isValidRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' && value in roleHierarchy;
};

export const authenticate = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const systemSecret = process.env.SYSTEM_OWNER_SECRET;
    const systemSecretHeader = request.headers['x-system-secret'];

    if (typeof systemSecretHeader === 'string' && systemSecret && systemSecretHeader === systemSecret) {
      request.user = { id: 'system-owner', role: 'OWNER' } as const;
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return reply.status(401).send({ error: 'Token missing' });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return reply.status(401).send({ error: 'Invalid authorization header' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return reply.status(500).send({ error: 'JWT secret is not configured' });
    }

    const decoded = jwt.verify(token, secret) as { id?: unknown; role?: unknown; tenantId?: unknown };

    if (typeof decoded.id !== 'string' || !isValidRole(decoded.role)) {
      return reply.status(401).send({ error: 'Invalid token payload' });
    }

    const user = {
      id: decoded.id,
      role: decoded.role
    } as const;

    if (typeof decoded.tenantId === 'string') {
      request.user = { ...user, tenantId: decoded.tenantId };
      return;
    }

    request.user = user;
  } catch (error) {
    request.log.error(error);
    return reply.status(401).send({ error: 'Invalid token' });
  }
};

export const authorize = (requiredRole: UserRole) => {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {

    const user = request.user;
    const userRole = user?.role;

    const userLevel = userRole 
      ? roleHierarchy[userRole] 
      : undefined;

    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel === undefined || userLevel < requiredLevel) {
      return reply.status(403).send({
        error: 'Access denied: insufficient permission'
      });
    }
  };
};