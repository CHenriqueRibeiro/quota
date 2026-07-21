import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import { PrismaClient } from "@prisma/client";
import { processAlerts } from "../service/alert-engine.service";
import { triggerAlert } from "../service/alert.service";


const prisma = new PrismaClient();


class AlertController {


  async create(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {

    try {

      const actor = request.user;

      if(!actor){
        return reply.status(401).send({
          error:"Unauthorized"
        });
      }


      const {
        tenantId,
        type,
        period,
        threshold,
        email,
        provider,
        model,
        project,
        agent,
        billingGroupId

      } = request.body as any;



      if(
        !tenantId ||
        !type ||
        !period ||
        !threshold ||
        !email
      ){

        return reply.status(400).send({
          error:
          "tenantId, type, period, threshold e email são obrigatórios"
        });

      }



      const alert =
        await prisma.alertConfig.create({

          data:{

            tenantId,
            type,
            period,
            threshold,
            email,

            provider,
            model,
            project,
            agent,
            billingGroupId

          }

        });



      return reply.status(201).send({
        message:"Alerta criado com sucesso",
        alert
      });



    }catch(error){

      request.log.error(error);

      return reply.status(400).send({
        error:"Erro ao criar alerta"
      });

    }

  }




  async list(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{

      const { tenantId } =
        request.params as {
          tenantId:string
        };



      const alerts =
        await prisma.alertConfig.findMany({

          where:{
            tenantId
          },

          orderBy:{
            createdAt:"desc"
          }

        });



      return reply.send(alerts);



    }catch(error){

      request.log.error(error);

      return reply.status(400).send({
        error:"Erro ao listar alertas"
      });

    }

  }




  async process(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{

      const {
        tenantId
      } = request.params as {
        tenantId:string
      };


      await processAlerts(tenantId);



      return reply.send({

        message:
        "Alertas processados com sucesso"

      });



    }catch(error){

      request.log.error(error);

      return reply.status(400).send({
        error:"Erro ao processar alertas"
      });

    }

  }





  async test(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{


      const {
        alertConfigId
      } = request.params as {
        alertConfigId:string
      };



      await triggerAlert({

        alertConfigId,

        title:
        "Teste de alerta Quota",

        message:
        "Este é um teste manual do sistema de alertas."

      });



      return reply.send({

        message:
        "Alerta de teste enviado"

      });



    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:"Erro ao enviar alerta de teste"
      });

    }

  }



  async notifications(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{

      const {
        tenantId
      } = request.params as {
        tenantId:string
      };



      const notifications =
        await prisma.notification.findMany({

          where:{
            tenantId
          },

          orderBy:{
            createdAt:"desc"
          },

          take:100

        });



      return reply.send(notifications);



    }catch(error){

      request.log.error(error);

      return reply.status(400).send({
        error:"Erro ao buscar notificações"
      });

    }

  }


}


export default new AlertController();