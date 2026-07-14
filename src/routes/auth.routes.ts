import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const authController = new AuthController();

export async function authRoutes(server: FastifyInstance) {
  server.post('/auth/login', authController.login);

  server.post(
    '/auth/logout', 
    { preHandler: [authenticate] }, 
    authController.logout 
  );

  server.post(
    '/auth/update-password', 
    { preHandler: [authenticate] }, 
    authController.updatePassword 
  );
}