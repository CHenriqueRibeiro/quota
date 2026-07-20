import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();


type AgentsQuery = {
  startDate?: string;
  endDate?: string;
};


export class AgentsController {


  async agents(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {

    try {

      const query =
        request.query as AgentsQuery;


      const tenantId =
        request.user?.tenantId;


      if(!tenantId){

        return reply.status(401).send({
          error:"Tenant não encontrado"
        });

      }


      const now = new Date();


      const startOfMonth =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );


      const startDate =
        query.startDate
          ? new Date(query.startDate)
          : startOfMonth;


      const endDate =
        query.endDate
          ? new Date(query.endDate)
          : now;



      const where = {

        tenantId,

        createdAt:{
          gte:startDate,
          lte:endDate
        }

        

      };



      const agentsRaw =
        await prisma.usageLog.groupBy({

          where,

          by:[
            "agent"
          ],

          _sum:{
            totalTokens:true,
            estimatedCost:true
          },

          _count:{
            id:true
          }

        });



      const agents =
        agentsRaw
        .map(item => ({

          name:
            item.agent ?? "Sem agente",


          requests:
            item._count.id,


          tokens:
            item._sum.totalTokens ?? 0,


          cost:
            Number(
              item._sum.estimatedCost ?? 0
            )

        }))
        .sort(
          (a,b)=>
            b.tokens - a.tokens
        );



      return reply.send({

        agents,


        period:{

          startDate,

          endDate

        }

      });


    }catch(error){

      console.error(error);


      return reply.status(500).send({

        message:
          "Erro ao buscar agents"

      });

    }

  }

}