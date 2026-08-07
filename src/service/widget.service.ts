import { prisma } from "../lib/prisma";
import crypto from "crypto";
import cloudinary from "../service/cloudinary.service";


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
    origin: string,
    allowedDomains: any
  ) {
    try {
      if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) {
        return true;
      }

      const url = new URL(origin);
      const hostname = url.hostname;

      return allowedDomains.some(
        (domain: string) =>
          domain === "*" ||
          hostname === domain ||
          hostname.endsWith(`.${domain}`) ||
          hostname === "localhost"
      );
    } catch {
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

  async list(tenantId: string) {
    return prisma.widget.findMany({
      where: { tenantId },
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
            provider: true,
            model: true,
            Topic: {
              where: { enabled: true },
              orderBy: { sortOrder: "asc" }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getById(tenantId: string, widgetId: string) {
    const widget = await prisma.widget.findFirst({
      where: { id: widgetId, tenantId },
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
            provider: true,
            model: true,
            Topic: {
              where: { enabled: true },
              orderBy: { sortOrder: "asc" }
            }
          }
        }
      }
    });

    if (!widget) {
      throw new Error("Widget não encontrado.");
    }

    return widget;
  }

  async update(params: {
    tenantId: string;
    widgetId: string;
    name?: string;
    assistantId?: string;
    allowedDomains?: string[];
    securityLevel?: "STANDARD" | "STRICT";
    rateLimit?: number;
    primaryColor?: string;
    welcomeMessage?: string;
    active?: boolean;
    logo?: string;
  }) {
    const existing = await prisma.widget.findFirst({
      where: { id: params.widgetId, tenantId: params.tenantId }
    });

    if (!existing) {
      throw new Error("Widget não encontrado.");
    }

    if (params.assistantId && params.assistantId !== existing.assistantId) {
      const assistant = await prisma.assistant.findFirst({
        where: { id: params.assistantId, tenantId: params.tenantId }
      });
      if (!assistant) {
        throw new Error("Assistente não encontrado.");
      }
    }

    const dataToUpdate: any = {};
    if (params.name !== undefined) dataToUpdate.name = params.name.trim();
    if (params.assistantId !== undefined) dataToUpdate.assistantId = params.assistantId;
    if (params.allowedDomains !== undefined) dataToUpdate.allowedDomains = params.allowedDomains;
    if (params.securityLevel !== undefined) dataToUpdate.securityLevel = params.securityLevel;
    if (params.rateLimit !== undefined) dataToUpdate.rateLimit = params.rateLimit;
    if (params.primaryColor !== undefined) dataToUpdate.primaryColor = params.primaryColor;
    if (params.welcomeMessage !== undefined) dataToUpdate.welcomeMessage = params.welcomeMessage;
    if (params.active !== undefined) dataToUpdate.active = params.active;
    if (params.logo !== undefined) dataToUpdate.logo = params.logo;

    return prisma.widget.update({
      where: { id: existing.id },
      data: dataToUpdate,
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
            provider: true,
            model: true
          }
        }
      }
    });
  }

  async delete(tenantId: string, widgetId: string) {
    const existing = await prisma.widget.findFirst({
      where: { id: widgetId, tenantId }
    });

    if (!existing) {
      throw new Error("Widget não encontrado.");
    }

    await prisma.widget.delete({
      where: { id: existing.id }
    });

    return { message: "Widget excluído com sucesso" };
  }
}


export default new WidgetService();