import type {
  FastifyReply,
  FastifyRequest
} from "fastify";

import type {
  AuthenticatedRequest
} from "../types/auth";

import assistantService from "../service/assistant.service";


export class AssistantController {


  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ){

    try{

      const authRequest =
        request as AuthenticatedRequest;



      const assistant =
        await assistantService.create(

          authRequest.user!,

          request.body as any

        );



      return reply.status(201).send({

        data:assistant

      });


    }
    catch(error:any){

      request.log.error(error);


      return reply.status(400).send({

        error:error.message

      });

    }

  }

  async list(
  request: FastifyRequest,
  reply: FastifyReply
){

  try{

    const authRequest =
      request as AuthenticatedRequest;



    const assistants =
      await assistantService.list(

        authRequest.user!

      );



    return reply.send({

      data:assistants

    });

  }
  catch(error:any){

    request.log.error(error);

    return reply.status(500).send({

      error:error.message

    });

  }

}

  async listAvailableApiKeys(
  request: FastifyRequest,
  reply: FastifyReply
){

  try{

    const authRequest =
      request as AuthenticatedRequest;



    const apiKeys =
      await assistantService.listAvailableApiKeys(

        authRequest.user!

      );



    return reply.send({

      data:apiKeys

    });

  }
  catch(error:any){

    request.log.error(error);

    return reply.status(500).send({

      error:error.message

    });

  }

}

    async getById(
  request: FastifyRequest,
  reply: FastifyReply
){

  try{

    const authRequest =
      request as AuthenticatedRequest;


    const { id } =
      request.params as {
        id:string
      };



    const assistant =
      await assistantService.getById(

        authRequest.user!,

        id

      );



    return reply.send({

      data:assistant

    });


  }
  catch(error:any){

    request.log.error(error);


    return reply.status(404).send({

      error:error.message

    });

  }

}

    async update(
  request: FastifyRequest,
  reply: FastifyReply
){

  try{

    const authRequest =
      request as AuthenticatedRequest;



    const { id } =
      request.params as {
        id:string
      };



    const assistant =
      await assistantService.update(

        authRequest.user!,

        id,

        request.body as any

      );



    return reply.send({

      data:assistant

    });


  }
  catch(error:any){

    request.log.error(error);



    return reply.status(400).send({

      error:error.message

    });

  }

}

    async delete(
  request: FastifyRequest,
  reply: FastifyReply
){

  try{

    const authRequest =
      request as AuthenticatedRequest;



    const { id } =
      request.params as {
        id:string
      };



    const assistant =
      await assistantService.delete(

        authRequest.user!,

        id

      );



    return reply.send({

      data:assistant,

      message:
        "Assistente removido com sucesso."

    });


  }
  catch(error:any){

    request.log.error(error);



    return reply.status(404).send({

      error:error.message

    });

  }

}
}
