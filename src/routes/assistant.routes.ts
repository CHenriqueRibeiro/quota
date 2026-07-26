import type {
  FastifyInstance
} from "fastify";

import {
  authenticate
} from "../middleware/auth.middleware";

import {
  AssistantController
} from "../controllers/assistant.controller";


const controller =
  new AssistantController();


export async function assistantRoutes(
  app: FastifyInstance
){

  app.post(

    "/assistants",

    {

      preHandler:[
        authenticate
      ]

    },

    controller.create.bind(
      controller
    )

  );

  app.get(

  "/assistants",

  {

    preHandler:[
      authenticate
    ]

  },

  controller.list.bind(
    controller
  )

);

  app.get(

  "/assistants/api-keys",

  {

    preHandler:[
      authenticate
    ]

  },

  controller.listAvailableApiKeys.bind(
    controller
  )

);

  app.get(

  "/assistants/:id",

  {
    preHandler:[
      authenticate
    ]
  },

  controller.getById.bind(
    controller
  )

);

  app.put(

  "/assistants/:id",

  {
    preHandler:[
      authenticate
    ]
  },

  controller.update.bind(
    controller
  )

);

    app.delete(

  "/assistants/:id",

  {
    preHandler:[
      authenticate
    ]
  },

  controller.delete.bind(
    controller
  )

);
}
