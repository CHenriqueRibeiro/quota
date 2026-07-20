import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


type OverviewQuery = {

  startDate?: string;

  endDate?: string;

};



export class OverviewController {


  async overview(
    request: FastifyRequest,
    reply: FastifyReply
  ) {


    try {


      const query =
        request.query as OverviewQuery;



      const tenantId =
        request.user?.tenantId;



      if(!tenantId){

        return reply.status(401).send({

          message:
            "Tenant não identificado."

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




      const usage =
        await prisma.usageLog.aggregate({


          where,


          _count:{

            id:true

          },


          _sum:{


            totalTokens:true,

            promptTokens:true,

            completionTokens:true,

            estimatedCost:true


          },


          _avg:{


            latencyMs:true


          }


        });





      return reply.send({


        requests:


          usage._count.id,



        tokens:{


          total:

            usage._sum.totalTokens ?? 0,


          input:

            usage._sum.promptTokens ?? 0,


          output:

            usage._sum.completionTokens ?? 0


        },



        cost:


          Number(
            usage._sum.estimatedCost ?? 0
          ),



        latency:{


          averageMs:

            Math.round(

              Number(
                usage._avg.latencyMs ?? 0
              )

            )


        },



        period:{


          startDate,

          endDate


        }



      });



    }catch(error){


      console.error(error);



      return reply.status(500).send({

        message:
          "Erro ao buscar overview."

      });


    }


  }


}