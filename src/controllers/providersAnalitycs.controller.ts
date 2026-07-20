import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";


const prisma = new PrismaClient();


type AnalyticsQuery = {
  startDate?: string;
  endDate?: string;
};



export class ProvidersAnalyticsController {


  async providers(
    request: FastifyRequest,
    reply: FastifyReply
  ) {


    try {


      const authRequest =
        request as AuthenticatedRequest;


      const tenantId =
        authRequest.user?.tenantId;



      if(!tenantId){

        return reply.status(401).send({
          error:"Tenant não identificado"
        });

      }



      const query =
        request.query as AnalyticsQuery;



      const now = new Date();


      const startDate =
        query.startDate
          ? new Date(query.startDate)
          : new Date(
              now.getFullYear(),
              now.getMonth(),
              1
            );



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




      const providersRaw =
        await prisma.usageLog.groupBy({

          where,

          by:[
            "provider"
          ],


          _count:{
            id:true
          },


          _sum:{
            totalTokens:true,
            estimatedCost:true
          }


        });



      const totalRequests =
        providersRaw.reduce(
          (acc,item)=>
            acc + item._count.id,
          0
        );




      const providers =
        providersRaw.map(item=>({


          name:item.provider,


          requests:
            item._count.id,


          tokens:
            item._sum.totalTokens ?? 0,


          cost:
            Number(
              item._sum.estimatedCost ?? 0
            ),


          percentage:
            totalRequests > 0
              ?
              Number(
                (
                  (item._count.id /
                  totalRequests)
                  *
                  100
                )
                .toFixed(2)
              )
              :
              0


        }))
        .sort(
          (a,b)=>
            b.requests - a.requests
        );




      return reply.send({

        period:{
          startDate,
          endDate
        },


        providers

      });



    }catch(error){


      request.log.error(error);


      return reply.status(500).send({

        error:
          "Erro ao buscar providers"

      });


    }


  }


}