import {
  ProviderName,
  ScopeMode,
  Prisma
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPlanLimits } from "../config/plan-limits";

import type { AuthenticatedUser } from "../types/auth";



export type CreateScopeInput = {

  tenantId: string;

  name: string;

  description?: string;

  mode: ScopeMode;


  billingGroups?: string[];

  projects?: string[];

  agents?: string[];

  providers?: ProviderName[];

  models?: string[];

};





const VALID_PROVIDERS: ProviderName[] = ["openai", "anthropic", "google", "groq", "mistral"];

function normalizeProviders(providers?: any[]): ProviderName[] {
  if (!Array.isArray(providers)) return [];
  return providers
    .map((p) => String(p).toLowerCase().trim())
    .filter((p): p is ProviderName => VALID_PROVIDERS.includes(p as ProviderName));
}

class ScopeService {



  /*
  |--------------------------------------------------------------------------
  | CRUD
  |--------------------------------------------------------------------------
  */


  async create(
    data: CreateScopeInput
  ) {


    return prisma.scope.create({

      data: {

        tenantId: data.tenantId,

        name: data.name,

        description: data.description,

        mode: data.mode,


        billingGroups:
          data.billingGroups ?? [],


        projects:
          data.projects ?? [],


        agents:
          data.agents ?? [],


        providers:
          normalizeProviders(data.providers),


        models:
          data.models ?? []

      }

    });


  }







  async list(
    tenantId: string
  ) {


    return prisma.scope.findMany({

      where: {
        tenantId
      },

      orderBy: {
        name: "asc"
      }

    });


  }







  async get(
    tenantId: string,
    id: string
  ) {

    return prisma.scope.findFirst({

      where: {
        id,
        tenantId
      }

    });

  }







  async update(
    tenantId: string,
    id: string,
    data: Partial<CreateScopeInput>
  ) {


    const scope =
      await prisma.scope.findFirst({

        where: {
          id,
          tenantId
        }

      });


    if (!scope) {

      throw new Error(
        "Scope não encontrado."
      );

    }


    const dataToUpdate: any = { ...data };
    if (data.providers !== undefined) {
      dataToUpdate.providers = normalizeProviders(data.providers);
    }

    return prisma.scope.update({

      where: {
        id
      },

      data: dataToUpdate

    });


  }







  async delete(
    tenantId: string,
    id: string
  ) {


    const scope =
      await prisma.scope.findFirst({

        where: {
          id,
          tenantId
        }

      });


    if (!scope) {

      throw new Error(
        "Scope não encontrado."
      );

    }



    return prisma.scope.delete({

      where: {
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
    actorUser: AuthenticatedUser,
    userId: string,
    scopeId: string | null
  ) {
    if (!userId) {
      throw new Error("userId é obrigatório.");
    }

    const targetTenantId = actorUser.tenantId;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        ...(actorUser.role !== "ADMIN" ? { tenantId: targetTenantId } : {})
      },
      select: {
        id: true,
        tenantId: true
      }
    });

    if (!user) {
      throw new Error("Usuário não encontrado ou não pertence ao tenant.");
    }

    if (scopeId) {
      const scope = await prisma.scope.findFirst({
        where: {
          id: scopeId,
          tenantId: user.tenantId
        }
      });

      if (!scope) {
        throw new Error("Scope não encontrado ou não pertence ao mesmo tenant do usuário.");
      }
    }

    return prisma.user.update({
      where: {
        id: userId
      },
      data: {
        scopeId: scopeId || null
      },
      include: {
        scope: true
      }
    });
  }









  /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */


  async validateScope(
    tenantId: string,
    scopeId: string
  ) {


    const scope =
      await prisma.scope.findFirst({

        where: {

          id: scopeId,

          tenantId

        }

      });



    if (!scope) {

      throw new Error(
        "Scope inválido."
      );

    }



    return scope;


  }









  async getUserScope(
    user: AuthenticatedUser
  ) {


    if (!user.scopeId) {

      return null;

    }



    return prisma.scope.findFirst({

      where: {

        id: user.scopeId,

        tenantId: user.tenantId

      }

    });


  }









  /*
  |--------------------------------------------------------------------------
  | BUILD WHERE
  |--------------------------------------------------------------------------
  */


  async buildWhere(
    user: AuthenticatedUser,
    startDate: Date,
    endDate: Date
  ): Promise<Prisma.UsageLogWhereInput> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { plan: true }
    });
    const limits = getPlanLimits(tenant?.plan);
    const minAllowedDate = new Date();
    minAllowedDate.setDate(minAllowedDate.getDate() - limits.retentionDays);

    const effectiveStartDate = startDate < minAllowedDate ? minAllowedDate : startDate;

    /*
      ADMIN / MANAGER

      acesso total tenant
    */


    if (

      user.role === "ADMIN" ||

      user.role === "MANAGER"

    ) {


      return {


        tenantId: user.tenantId,


        createdAt: {

          gte: effectiveStartDate,

          lte: endDate

        }


      };


    }


    /*
      Usuário precisa possuir Scope
    */


    const scope =

      await this.getUserScope(user);




    if (!scope) {
      return {
        tenantId: user.tenantId,
        createdAt: {
          gte: effectiveStartDate,
          lte: endDate
        }
      };
    }


    /*
      FULL

      acesso total tenant
    */


    if (

      scope.mode === ScopeMode.FULL

    ) {


      return {


        tenantId: user.tenantId,


        createdAt: {

          gte: effectiveStartDate,

          lte: endDate

        }


      };


    }


    /*
      CUSTOM

      aplica filtros
    */


    if (

      scope.mode === ScopeMode.CUSTOM &&

      !scope.billingGroups.length &&

      !scope.projects.length &&

      !scope.agents.length &&

      !scope.providers.length &&

      !scope.models.length

    ) {

      throw new Error(

        "Scope CUSTOM sem regras configuradas."

      );


    }


    const where: Prisma.UsageLogWhereInput = {


      tenantId: user.tenantId,


      createdAt: {

        gte: effectiveStartDate,

        lte: endDate

      }


    };









    if (scope.billingGroups.length) {


      where.billingGroup = {


        name: {

          in: scope.billingGroups

        }


      };


    }








    if (scope.projects.length) {


      where.project = {


        in: scope.projects


      };


    }








    if (scope.agents.length) {


      where.agent = {


        in: scope.agents


      };


    }








    if (scope.providers.length) {


      where.provider = {


        in: scope.providers


      };


    }








    if (scope.models.length) {


      where.model = {


        in: scope.models


      };


    }







    return where;


  }


}





export default new ScopeService();