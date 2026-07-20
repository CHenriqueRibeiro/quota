import type { FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();


type DailyConsumptionQuery = {
  startDate?: string;
  endDate?: string;
};


export class DailyConsumptionController {


  async dailyConsumption(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {

    try {

      const query =
        request.query as DailyConsumptionQuery;


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



      const usage =
        await prisma.usageLog.findMany({

          where,

          select:{
            createdAt:true,
            totalTokens:true,
            estimatedCost:true
          }

        });



      const dailyMap =
        new Map<string, {

          date:string;

          requests:number;

          tokens:number;

          cost:number;

        }>();



      for(const item of usage){


        const date =
          item.createdAt
          .toLocaleDateString(
            "sv-SE",
            {
              timeZone:"America/Sao_Paulo"
            }
          );


        const current =
          dailyMap.get(date);



        if(current){


          current.requests += 1;


          current.tokens +=
            item.totalTokens ?? 0;


          current.cost +=
            Number(
              item.estimatedCost ?? 0
            );


        }else{


          dailyMap.set(

            date,

            {

              date,

              requests:1,

              tokens:
                item.totalTokens ?? 0,


              cost:
                Number(
                  item.estimatedCost ?? 0
                )

            }

          );

        }

      }



      const dailyConsumption =
        Array.from(
          dailyMap.values()
        )
        .sort(
          (a,b)=>
            a.date.localeCompare(b.date)
        );



      return reply.send({

        dailyConsumption,


        period:{

          startDate,

          endDate

        }

      });



    }catch(error){


      console.error(error);


      return reply.status(500).send({

        message:
          "Erro ao buscar consumo diário"

      });

    }

  }

}