import type {
  FastifyReply,
  FastifyRequest
} from "fastify";

import widgetTopicService from "../service/widget-topic.service";

interface SelectTopicBody {

  sessionToken:string;

  topicId:string;

}



class WidgetChatController {


  async selectTopic(
    request:FastifyRequest,
    reply:FastifyReply
  ){

    try{


      const {
        sessionToken,
        topicId
      } =
      request.body as SelectTopicBody;



      const result =
        await widgetTopicService.execute({

          sessionToken,

          topicId

        });



      return reply.status(200).send(

        result

      );


    }
    catch(error:any){


      request.log.error(error);



      if(
        error.message === "INVALID_SESSION" ||
        error.message === "SESSION_EXPIRED" ||
        error.message === "INVALID_TOPIC" ||
        error.message === "WIDGET_UNAVAILABLE"
      ){

        return reply.status(400).send({

          error:error.message

        });

      }



      return reply.status(500).send({

        error:
          "Internal server error"

      });


    }

  }


}


export default new WidgetChatController();