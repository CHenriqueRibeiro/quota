import type { FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();


type LatencyQuery = {
  startDate?: string;
  endDate?: string;
};


export class LatencyController {


  async latency(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {

    try {


      const query =
        request.query as LatencyQuery;



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



      const latencyRaw =
        await prisma.usageLog.findMany({

          where,

          select:{
            latencyMs:true
          }

        });



      const values =
        latencyRaw
        .map(item =>
          item.latencyMs
        )
        .filter(
          (value): value is number =>
            value !== null
        )
        .sort(
          (a,b)=>a-b
        );




      function percentile(
        values:number[],
        percent:number
      ){

        if(values.length === 0){
          return 0;
        }



        const index =
          Math.ceil(
            (percent / 100) *
            values.length
          ) - 1;



        return values[index] ?? 0;

      }




      const average =
        values.length > 0
          ?
            Math.round(
              values.reduce(
                (acc,value)=>
                  acc + value,
                0
              )
              /
              values.length
            )
          :
            0;




      return reply.send({


        latency:{


          average,


          p50:
            percentile(
              values,
              50
            ),


          p95:
            percentile(
              values,
              95
            ),


          p99:
            percentile(
              values,
              99
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
          "Erro ao buscar latência"

      });

    }

  }

}