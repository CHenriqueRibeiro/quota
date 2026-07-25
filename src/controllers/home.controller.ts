import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import homeService from "../service/analytics/home.service";


export class HomeController {


  async getHome(
    request: FastifyRequest,
    reply: FastifyReply
  ){

    try {


      const authRequest =
        request as AuthenticatedRequest;



      const user =
        authRequest.user;



      if(!user){

        return reply.status(401).send({

          error:
            "Usuário não autenticado"

        });

      }



      const home =
        await homeService.getHome(
          user
        );



      return reply.send({

        data:home

      });



    }catch(error){


      request.log.error(error);



      return reply.status(500).send({

        error:
          "Erro ao carregar Home"

      });


    }


  }


}