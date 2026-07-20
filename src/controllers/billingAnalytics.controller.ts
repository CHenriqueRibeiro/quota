import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();


type BillingQuery = {
  startDate?: string;
  endDate?: string;
};


export class AnalyticsBillingController {


  async billingGroups(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {


    try {


      const query =
        request.query as BillingQuery;



      const tenantId =
        request.user?.tenantId;



      if(!tenantId){

        return reply.status(401).send({
          message:"Tenant não encontrado"
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



      const billingRaw =
        await prisma.usageLog.groupBy({


          where,


          by:[
            "billingGroupId"
          ],


          _sum:{
            totalTokens:true,
            estimatedCost:true
          },


          _count:{
            id:true
          }


        });




      const billingTemp =
        await Promise.all(


          billingRaw.map(
            async(item)=>{


              let name =
                "Sem grupo";



              if(item.billingGroupId){


                const group =
                  await prisma.billingGroup.findFirst({

                    where:{
                      id:item.billingGroupId,
                      tenantId
                    }

                  });



                if(group){

                  name =
                    group.name;

                }


              }



              return {


                name,


                requests:
                  item._count.id,


                tokens:
                  item._sum.totalTokens ?? 0,


                cost:
                  Number(
                    item._sum.estimatedCost ?? 0
                  )


              };


            }

          )


        );




      /*
        Consolida nomes iguais
      */


      const map =
        new Map();



      for(const item of billingTemp){


        const current =
          map.get(item.name);



        if(current){


          current.requests +=
            item.requests;


          current.tokens +=
            item.tokens;


          current.cost +=
            item.cost;


        }else{


          map.set(
            item.name,
            item
          );


        }


      }



      const billingGroups =
        Array.from(
          map.values()
        );




      return reply.send({

        period:{
          startDate,
          endDate
        },


        billingGroups


      });



    }catch(error){


      request.log.error(error);


      return reply.status(500).send({

        message:
          "Erro ao buscar billing groups"

      });


    }


  }


}