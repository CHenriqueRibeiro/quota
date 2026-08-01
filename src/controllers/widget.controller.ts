import type { FastifyReply, FastifyRequest } from "fastify";
import "@fastify/multipart";
import widgetService from "../service/widget.service";


interface InitWidgetRequest {
  publicKey: string;
}
interface CreateWidgetRequest {

  assistantId: string;

  name: string;

  allowedDomains: string[];

  securityLevel?: "STANDARD" | "STRICT";

  rateLimit?: number;

  logo?: string;

  primaryColor?: string;

  welcomeMessage?: string;

}

class WidgetController {
async create(
  request: FastifyRequest,
  reply: FastifyReply
){

  try{

    const authRequest =
      request as any;

    const widget =
      await widgetService.create({

        tenantId:
          authRequest.user.tenantId,

        ...(request.body as CreateWidgetRequest)

      });

    return reply.status(201).send({

      data: widget

    });

  }
  catch(error:any){

    request.log.error(error);

    return reply.status(400).send({

      error: error.message

    });

  }

}

  async init(
    request: FastifyRequest,
    reply: FastifyReply
  ) {

    try {


      const {
        publicKey
      } = request.params as InitWidgetRequest;



      const origin =
        request.headers.origin;



      const userAgent =
        request.headers["user-agent"];



      const ip =
        request.ip;



      const result =
        await widgetService.initWidget({
          publicKey,
          origin,
          userAgent,
          ipHash: ip
        });



      return reply.status(200).send(
        result
      );



    } catch(error:any){


      /**
       * Não revelar detalhes
       * de segurança para quem chama
       */

      if(
        error.message === "DOMAIN_NOT_ALLOWED" ||
        error.message === "WIDGET_UNAVAILABLE"
      ){

        return reply.status(200).send({

          available:false,

          message:
            "Assistente indisponível"

        });

      }



      request.log.error(error);



      return reply.status(500).send({

        error:
          "Internal server error"

      });


    }

  }

async updateLogo(
  request: FastifyRequest,
  reply: FastifyReply
){

  try {

    const authRequest =
      request as any;


    const {
      id
    } = request.params as {
      id:string;
    };


    const file =
      await request.file();


    if(!file){

      return reply.status(400).send({

        error:"Imagem não informada"

      });

    }


    const buffer =
      await file.toBuffer();


    const widget =
      await widgetService.updateLogo({

        widgetId:id,

        tenantId:
          authRequest.user.tenantId,

        buffer,

        mimetype:
          file.mimetype

      });


    return reply.send({

      data: widget

    });


  } catch(error:any){


    request.log.error(error);


    return reply.status(400).send({

      error:error.message

    });

  }

}

async publicInfo(
  request: FastifyRequest,
  reply: FastifyReply
){

  try {

    const {
      publicKey
    } = request.params as InitWidgetRequest;


    const widget =
      await widgetService.publicInfo(
        publicKey
      );


    return reply.status(200).send(
      widget
    );


  } catch(error:any){

    request.log.error(error);


    return reply.status(404).send({

      error:
        "Widget não encontrado"

    });

  }

}

  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as any).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      if (actor.role !== "OWNER" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const widgets = await widgetService.list(tenantId);
      return reply.status(200).send({ data: widgets });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao listar widgets" });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as any).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      const widget = await widgetService.getById(actor.tenantId, id);
      return reply.status(200).send({ data: widget });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(404).send({ error: error.message || "Widget não encontrado" });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as any).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      const body = (request.body as any) || {};

      const widget = await widgetService.update({
        tenantId: actor.tenantId,
        widgetId: id,
        ...body
      });

      return reply.status(200).send({ data: widget });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message || "Erro ao atualizar widget" });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as any).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      const result = await widgetService.delete(actor.tenantId, id);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error.message || "Erro ao excluir widget" });
    }
  }
}

export default new WidgetController();