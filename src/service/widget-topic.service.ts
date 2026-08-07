import { prisma } from "../lib/prisma";
import widgetSessionService from "./widget-session.service";
import topicService from "./topic.service";



interface ExecuteWidgetTopicParams {

  sessionToken:string;

  topicId:string;

  startDate?:string;

  endDate?:string;

}



class WidgetTopicService {


  async execute(
    params:ExecuteWidgetTopicParams
  ){


    const {
      sessionToken,
      topicId,
      startDate,
      endDate
    } = params;



    /**
     * Valida sessão do widget
     */
    const session =
      await widgetSessionService.validate(
        sessionToken
      );



    const widget =
      session.widget;



    const assistant =
      widget.assistant;



    if(
      !widget.active ||
      !assistant.enabled
    ){

      throw new Error(
        "WIDGET_UNAVAILABLE"
      );

    }



    /**
     * Valida se o tópico pertence
     * ao assistant do widget
     */
    const topic =
      await prisma.topic.findFirst({

        where:{

          id:topicId,

          assistantId:
            assistant.id,

          enabled:true

        }

      });



    if(!topic){

      throw new Error(
        "TOPIC_NOT_FOUND"
      );

    }



    /**
     * Usuário de contexto do widget
     *
     * Não é usuário real.
     * Serve apenas para reaproveitar
     * as regras existentes do TopicService.
     */
    const widgetUser:any = {

      id:"widget",

      tenantId:
        widget.tenantId,

      role:"ADMIN"

    };



    const result =
      await topicService.execute(

        widgetUser,

        topic.id,

        {
          startDate,
          endDate
        }

      );



    return result;


  }


}


export default new WidgetTopicService();