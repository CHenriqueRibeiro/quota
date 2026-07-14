import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import type { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = request.body as { email: string; password: string };

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await argon2.verify(user.passwordHash, password))) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, tenantId: user.tenantId },
        process.env.JWT_SECRET as string,
        { expiresIn: '8h' }
      );

      return reply.send({ token });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const authRequest = request as AuthenticatedRequest;
    request.log.info({ userId: authRequest.user?.id }, 'User logged out');
    return reply.send({ message: 'Logout realizado com sucesso' });
  }

  async updatePassword(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { newPassword } = request.body as { newPassword: string };
      const userId = request.user?.id;

      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      const newHash = await argon2.hash(newPassword);
      
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash }
      });

      return reply.send({ message: 'Senha atualizada com sucesso' });
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao atualizar senha' });
    }
  }
}