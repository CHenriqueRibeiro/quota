import type { FastifyInstance } from 'fastify';
import { CliKeyController } from '../controllers/cli-key.controller';
import { authenticate } from '../middleware/auth.middleware';

const cliKeyController = new CliKeyController();

export async function cliKeyRoutes(server: FastifyInstance) {
  server.post(
    '/cli-keys',
    { preHandler: [authenticate] },
    cliKeyController.createCliKey
  );

  server.get(
    '/cli-keys',
    { preHandler: [authenticate] },
    cliKeyController.listCliKeys
  );

  server.get(
    '/cli-keys/:id',
    { preHandler: [authenticate] },
    cliKeyController.getCliKeyById
  );

  server.put(
    '/cli-keys/:id',
    { preHandler: [authenticate] },
    cliKeyController.updateCliKey
  );

  server.delete(
    '/cli-keys/:id',
    { preHandler: [authenticate] },
    cliKeyController.revokeCliKey
  );

  server.post(
    '/cli-keys/:id/regenerate',
    { preHandler: [authenticate] },
    cliKeyController.regenerateCliKey
  );
}
