import type { FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { usageQueue } from "../lib/queue";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";

const prisma = new PrismaClient();

type DashboardQuery = {
  startDate?: string;
  endDate?: string;
};

export class AnalyticsController {

  async dashboard(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {

    try {

      const query = request.query as DashboardQuery;

const tenantId = request.user?.tenantId;
const user = request.user;

if(!user){

 return reply.status(401).send({
   message:"Usuário não autenticado."
 });

}
if (!tenantId) {
  return reply.status(401).send({
    message: "Tenant não identificado."
  });
}

const now = new Date();

const startOfMonth = new Date(
  now.getFullYear(),
  now.getMonth(),
  1
);

const startDate = query.startDate
  ? new Date(query.startDate)
  : startOfMonth;


const endDate = query.endDate
  ? new Date(query.endDate)
  : now;


const where =
 await ScopeService.buildWhere(
   user,
   startDate,
   endDate
 );


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

        /*
  DAILY CONSUMPTION
*/
/*
  AGENTS
*/

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
  agentsRaw.map(item => ({

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
const dailyRaw = await prisma.usageLog.findMany({

  where,

  select:{
    createdAt:true,
    totalTokens:true,
    estimatedCost:true
  }

});


const dailyMap = new Map();


for(const item of dailyRaw){

  const date =
    item.createdAt
      .toISOString()
      .split("T")[0];


  const current =
    dailyMap.get(date);


  if(current){

    current.requests += 1;

    current.tokens += item.totalTokens ?? 0;

    current.cost += Number(
      item.estimatedCost ?? 0
    );


  }else{


    dailyMap.set(
      date,
      {

        date,

        requests:1,

        tokens:item.totalTokens ?? 0,

        cost:Number(
          item.estimatedCost ?? 0
        )

      }
    );

  }

}
  /*
  JOBS
*/

const [
  pendingJobs,
  activeJobs,
  failedJobs
] = await Promise.all([

  usageQueue.getWaitingCount(),

  usageQueue.getActiveCount(),

  prisma.failedUsage.count({
  where:{
    tenantId,

    createdAt:{
      gte:startDate,
      lte:endDate
    }
  }
})

]);


// Jobs processados
const processedJobs =
  await prisma.usageLog.count({
    where
  });


// Tempo médio processamento
const averageProcessing =
  await prisma.usageLog.aggregate({

    where,

    _avg:{
      latencyMs:true
    }

  });


// Total de retries
const retries =
await prisma.failedUsage.aggregate({

  where:{
    tenantId,

    createdAt:{
      gte:startDate,
      lte:endDate
    }
  },

  _sum:{
    attempts:true
  }

});


// Taxa de erro
const errorRate =
  processedJobs > 0
    ? Number(
        (
          (failedJobs / processedJobs) *
          100
        ).toFixed(2)
      )
    : 0;



const jobs = {

  processed:
    processedJobs,


  pending:
    pendingJobs,


  active:
    activeJobs,


  failed:
    failedJobs,


  errorRate:
    `${errorRate}%`,


  averageProcessingTimeMs:
    Math.round(
      Number(
        averageProcessing._avg.latencyMs ?? 0
      )
    ),


  retries:
    retries._sum.attempts ?? 0

};

const dailyConsumption =
  Array.from(
    dailyMap.values()
  ).sort(
    (a,b)=>
      a.date.localeCompare(b.date)
  );

      /*
        PROVIDERS
      */

      const providersRaw =
        await prisma.usageLog.groupBy({

          where,

          by:[
            "provider"
          ],

          _sum:{
            totalTokens:true,
            estimatedCost:true
          },

          _count:{
            id:true
          }

        });


      const providers =
        providersRaw.map(item=>({

          name:item.provider,

          requests:item._count.id,

          tokens:item._sum.totalTokens ?? 0,

          cost:Number(
            item._sum.estimatedCost ?? 0
          )

        }));




      /*
        MODELS
      */


      const modelsRaw =
        await prisma.usageLog.groupBy({

          where,

          by:[
            "model"
          ],

          _sum:{
            totalTokens:true,
            estimatedCost:true
          },

          _count:{
            id:true
          }

        });



      const models =
        modelsRaw.map(item=>({

          name:item.model,

          requests:item._count.id,

          tokens:item._sum.totalTokens ?? 0,

          cost:Number(
            item._sum.estimatedCost ?? 0
          )

        }));




      /*
        PROJECTS
      */


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



      const projects =
        projectsRaw.map(item=>({

          name:item.project ?? "Sem projeto",

          requests:item._count.id,

          tokens:item._sum.totalTokens ?? 0,

          cost:Number(
            item._sum.estimatedCost ?? 0
          )

        }));

/*
  USERS
*/

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
  usersRaw.map(item => ({

    name:
      item.externalUserId ?? "Sem usuário",

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



      /*
        BILLING GROUPS
      */


      const billingGroupsRaw =
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



      const billingGroupsTemp =
        await Promise.all(

          billingGroupsRaw.map(
            async(item)=>{


              let name = "Sem grupo";


              if(item.billingGroupId){

                const group =
                  await prisma.billingGroup.findUnique({

                    where:{
                      id:item.billingGroupId
                    }

                  });


                if(group){
                  name = group.name;
                }

              }


              return {

                name,

                requests:item._count.id,

                tokens:item._sum.totalTokens ?? 0,

                cost:Number(
                  item._sum.estimatedCost ?? 0
                )

              };

            }

          )

        );



      // Consolida billing groups com mesmo nome
      const billingMap = new Map();


      for(const item of billingGroupsTemp){

        const current =
          billingMap.get(item.name);


        if(current){

          current.requests += item.requests;

          current.tokens += item.tokens;

          current.cost += item.cost;

        }else{

          billingMap.set(
            item.name,
            item
          );

        }

      }


      const billingGroups =
        Array.from(
          billingMap.values()
        );




/*
  LATENCY
*/

const latencyRaw =
  await prisma.usageLog.findMany({

    where,

    select:{
      latencyMs:true
    }

  });


const latencyValues =
  latencyRaw
    .map(item => item.latencyMs)
    .filter(
      (value): value is number =>
        value !== null
    )
    .sort(
      (a,b)=>a-b
    );


function percentile(
  values:number[],
  percentile:number
){

  if(values.length === 0){
    return 0;
  }


  const index =
    Math.ceil(
      (percentile / 100) * values.length
    ) - 1;


  return values[index] ?? 0;

}



const latency = {

  average:
    latencyValues.length
      ? Math.round(
          latencyValues.reduce(
            (acc,value)=>acc + value,
            0
          )
          /
          latencyValues.length
        )
      : 0,


  p50:
    percentile(
      latencyValues,
      50
    ),


  p95:
    percentile(
      latencyValues,
      95
    ),


  p99:
    percentile(
      latencyValues,
      99
    )

};

      /*
        ERROS
      */


      const errorsRaw =
        await prisma.usageLog.groupBy({

          where,

          by:[
            "statusCode"
          ],

          _count:{
            id:true
          }

        });



      const errors = {

        success:
          errorsRaw
          .filter(
            e=>e.statusCode &&
            e.statusCode >=200 &&
            e.statusCode <300
          )
          .reduce(
            (acc,e)=>acc+e._count.id,
            0
          ),


        clientErrors:
          errorsRaw
          .filter(
            e=>e.statusCode &&
            e.statusCode >=400 &&
            e.statusCode <500
          )
          .reduce(
            (acc,e)=>acc+e._count.id,
            0
          ),


        serverErrors:
          errorsRaw
          .filter(
            e=>e.statusCode &&
            e.statusCode >=500
          )
          .reduce(
            (acc,e)=>acc+e._count.id,
            0
          )

      };





      return reply.send({


        summary:{


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


          costs:{

            total:Number(
              usage._sum.estimatedCost ?? 0
            ),

            currency:"BRL"

          },


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

        },


        providers,

        models,

        billingGroups,

        projects,

        errors,


        dailyConsumption,


        users,


        latency,


        jobs,
        agents


      });


    }catch(error){

  console.error(error);


  if(
    error instanceof Error &&
    error.message === "Usuário não possui Scope."
  ){

    return reply.status(403).send({

      message:
        "Usuário sem permissão de acesso ao dashboard."

    });

  }



  if(
    error instanceof Error &&
    error.message === "Scope CUSTOM sem regras configuradas."
  ){

    return reply.status(403).send({

      message:
        "Scope sem regras configuradas."

    });

  }



  return reply.status(500).send({

    message:
      "Erro ao gerar dashboard."

  });

}

  }

}