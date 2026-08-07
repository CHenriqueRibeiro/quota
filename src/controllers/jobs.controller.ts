import type { FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { usageQueue } from "../lib/queue";
import ScopeService from "../service/scope.service";

type JobsQuery = {
  startDate?: string;
  endDate?: string;
};

export class JobsController {
  async jobs(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;

      if (!user || !user.tenantId) {
        return reply.status(401).send({
          error: "Tenant não encontrado"
        });
      }

      const query = request.query as JobsQuery;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const startDate = query.startDate ? new Date(query.startDate) : startOfMonth;
      const endDate = query.endDate ? new Date(query.endDate) : now;

      const where = await ScopeService.buildWhere(user, startDate, endDate);



      const [
        pending,
        active,
        failed
      ] = await Promise.all([


        usageQueue.getWaitingCount(),


        usageQueue.getActiveCount(),


        prisma.failedUsage.count({

          where:{
            tenantId: user.tenantId,

            createdAt:{
              gte:startDate,
              lte:endDate
            }

          }

        })

      ]);




      const processed =
        await prisma.usageLog.count({

          where

        });





      const processingTime =
        await prisma.usageLog.aggregate({

          where,


          _avg:{
            latencyMs:true
          }

        });





      const retries =
        await prisma.failedUsage.aggregate({

          where:{
            tenantId: user.tenantId,

            createdAt:{
              gte:startDate,
              lte:endDate
            }

          },


          _sum:{
            attempts:true
          }

        });





      const totalRequests = processed + failed;

      const errorRate =
        totalRequests > 0
          ? Number(((failed / totalRequests) * 100).toFixed(2))
          : 0;





      return reply.send({


        jobs:{


          processed,


          pending,


          active,


          failed,


          errorRate:
            `${errorRate}%`,



          averageProcessingTimeMs:
            Math.round(
              Number(
                processingTime
                ._avg
                .latencyMs ?? 0
              )
            ),



          retries:
            retries
            ._sum
            .attempts ?? 0

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
          "Erro ao buscar jobs"

      });

    }

  }

}