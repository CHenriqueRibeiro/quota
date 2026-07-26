import type { FastifyInstance } from "fastify";

import {
  authenticate
} from "../middleware/auth.middleware";

import widgetController from "../controllers/widget.controller";


export async function widgetRoutes(
  server: FastifyInstance
){

  server.post(
    "/widgets",
    {
      preHandler:[
        authenticate
      ]
    },
    widgetController.create.bind(
      widgetController
    )
  );


  // informações públicas do widget
  server.get(
    "/widget/public/:publicKey",
    widgetController.publicInfo.bind(
      widgetController
    )
  );


  // inicialização da sessão
  server.get(
    "/widget/init/:publicKey",
    widgetController.init.bind(
      widgetController
    )
  );


  server.put(
    "/widgets/:id/logo",
    {
      preHandler:[
        authenticate
      ]
    },
    widgetController.updateLogo.bind(
      widgetController
    )
  );

}