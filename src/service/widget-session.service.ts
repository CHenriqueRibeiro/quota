import { prisma } from "../lib/prisma";



class WidgetSessionService {


  async validate(
    token:string
  ){


    const session =
      await prisma.widgetSession.findUnique({

        where:{
          token
        },

        include:{
          widget:{
            include:{
              assistant:true
            }
          }
        }

      });



    if(!session){

      throw new Error(
        "INVALID_SESSION"
      );

    }



    if(
      session.expiresAt < new Date()
    ){

      throw new Error(
        "SESSION_EXPIRED"
      );

    }



    if(
      !session.widget.active ||
      !session.widget.assistant.enabled
    ){

      throw new Error(
        "WIDGET_UNAVAILABLE"
      );

    }



    return session;

  }


}


export default new WidgetSessionService();