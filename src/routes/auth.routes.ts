import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const authController = new AuthController();

export async function authRoutes(server: FastifyInstance) {
  server.post('/auth/login', authController.login);
  server.post('/auth/sso', authController.ssoLogin);

  server.get('/auth/google', authController.googleRedirect);
  server.get('/auth/google/callback', authController.googleCallback);

  server.get('/auth/microsoft', authController.microsoftRedirect);
  server.get('/auth/microsoft/callback', authController.microsoftCallback);

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

  server.get(
    '/auth/me',
    { preHandler: [authenticate] },
    authController.getMe
  );
}