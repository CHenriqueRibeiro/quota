import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";


const prisma = new PrismaClient();


type ProjectQuery = {
  startDate?: string;
  endDate?: string;
};



export class AnalyticsProjectsController {


  async projects(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {


    try {


      const query =
        request.query as ProjectQuery;



      const tenantId =
        request.user?.tenantId;



      if(!tenantId){

        return reply.status(401).send({
          message:"Tenant não encontrado"
        });

      }



      const now = new Date();



      const startDate =
        query.startDate
          ? new Date(query.startDate)
          :
          new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );



      const endDate =
        query.endDate
          ? new Date(query.endDate)
          :
          now;




      const where = {

        tenantId,

        createdAt:{
          gte:startDate,
          lte:endDate
        }

      };




      const projectsRaw =
        await prisma.usageLog.groupBy({


          where,


          by:[
            "project"
          ],



          _sum:{
            totalTokens:true,
            estimatedCost:true
          },


          _count:{
            id:true
          }


        });





      const totalRequests =
        projectsRaw.reduce(
          (acc,item)=>
            acc + item._count.id,
          0
        );





      const projects =
        projectsRaw.map(item=>({


          name:
            item.project ??
            "Sem projeto",



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
                  (
                    item._count.id /
                    totalRequests
                  )
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


        projects

      });



    }catch(error){


      request.log.error(error);



      return reply.status(500).send({

        message:
          "Erro ao buscar projetos"

      });


    }


  }


}