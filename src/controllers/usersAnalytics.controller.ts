import type { FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";

const prisma = new PrismaClient();

type UsersQuery = {
  startDate?: string;
  endDate?: string;
};

export class AnalyticsUsersController {
  async users(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;

      if (!user || !user.tenantId) {
        return reply.status(401).send({
          message: "Tenant não encontrado"
        });
      }

      const query = request.query as UsersQuery;
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);

      const endDate = query.endDate ? new Date(query.endDate) : now;

      const where = await ScopeService.buildWhere(user, startDate, endDate);




      const usersRaw =
        await prisma.usageLog.groupBy({


          where,


          by:[
            "externalUserId"
          ],



          _sum:{
            totalTokens:true,
            estimatedCost:true
          },


          _count:{
            id:true
          }


        });





      const users =
        usersRaw.map(item=>({


          name:
            item.externalUserId ??
            "Sem usuário",



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

        period:{
          startDate,
          endDate
        },


        users

      });



    }catch(error){


      request.log.error(error);


      return reply.status(500).send({

        message:
          "Erro ao buscar usuários"

      });


    }


  }


}