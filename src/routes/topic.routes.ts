import type {
  FastifyInstance
} from "fastify";

import {
  authenticate
} from "../middleware/auth.middleware";

import {
  TopicController
} from "../controllers/topic.controller";


const controller =
  new TopicController();



export async function topicRoutes(
  app: FastifyInstance
){


  app.post(

    "/topics",

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

    "/topics",

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

    "/topics/defaults",

    {
      preHandler:[
        authenticate
      ]
    },

    controller.listDefaults.bind(
      controller
    )

  );

  app.post(

    "/topics/defaults",

    {
      preHandler:[
        authenticate
      ]
    },

    controller.addDefaults.bind(
      controller
    )

  );

  app.post(

    "/topics/:id/execute",

    {
      preHandler:[
        authenticate
      ]
    },

    controller.execute.bind(
      controller
    )

  );

  app.get(

    "/topics/:id",

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

    "/topics/:id",

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

    "/topics/:id",

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
