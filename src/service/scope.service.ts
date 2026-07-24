import {
  PrismaClient,
  ProviderName,
  ScopeMode,
  Prisma
} from "@prisma/client";

import type { AuthenticatedUser } from "../types/auth";


const prisma = new PrismaClient();



export type CreateScopeInput = {

  tenantId:string;

  name:string;

  description?:string;

  mode:ScopeMode;


  billingGroups?:string[];

  projects?:string[];

  agents?:string[];

  providers?:ProviderName[];

  models?:string[];

};





class ScopeService {



  /*
  |--------------------------------------------------------------------------
  | CRUD
  |--------------------------------------------------------------------------
  */


  async create(
    data:CreateScopeInput
  ){


    return prisma.scope.create({

      data:{

        tenantId:data.tenantId,

        name:data.name,

        description:data.description,

        mode:data.mode,


        billingGroups:
          data.billingGroups ?? [],


        projects:
          data.projects ?? [],


        agents:
          data.agents ?? [],


        providers:
          data.providers ?? [],


        models:
          data.models ?? []

      }

    });


  }







  async list(
    tenantId:string
  ){


    return prisma.scope.findMany({

      where:{
        tenantId
      },

      orderBy:{
        name:"asc"
      }

    });


  }







  async get(
  tenantId:string,
  id:string
){

  return prisma.scope.findFirst({

    where:{
      id,
      tenantId
    }

  });

}







  async update(
 tenantId:string,
 id:string,
 data:Partial<CreateScopeInput>
){


    const scope =
 await prisma.scope.findFirst({

  where:{
    id,
    tenantId
  }

});


if(!scope){

 throw new Error(
  "Scope não encontrado."
 );

}


return prisma.scope.update({

 where:{
  id
 },

 data

});


  }







  async delete(
 tenantId:string,
 id:string
){


    const scope =
 await prisma.scope.findFirst({

  where:{
    id,
    tenantId
  }

});


if(!scope){

 throw new Error(
  "Scope não encontrado."
 );

}



return prisma.scope.delete({

 where:{
  id

 }

});


  }









  /*
  |--------------------------------------------------------------------------
  | USER SCOPE
  |--------------------------------------------------------------------------
  */


  async assignUser(
  tenantId:string,
  userId:string,
  scopeId:string|null
){


  const user =
    await prisma.user.findFirst({

      where:{

        id:userId,

        tenantId

      },

      select:{
        id:true,
        tenantId:true
      }

    });



  if(!user){

    throw new Error(
      "Usuário não encontrado ou não pertence ao tenant."
    );

  }





  if(scopeId){


    await this.validateScope(

      tenantId,

      scopeId

    );


  }





  return prisma.user.update({

    where:{
      id:userId
    },

    data:{
      scopeId
    }

  });


}









  /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */


  async validateScope(
    tenantId:string,
    scopeId:string
  ){


    const scope =
      await prisma.scope.findFirst({

        where:{

          id:scopeId,

          tenantId

        }

      });



    if(!scope){

      throw new Error(
        "Scope inválido."
      );

    }



    return scope;


  }









  async getUserScope(
    user:AuthenticatedUser
  ){


    if(!user.scopeId){

      return null;

    }



    return prisma.scope.findFirst({

      where:{

        id:user.scopeId,

        tenantId:user.tenantId

      }

    });


  }









  /*
  |--------------------------------------------------------------------------
  | BUILD WHERE
  |--------------------------------------------------------------------------
  */


  async buildWhere(
    user:AuthenticatedUser,
    startDate:Date,
    endDate:Date
  ):Promise<Prisma.UsageLogWhereInput>{





    /*
      OWNER / MANAGER

      acesso total tenant
    */


    if(

      user.role === "OWNER" ||

      user.role === "MANAGER"

    ){


      return {


        tenantId:user.tenantId,


        createdAt:{

          gte:startDate,

          lte:endDate

        }


      };


    }








    /*
      Usuário precisa possuir Scope
    */


    const scope =

      await this.getUserScope(user);




    if(!scope){


      throw new Error(

        "Usuário não possui Scope."

      );


    }









    /*
      FULL

      acesso total tenant
    */


    if(

      scope.mode === ScopeMode.FULL

    ){


      return {


        tenantId:user.tenantId,


        createdAt:{

          gte:startDate,

          lte:endDate

        }


      };


    }









    /*
      CUSTOM

      aplica filtros
    */


    if(

      scope.mode === ScopeMode.CUSTOM &&

      !scope.billingGroups.length &&

      !scope.projects.length &&

      !scope.agents.length &&

      !scope.providers.length &&

      !scope.models.length

    ){

      throw new Error(

        "Scope CUSTOM sem regras configuradas."

      );


    }







    const where:Prisma.UsageLogWhereInput = {


      tenantId:user.tenantId,


      createdAt:{

        gte:startDate,

        lte:endDate

      }


    };








    if(scope.billingGroups.length){


      where.billingGroup = {


        name:{

          in:scope.billingGroups

        }


      };


    }








    if(scope.projects.length){


      where.project = {


        in:scope.projects


      };


    }








    if(scope.agents.length){


      where.agent = {


        in:scope.agents


      };


    }








    if(scope.providers.length){


      where.provider = {


        in:scope.providers


      };


    }








    if(scope.models.length){


      where.model = {


        in:scope.models


      };


    }







    return where;


  }


}





export default new ScopeService();