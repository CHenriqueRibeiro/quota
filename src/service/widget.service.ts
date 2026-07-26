import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import cloudinary from "../service/cloudinary.service";

const prisma = new PrismaClient();


interface InitWidgetParams {
  publicKey: string;
  origin?: string;
  ipHash?: string;
  userAgent?: string;
}
interface CreateWidgetBody {

  tenantId: string;

  assistantId: string;

  name: string;

  allowedDomains: string[];

  securityLevel?: "STANDARD" | "STRICT";

  rateLimit?: number;

  logo?: string;

  primaryColor?: string;

  welcomeMessage?: string;

}

class WidgetService {

async create(
  data: CreateWidgetBody
) {

  const assistant =
    await prisma.assistant.findFirst({

      where:{

        id:data.assistantId,

        tenantId:data.tenantId

      }

    });

  if(!assistant){

    throw new Error(
      "Assistant não encontrado."
    );

  }

  const publicKey =
    crypto.randomBytes(32).toString("hex");

  return prisma.widget.create({

    data:{

      tenantId:data.tenantId,

      assistantId:data.assistantId,

      name:data.name,

      publicKey,

      allowedDomains:data.allowedDomains,

      securityLevel:
        data.securityLevel ?? "STANDARD",

      rateLimit:
        data.rateLimit ?? 100,

      logo:data.logo,

      primaryColor:data.primaryColor,

      welcomeMessage:data.welcomeMessage

    }

  });

}
  async initWidget(params: InitWidgetParams) {

    const {
      publicKey,
      origin,
      ipHash,
      userAgent
    } = params;


    const widget = await prisma.widget.findUnique({
      where: {
        publicKey
      },
      include: {
        assistant: {
          include: {
            Topic: {
              where:{
                enabled:true
              },
              orderBy:{
                sortOrder:"asc"
              },
              select:{
                id:true,
                name:true,
                description:true,
                category:true
              }
            }
          }
        }
      }
    });


    /**
     * Não revelar se existe ou não
     * evita enumeração de widgets
     */
    if(
      !widget ||
      !widget.active ||
      !widget.assistant.enabled
    ){
      throw new Error(
        "WIDGET_UNAVAILABLE"
      );
    }


    /**
     * Validação de domínio
     */
    if(
      origin &&
      !this.validateDomain(
        origin,
        widget.allowedDomains
      )
    ){

      throw new Error(
        "DOMAIN_NOT_ALLOWED"
      );
    }


    /**
     * Cria sessão temporária
     */
    const token = crypto
      .randomBytes(32)
      .toString("hex");


    const nonce = crypto
      .randomBytes(16)
      .toString("hex");


    const expiresAt = new Date();

    expiresAt.setMinutes(
      expiresAt.getMinutes() + 30
    );


    await prisma.widgetSession.create({
      data:{
        widgetId: widget.id,
        token,
        nonce,
        expiresAt,
        ipHash,
        userAgent
      }
    });


    /**
     * Log inicial
     */
    const requestId = crypto.randomUUID();
    await prisma.widgetRequestLog.create({
 data:{
   requestId,
   widgetId: widget.id,
   tenantId: widget.tenantId,
   origin,
   statusCode:200,
   ipHash,
   userAgent
 }
});



    return {

      sessionToken: token,

      widget:{
        name: widget.name,
        logo: widget.logo,
        primaryColor: widget.primaryColor,
        welcomeMessage: widget.welcomeMessage
      },


      topics:
        widget.assistant.Topic

    };

  }

  async updateLogo(params:{
  widgetId:string;
  tenantId:string;
  buffer:Buffer;
  mimetype:string;
}){


  const widget =
    await prisma.widget.findFirst({

      where:{
        id: params.widgetId,
        tenantId: params.tenantId
      }

    });


  if(!widget){

    throw new Error(
      "Widget não encontrado."
    );

  }


  const uploadResult =
    await new Promise<any>((resolve, reject)=>{


      const stream =
        cloudinary.uploader.upload_stream(

          {
            folder:"quota/widgets",

            transformation:[
              {
                width:256,
                height:256,
                crop:"limit"
              }
            ]

          },

          (error,result)=>{

            if(error){

              reject(error);

              return;

            }


            resolve(result);

          }

        );


      stream.end(params.buffer);


    });



  const updated =
    await prisma.widget.update({

      where:{
        id:widget.id
      },

      data:{
        logo:
          uploadResult.secure_url
      }

    });



  return updated;

}

  private validateDomain(
    origin:string,
    allowedDomains:any
  ){

    try{

      const url = new URL(origin);

      const hostname =
        url.hostname;


      if(!Array.isArray(allowedDomains)){
        return false;
      }


      return allowedDomains.some(
        (domain:string)=>
          hostname === domain ||
          hostname.endsWith(`.${domain}`)
      );


    }catch{

      return false;

    }

  }

  async publicInfo(
  publicKey:string
){

  const widget =
    await prisma.widget.findUnique({

      where:{
        publicKey
      },

      select:{
        name:true,
        logo:true,
        primaryColor:true,
        welcomeMessage:true
      }

    });


  if(!widget){

    throw new Error(
      "WIDGET_NOT_FOUND"
    );

  }


  return {

    name: widget.name,

    logo: widget.logo,

    primaryColor: widget.primaryColor,

    welcomeMessage: widget.welcomeMessage

  };

}
}


export default new WidgetService();