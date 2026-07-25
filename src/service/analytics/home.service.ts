import { PrismaClient, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../types/auth";
import scopeService from "../scope.service";


const prisma = new PrismaClient();



class HomeService {

  async getHome(
  user: AuthenticatedUser
){


  const endDate = new Date();


  const startDate = new Date();


  startDate.setDate(
    startDate.getDate() - 30
  );



  /*
    Monta filtro respeitando:

    - Role
    - Scope FULL
    - Scope CUSTOM
    - Tenant

  */

  const where =
    await scopeService.buildWhere(
      user,
      startDate,
      endDate
    );




  const health =
    await this.getHealth(
      where
    );




  const maturity =
    await this.getMaturity(
      where,
      user
    );




  const trends =
    await this.getTrends(
      where
    );




  const ranking =
    await this.getRanking(
      where
    );




  const budgetSummary =
  await this.getBudgetSummary(
    where,
    user
  );

const budgetOverview =
  await this.getBudgetOverview(
    where,
    user
  );

  const topCosts =
  await this.getTopCosts(
    where
  );

  const insights =
  await this.getInsights(
    where,
    trends,
    topCosts
  );

  const providerDistribution =
  await this.getProviderDistribution(
    where
  );
return {

  health,

  maturity,

  trends,

  ranking,

  budgetSummary,

  budgetOverview,

  topCosts,

  insights,

  providerDistribution

};
}

  private async getHealth(
    where: Prisma.UsageLogWhereInput
  ){


    let score = 100;


    const issues:any[] = [];







    const totalRequests =
      await prisma.usageLog.count({

        where

      });







    const failedRequests =
      await prisma.usageLog.count({

        where:{

          ...where,

          success:false

        }

      });







    const latencyResult =
      await prisma.usageLog.aggregate({

        where,

        _avg:{

          latencyMs:true

        }

      });







    const averageLatency =
      latencyResult._avg.latencyMs ?? 0;









    const retryWhere: Prisma.FailedUsageWhereInput = {


      tenantId:
        where.tenantId as string


    };







    if(where.createdAt){


      retryWhere.createdAt = {


        gte:
          (where.createdAt as Prisma.DateTimeFilter).gte as Date,


        lte:
          (where.createdAt as Prisma.DateTimeFilter).lte as Date


      };


    }







    const retryRequests =
      await prisma.failedUsage.count({

        where:retryWhere

      });









    const quota =
      await prisma.quota.findUnique({

        where:{

          tenantId:
            where.tenantId as string

        }

      });






    let quotaUsage = 0;







    if(
      quota &&
      quota.limit > 0
    ){


      quotaUsage =
        (quota.used / quota.limit) * 100;


    }









    let errorRate = 0;


    let retryRate = 0;







    if(totalRequests > 0){


      errorRate =
        (failedRequests / totalRequests) * 100;



      retryRate =
        (retryRequests / totalRequests) * 100;


    }









    if(errorRate > 5){


      score -= 20;


      issues.push({

        type:"ERROR_RATE",

        message:
          "Taxa de falhas acima do recomendado"

      });


    }









    if(averageLatency > 1500){


      score -= 15;


      issues.push({

        type:"LATENCY",

        message:
          "Latência média acima do recomendado"

      });


    }









    if(retryRate > 15){


      score -= 20;


      issues.push({

        type:"RETRY_RATE",

        message:
          "Volume de reprocessamentos crítico"

      });


    }
    else if(retryRate > 5){


      score -= 10;


      issues.push({

        type:"RETRY_RATE",

        message:
          "Volume de reprocessamentos acima do recomendado"

      });


    }









    if(quotaUsage > 90){


      score -= 15;


      issues.push({

        type:"QUOTA_USAGE",

        message:
          "Limite financeiro próximo do máximo"

      });


    }
    else if(quotaUsage > 70){


      score -= 5;


      issues.push({

        type:"QUOTA_USAGE",

        message:
          "Consumo financeiro acima do recomendado"

      });


    }









    return {


      score,


      status:
        this.getHealthStatus(score),



      period:{

        days:30

      },



      metrics:{


        totalRequests,


        failedRequests,


        errorRate:
          Number(errorRate.toFixed(2)),



        averageLatencyMs:
          Math.round(averageLatency),



        retryRequests,


        retryRate:
          Number(retryRate.toFixed(2)),



        quotaUsage:
          Number(quotaUsage.toFixed(2))


      },



      issues


    };


  }  private async getMaturity(
    where: Prisma.UsageLogWhereInput,
    user: AuthenticatedUser
  ){


    let score = 0;


    const completed:any[] = [];

    const missing:any[] = [];




    const complete = (
      item:string,
      points:number
    )=>{


      score += points;


      completed.push({

        item,

        points

      });


    };





    const miss = (
      item:string,
      points:number,
      priority:string,
      message:string
    )=>{


      missing.push({

        item,

        points,

        priority,

        message

      });


    };









    const apiKeys =
      await prisma.apiKey.count({

        where:{

          tenantId:user.tenantId,

          isActive:true

        }

      });



    if(apiKeys > 0){

      complete(
        "API Keys configuradas",
        10
      );

    }
    else{

      miss(
        "Criar API Keys",
        10,
        "Alta",
        "Configure chaves de acesso aos modelos."
      );

    }









    const providers =
      await prisma.usageLog.findMany({

        where,

        distinct:[
          "provider"
        ],

        select:{
          provider:true
        }

      });





    if(providers.length > 0){

      complete(
        "Provider configurado",
        10
      );

    }
    else{

      miss(
        "Configurar Provider",
        10,
        "Alta",
        "Nenhum provider foi utilizado."
      );

    }









    if(providers.length > 1){

      complete(
        "Multi Provider",
        10
      );

    }
    else{

      miss(
        "Adicionar Multi Provider",
        10,
        "Baixa",
        "Configure mais de um provider."
      );

    }









    const agents =
      await prisma.usageLog.findMany({

        where,

        distinct:[
          "agent"
        ],

        select:{
          agent:true
        }

      });





    if(
      agents.some(
        item => item.agent
      )
    ){

      complete(
        "Agentes configurados",
        10
      );

    }
    else{

      miss(
        "Criar Agentes",
        10,
        "Média",
        "Organize seus fluxos de IA por agentes."
      );

    }









    const projects =
      await prisma.usageLog.findMany({

        where,

        distinct:[
          "project"
        ],

        select:{
          project:true
        }

      });





    if(
      projects.some(
        item => item.project
      )
    ){

      complete(
        "Projetos configurados",
        10
      );

    }
    else{

      miss(
        "Criar Projetos",
        10,
        "Média",
        "Separe aplicações por projeto."
      );

    }









    const billingGroups =
      await prisma.billingGroup.count({

        where:{

          tenantId:user.tenantId

        }

      });





    if(billingGroups > 0){

      complete(
        "Billing Groups",
        10
      );

    }
    else{

      miss(
        "Criar Billing Groups",
        10,
        "Média",
        "Separe custos por área."
      );

    }









    const alerts =
      await prisma.alertConfig.count({

        where:{

          tenantId:user.tenantId,

          enabled:true

        }

      });





    if(alerts > 0){

      complete(
        "Alertas ativos",
        15
      );

    }
    else{

      miss(
        "Criar Alertas",
        15,
        "Alta",
        "Configure alertas de custo e operação."
      );

    }









    const quota =
      await prisma.quota.findUnique({

        where:{
          tenantId:user.tenantId
        }

      });





    if(quota){

      complete(
        "Controle financeiro",
        10
      );

    }
    else{

      miss(
        "Criar limite financeiro",
        10,
        "Alta",
        "Configure orçamento."
      );

    }









    let level = "Básico";


    if(score >= 80){

      level = "Avançado";

    }
    else if(score >= 50){

      level = "Intermediário";

    }







    return {

      score,

      level,

      completed,

      missing,

      nextStep:
        missing.length
          ? missing[0].item
          : "Ambiente totalmente configurado."

    };


  }

  private async getTrends(
    where: Prisma.UsageLogWhereInput
  ){


    const currentStart =
      (where.createdAt as Prisma.DateTimeFilter)
        ?.gte as Date;



    const previousStart =
      new Date(currentStart);


    previousStart.setDate(
      previousStart.getDate() - 30
    );



    const previousWhere: Prisma.UsageLogWhereInput = {


      ...where,


      createdAt:{

        gte:previousStart,

        lt:currentStart

      }


    };






    const [

      currentRequests,

      previousRequests,

      currentCost,

      previousCost,

      currentLatency,

      previousLatency,

      currentErrors,

      previousErrors

    ] = await Promise.all([



      prisma.usageLog.count({

        where

      }),



      prisma.usageLog.count({

        where:previousWhere

      }),



      prisma.usageLog.aggregate({

        where,

        _sum:{

          estimatedCost:true

        }

      }),



      prisma.usageLog.aggregate({

        where:previousWhere,

        _sum:{

          estimatedCost:true

        }

      }),



      prisma.usageLog.aggregate({

        where,

        _avg:{

          latencyMs:true

        }

      }),



      prisma.usageLog.aggregate({

        where:previousWhere,

        _avg:{

          latencyMs:true

        }

      }),



      prisma.usageLog.count({

        where:{

          ...where,

          success:false

        }

      }),



      prisma.usageLog.count({

        where:{

          ...previousWhere,

          success:false

        }

      })


    ]);









    const variation = (
      current:number,
      previous:number
    )=>{


      if(previous === 0){

        return 0;

      }


      return Number(
        (
          (
            (current - previous)
            /
            previous
          )
          *
          100
        ).toFixed(2)
      );

    };








    return {


      period:"30 dias comparado com período anterior",



      requests:{

        current:currentRequests,

        previous:previousRequests,

        variation:
          variation(
            currentRequests,
            previousRequests
          )

      },



      cost:{

        current:
          Number(
            (
              currentCost._sum.estimatedCost ?? 0
            )
            .toFixed(2)
          ),


        previous:
          Number(
            (
              previousCost._sum.estimatedCost ?? 0
            )
            .toFixed(2)
          ),


        variation:
          variation(
            currentCost._sum.estimatedCost ?? 0,
            previousCost._sum.estimatedCost ?? 0
          )

      },



      latency:{

        current:
          Math.round(
            currentLatency._avg.latencyMs ?? 0
          ),


        previous:
          Math.round(
            previousLatency._avg.latencyMs ?? 0
          ),


        variation:
          variation(
            currentLatency._avg.latencyMs ?? 0,
            previousLatency._avg.latencyMs ?? 0
          )

      },



      errors:{

        current:currentErrors,

        previous:previousErrors,

        variation:
          variation(
            currentErrors,
            previousErrors
          )

      }


    };


  }

private async getRanking(
  where: Prisma.UsageLogWhereInput
){


  const agents =
    await prisma.usageLog.groupBy({

      by:[
        "agent"
      ],

      where,

      _count:{
        id:true
      },

      _sum:{
        estimatedCost:true
      },

      _avg:{
        latencyMs:true
      }


    });





  const ranking = await Promise.all(

    agents

    .filter(
      item => item.agent
    )

    .map(
      async(agent)=>{


        const errors =
          await prisma.usageLog.count({

            where:{

              ...where,

              agent:agent.agent,

              success:false

            }

          });



        const requests =
          agent._count.id;



        let errorRate = 0;


        if(requests > 0){

          errorRate =
            (
              errors /
              requests
            )
            *
            100;

        }





        /*
          Score operacional

          custo menor = melhor
          latência menor = melhor
          erros menor = melhor
        */


        let score = 100;



        // penaliza erros

       if(errorRate >= 50){

  score -= 40;

}
else if(errorRate > 5){

  score -= 20;

}
else if(errorRate > 2){

  score -= 10;

}





        // penaliza latência

        const latency =
          agent._avg.latencyMs ?? 0;



        if(latency > 2000){

          score -= 20;

        }
        else if(latency > 1000){

          score -= 10;

        }





        // penaliza custo alto relativo

        const cost =
          agent._sum.estimatedCost ?? 0;



        if(
          cost > 1000
        ){

          score -= 10;

        }




        return {


          agent:
            agent.agent,


          requests,


          cost:
            Number(
                  cost.toFixed(4)

            ),



          latencyMs:
            Math.round(
              latency
            ),



          errorRate:
            Number(
              errorRate.toFixed(2)
            ),



          score,



          status:
            this.getRankingStatus(score)


        };


      }

    )

  );





  return ranking.sort(
    (a,b)=>
      b.score - a.score
  );


}

private getRankingStatus(
 score:number
){


  if(score >= 90)

    return "Excelente";



  if(score >= 70)

    return "Boa";



  if(score >= 50)

    return "Atenção";



  return "Baixa";


}

  private getHealthStatus(
    score:number
  ){


    if(score >= 90)

      return "Excelente";



    if(score >= 70)

      return "Bom";



    if(score >= 50)

      return "Atenção";



    return "Crítico";


  }
private async getBudgetSummary(
  where: Prisma.UsageLogWhereInput,
  user: AuthenticatedUser
){

  const budgets =
    await prisma.budget.findMany({

      where:{

        tenantId:user.tenantId

      },

      orderBy:{

        createdAt:"asc"

      }

    });



  const summary = [];



  for(const budget of budgets){


    const budgetWhere: Prisma.UsageLogWhereInput = {

      ...where

    };



    if(budget.billingGroupId){

      budgetWhere.billingGroupId =
        budget.billingGroupId;

    }



    if(budget.project){

      budgetWhere.project =
        budget.project;

    }



    if(budget.agent){

      budgetWhere.agent =
        budget.agent;

    }



    const usage =
      await prisma.usageLog.aggregate({

        where:budgetWhere,

        _sum:{

          estimatedCost:true

        },

        _count:{

          id:true

        }

      });



    const used =
      usage._sum.estimatedCost ?? 0;



    const requests =
      usage._count.id;



    const limit =
      budget.limit;



    let percent = 0;



    if(limit > 0){

      percent =
        (
          used /
          limit
        )
        *
        100;

    }



    let remaining =
      limit - used;



    if(remaining < 0){

      remaining = 0;

    }



    summary.push({

      id:budget.id,



      billingGroupId:
        budget.billingGroupId,



      project:
        budget.project,



      agent:
        budget.agent,



      period:
        budget.period,



      requests,



      used:
        Number(
          used.toFixed(2)
        ),



      limit:
        Number(
          limit.toFixed(2)
        ),



      remaining:
        Number(
          remaining.toFixed(2)
        ),



      percent:
        Number(
          percent.toFixed(2)
        ),



      status:
        this.getBudgetStatus(
          percent
        )

    });

  }



  return summary.sort(

    (a,b)=>

      b.percent - a.percent

  );

}

private getBudgetStatus(
  percent:number
){

  if(percent >= 100){

    return "Estourado";

  }



  if(percent >= 90){

    return "Crítico";

  }



  if(percent >= 70){

    return "Atenção";

  }



  return "Saudável";

}

private async getBudgetOverview(
  where: Prisma.UsageLogWhereInput,
  user: AuthenticatedUser
){

  const budgets =
    await prisma.budget.aggregate({

      where:{
        tenantId:user.tenantId
      },

      _sum:{
        limit:true
      }

    });



  const totalBudget =
    budgets._sum.limit ?? 0;



  const usage =
    await prisma.usageLog.aggregate({

      where,

      _sum:{
        estimatedCost:true
      }

    });



  const used =
    usage._sum.estimatedCost ?? 0;



  let percentage = 0;


  if(totalBudget > 0){

    percentage =
      (
        used /
        totalBudget
      )
      *
      100;

  }



  let remaining =
    totalBudget - used;



  if(remaining < 0){

    remaining = 0;

  }



  return {

    totalBudget:
      Number(
        totalBudget.toFixed(2)
      ),


    used:
      Number(
        used.toFixed(2)
      ),


    remaining:
      Number(
        remaining.toFixed(2)
      ),


    usage:
      Number(
        percentage.toFixed(2)
      ),


    status:
      this.getBudgetStatus(
        percentage
      )

  };


}
private async getTopCosts(
  where: Prisma.UsageLogWhereInput
){

  const costs =
    await prisma.usageLog.groupBy({

      by:[
        "agent"
      ],

      where,

      _sum:{
        estimatedCost:true
      },

      _count:{
        id:true
      }

    });



  const total =
    costs.reduce(
      (
        acc,
        item
      ) =>
        acc +
        (
          item._sum.estimatedCost ?? 0
        ),
      0
    );




  return costs

    .filter(
      item =>
        item.agent
    )

    .map(
      item => {


        const cost =
          item._sum.estimatedCost ?? 0;



        let percentage = 0;


        if(total > 0){

          percentage =
            (
              cost /
              total
            )
            *
            100;

        }



        return {

          name:
            item.agent,


          type:
            "agent",


          requests:
            item._count.id,


          cost:
            Number(
                  cost.toFixed(4)

            ),


          percentage:
            Number(
              percentage.toFixed(2)
            )

        };


      }

    )

    .sort(
      (a,b)=>
        b.cost - a.cost
    )

    .slice(
      0,
      5
    );


}

private async getInsights(
  where: Prisma.UsageLogWhereInput,
  trends:any,
  topCosts:any[]
){

  const insights:any[] = [];
  const totalRequests =
  trends.requests.current;


const errorRate =
  totalRequests > 0
    ?
    (
      trends.errors.current /
      totalRequests
    )
    * 100
    :
    0;



if(errorRate > 5){

  insights.push({

    type:"warning",

    title:
      "Taxa de erro elevada",

    message:
      `${errorRate.toFixed(2)}% das requisições apresentaram falha.`

  });

}



  /*
    Insight de custo
  */

  if(topCosts.length > 0){

    const biggest =
      topCosts[0];


    if(biggest.percentage >= 40){

      insights.push({

        type:"warning",

        title:
          "Alta concentração de custo",

        message:
          `O agente ${biggest.name} representa ${biggest.percentage}% dos custos totais.`

      });

    }

  }





  /*
    Insight de erro
  */


  if(
    trends.errors.variation > 20
  ){

    insights.push({

      type:"warning",

      title:
        "Aumento de erros",

      message:
        `A taxa de erros aumentou ${trends.errors.variation}% comparado ao período anterior.`

    });

  }





  /*
    Insight de performance
  */


  if(
    trends.latency.variation < -10
  ){

    insights.push({

      type:"success",

      title:
        "Melhoria de performance",

      message:
        `A latência média reduziu ${Math.abs(trends.latency.variation)}%.`

    });

  }



  /*
    Insight de custo reduzido
  */


  if(
    trends.cost.variation < -10
  ){

    insights.push({

      type:"success",

      title:
        "Redução de custos",

      message:
        `O custo caiu ${Math.abs(trends.cost.variation)}% em relação ao período anterior.`

    });

  }





  /*
    Sem alertas
  */


  if(
    insights.length === 0
  ){

    insights.push({

      type:"success",

      title:
        "Ambiente saudável",

      message:
        "Nenhum ponto crítico identificado no período."

    });

  }




  return insights;

}

private async getProviderDistribution(
  where: Prisma.UsageLogWhereInput
){

  const providers =
    await prisma.usageLog.groupBy({

      by:[
        "provider"
      ],

      where,

      _count:{
        id:true
      },

      _sum:{
        estimatedCost:true,
        totalTokens:true
      }

    });



  const totalCost =
    providers.reduce(
      (
        acc,
        item
      ) =>
        acc +
        (
          item._sum.estimatedCost ?? 0
        ),
      0
    );



  return providers

    .map(
      provider => {


        const cost =
          provider._sum.estimatedCost ?? 0;



        let percentage = 0;



        if(totalCost > 0){

          percentage =
            (
              cost /
              totalCost
            )
            *
            100;

        }



        return {


          provider:
            provider.provider,


          requests:
            provider._count.id,


          tokens:
            provider._sum.totalTokens ?? 0,


          cost:
            Number(
                  cost.toFixed(4)

            ),



          percentage:
            Number(
              percentage.toFixed(2)
            )


        };


      }

    )

    .sort(
      (a,b)=>
        b.cost - a.cost
    );


}
}



export default new HomeService();