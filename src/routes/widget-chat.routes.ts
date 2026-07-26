import type {
  FastifyInstance
} from "fastify";

import widgetChatController from "../controllers/widget-chat.controller";


export async function widgetChatRoutes(
  server:FastifyInstance
){


  server.post(

    "/widget/chat/select-topic",

    widgetChatController.selectTopic.bind(
      widgetChatController
    )

  );


}