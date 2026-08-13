import type { FastifyInstance } from 'fastify';
import { CliTelemetryController } from '../controllers/cli-telemetry.controller';
import { validateCliKey } from '../middleware/cli-key.middleware';
import { quotaLimiter } from '../middleware/quota-limiter';

const cliTelemetryController = new CliTelemetryController();

export async function cliTelemetryRoutes(server: FastifyInstance) {
  server.post(
    '/cli-telemetry',
    {
      preHandler: [
        validateCliKey,
        quotaLimiter(200)
      ]
    },
    cliTelemetryController.execute
  );

  server.get(
    '/cli-telemetry/ping',
    {
      preHandler: [
        validateCliKey
      ]
    },
    cliTelemetryController.ping
  );
}
