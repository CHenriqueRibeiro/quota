import type { FastifyReply } from "fastify";
import { ScopeMode, ProviderName, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";





interface ScopeParams {
  id: string;
}


interface CreateScopeBody {
  name: string;
  description?: string;
  mode: ScopeMode;
  billingGroups?: string[];
  projects?: string[];
  agents?: string[];
  providers?: ProviderName[];
  models?: string[];
}


interface AssignUserBody {
  userId: string;
  scopeId: string | null;
}



class ScopeController {


  async create(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {

  try {
console.log("USER:", request.user);

   console.log("BODY:", request.body);
    const actor = request.user;

    if (!actor) {
      return reply.status(401).send({
        error: "Unauthorized"
      });
    }

    if (
      actor.role !== "ADMIN" &&
      actor.role !== "MANAGER"
    ) {
      return reply.status(403).send({
        error: "Sem permissão."
      });
    }

    const tenantId = actor.tenantId;

    const body = request.body as CreateScopeBody;
    const {
      name,
      description,
      billingGroups,
      projects,
      agents,
      providers,
      models
    } = body;

    const rawMode = body.mode as any;
    const mode: ScopeMode = (rawMode === "ALL" ? "FULL" : rawMode) as ScopeMode;

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantId
      }
    });

    if (!tenant) {
      return reply.status(404).send({
        error: "Tenant não encontrado."
      });
    }

    const scope = await ScopeService.create({
      tenantId,
      name,
      description,
      mode: mode || "FULL",
      billingGroups,
      projects,
      agents,
      providers,
      models
    });

    return reply.status(201).send(scope);

  } catch(error) {

  request.log.error(error);


  if(
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ){

    return reply.status(409).send({

      error:
        "Já existe um Scope com esse nome."

    });

  }


  return reply.status(400).send({

    error:
      "Erro ao criar Scope."

  });

  }

}







  async list(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const scopes = await ScopeService.list(tenantId);
      return reply.send(scopes);
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({
        error: "Erro ao listar Scopes.",
      });
    }
  }







  async get(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{


      const {
        id,

      } = request.params as ScopeParams;



      const actor = request.user;


if(!actor){

 return reply.status(401).send({
  error:"Unauthorized"
 });

}


const scope =
 await ScopeService.get(
   actor.tenantId,
   id
 );



      if(!scope){

        return reply.status(404).send({
          error:"Scope não encontrado.",
        });

      }



      return reply.send(scope);



    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:"Erro ao buscar Scope.",
      });

    }

  }








  async update(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{


      const {
        id,

      } = request.params as ScopeParams;



      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as any;
      if (body?.mode === "ALL") {
        body.mode = "FULL";
      }

      const scope = await ScopeService.update(
        actor.tenantId,
        id,
        body
      );



      return reply.send(scope);



    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:"Erro ao atualizar Scope.",
      });

    }

  }








  async delete(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ){

    try{


      const {
        id,

      } = request.params as ScopeParams;


const actor = request.user;


if(!actor){

 return reply.status(401).send({
  error:"Unauthorized"
 });

}
     await ScopeService.delete(
 actor.tenantId,
 id
);



      return reply.send({
        success:true,
      });



    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:"Erro ao remover Scope.",
      });

    }

  }









  async assignUser(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;

      if (!actor) {
        return reply.status(401).send({
          error: "Unauthorized"
        });
      }

      if (
        actor.role !== "ADMIN" &&
        actor.role !== "MANAGER"
      ) {
        return reply.status(403).send({
          error: "Sem permissão."
        });
      }

      const {
        userId,
        scopeId,
      } = request.body as AssignUserBody;

      const user = await ScopeService.assignUser(
        actor,
        userId,
        scopeId
      );

      return reply.send(user);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Erro ao vincular Scope.",
      });
    }
  }


}



export default ScopeController;