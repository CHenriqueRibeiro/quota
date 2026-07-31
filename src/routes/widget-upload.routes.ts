import type { FastifyInstance } from "fastify";
import cloudinary from "../service/cloudinary.service";
import { authenticate } from "../middleware/auth.middleware";

export async function widgetUploadRoutes(server: FastifyInstance) {

  server.post(
    "/widget/upload-logo",
    { preHandler: [authenticate] },
    async (request, reply) => {

    try {

      const body = request.body as {
        image: string;
      };


      if (!body.image) {
        return reply.status(400).send({
          message: "Imagem não informada",
        });
      }


      const result = await cloudinary.uploader.upload(body.image, {
        folder: "quota/widgets",
        transformation: [
          {
            width: 256,
            height: 256,
            crop: "limit",
          }
        ],
      });


      return reply.send({
        url: result.secure_url,
      });


    } catch (error) {

      server.log.error(error);

      return reply.status(500).send({
        message: "Erro ao enviar imagem",
      });

    }

  });

}