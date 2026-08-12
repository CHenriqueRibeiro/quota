import type { FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import * as argon2 from 'argon2';
import { getPlanLimits } from '../config/plan-limits';
import auditService from '../service/audit.service';

import type {
  AuthenticatedRequest,
  UserRole
} from '../types/auth';




const DEFAULT_PASSWORD = '123456';



export class UserController {


  constructor() {

    this.createUser = this.createUser.bind(this);
    this.createOwner = this.createOwner.bind(this);
    this.assignScope = this.assignScope.bind(this);
    this.listUsers = this.listUsers.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.deleteUser = this.deleteUser.bind(this);

  }



  private async hashPassword(
    password:string
  ) {

    return argon2.hash(password);

  }



  private validateRoleCreation(
    actorRole:UserRole,
    targetRole:UserRole
  ) {


    if(actorRole === 'ADMIN') {
      return true;
    }


    if(actorRole === 'MANAGER') {

      return (
        targetRole === 'MANAGER' ||
        targetRole === 'ANALYST' ||
        targetRole === 'DEV'
      );

    }


    return false;

  }







  async createUser(
    request:AuthenticatedRequest,
    reply:FastifyReply
  ) {


    try {


      const actor = request.user;


      if(!actor){

        return reply.status(401).send({
          error:'Unauthorized'
        });

      }



      const {
        email,
        name,
        role,
        tenantId,
        scopeId
      } = request.body as {
        email:string;
        name?:string;
        role:UserRole;
        tenantId?:string;
        scopeId?:string;
      };




      if(!email?.trim()){

        return reply.status(400).send({
          error:'email é obrigatório'
        });

      }




      if(!this.validateRoleCreation(
        actor.role,
        role
      )){

        return reply.status(403).send({
          error:'Você não pode criar este tipo de usuário'
        });

      }




      if(
        role === 'ADMIN' &&
        actor.role !== 'ADMIN'
      ){

        return reply.status(403).send({
          error:'Somente ADMIN pode criar outro ADMIN'
        });

      }




      const normalizedEmail =
        email.trim().toLowerCase();




      const existingUser =
        await prisma.user.findUnique({
          where:{
            email:normalizedEmail
          }
        });




      if(existingUser){

        return reply.status(409).send({
          error:'Já existe um usuário com este e-mail'
        });

      }




      const resolvedTenantId =
        tenantId?.trim() ||
        actor.tenantId;




      if(!resolvedTenantId){

        return reply.status(400).send({
          error:'tenantId é obrigatório'
        });

      }




      const tenant =
        await prisma.tenant.findUnique({
          where:{
            id:resolvedTenantId
          }
        });




      if(!tenant){

        return reply.status(404).send({
          error:'Ambiente não encontrado'
        });

      }

      const currentUserCount = await prisma.user.count({ where: { tenantId: resolvedTenantId } });
      const limits = getPlanLimits(tenant.plan);
      if (currentUserCount >= limits.maxUsers) {
        return reply.status(403).send({
          error: `Limite de ${limits.maxUsers} usuários atingido para o plano ${tenant.plan}. Faça upgrade para adicionar mais usuários.`
        });
      }





      const passwordHash =
        await this.hashPassword(
          DEFAULT_PASSWORD
        );





      const user =
        await prisma.user.create({
          data:{
            email:normalizedEmail,
            name:
              name?.trim() ||
              normalizedEmail,
            passwordHash,
            tenantId:
              resolvedTenantId,
            role,
            scopeId: scopeId?.trim() || null
          }
        });

      await auditService.logEvent({
        tenantId: resolvedTenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'USERS_SETTINGS',
        action: 'USER_CREATE',
        actionTitle: `Usuário ${user.name} Criado`,
        details: `Novo usuário ${user.email} (Perfil: ${user.role}) adicionado à organização`,
        metadata: { createdUserId: user.id, email: user.email, role: user.role }
      });

      return reply.status(201).send({
        message:'Usuário criado com sucesso',
        user:{
          id:user.id,
          email:user.email,
          tenantId:user.tenantId,
          role:user.role,
          scopeId:user.scopeId
        },

        defaultPassword:DEFAULT_PASSWORD

      });




    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:'Erro ao criar usuário'
      });

    }


  }









  async createOwner(
    request:AuthenticatedRequest,
    reply:FastifyReply
  ) {


    try {


      const actor=request.user;


      if(!actor){

        return reply.status(401).send({
          error:'Unauthorized'
        });

      }




      if(actor.role !== 'ADMIN'){

        return reply.status(403).send({
          error:'Somente ADMIN pode criar outro ADMIN'
        });

      }





      const {
        email,
        tenantId,
        name
      } = request.body as {
        email:string;
        tenantId?:string;
        name?:string;
      };

      const resolvedTenantId =
        tenantId?.trim() ||
        actor.tenantId;

      if(
        !email?.trim() ||
        !resolvedTenantId
      ){
        return reply.status(400).send({
          error:'email e tenantId são obrigatórios'
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const existingUser =
        await prisma.user.findUnique({
          where:{
            email:normalizedEmail
          }
        });

      if(existingUser){
        return reply.status(409).send({
          error:'Já existe um usuário com este e-mail'
        });
      }

      const tenant =
        await prisma.tenant.findUnique({
          where:{
            id:resolvedTenantId
          }
        });




      if(!tenant){

        return reply.status(404).send({
          error:'Ambiente não encontrado'
        });

      }





      const passwordHash =
        await this.hashPassword(
          DEFAULT_PASSWORD
        );





      const user =
        await prisma.user.create({

          data:{

            email:normalizedEmail,

            name:
              name?.trim() ||
              normalizedEmail,

            passwordHash,

            tenantId: resolvedTenantId,

            role:'ADMIN'

          }

        });





      return reply.status(201).send({

        message:'Admin criado com sucesso',

        user:{

          id:user.id,

          email:user.email,

          tenantId:user.tenantId,

          role:user.role

        },

        defaultPassword:DEFAULT_PASSWORD

      });




    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:'Erro ao criar owner'
      });

    }


  }









  async assignScope(
    request:AuthenticatedRequest,
    reply:FastifyReply
  ){

    try{


      const {
        id

      } = request.params as {
        id:string;
      };




      const {
        scopeId

      } = request.body as {
        scopeId:string | null;
      };





      const user =
        await prisma.user.findUnique({

          where:{
            id
          }

        });





      if(!user){

        return reply.status(404).send({
          error:'Usuário não encontrado'
        });

      }





      const updatedUser =
        await prisma.user.update({

          where:{
            id
          },


          data:{
            scopeId
          },


          include:{
            scope:true
          }

        });





      return reply.send({

        message:'Scope vinculado com sucesso',

        user:updatedUser

      });





    }catch(error){

      request.log.error(error);


      return reply.status(400).send({
        error:'Erro ao vincular Scope ao usuário'
      });

    }

  }



  async listUsers(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;

      if (!actor) {
        return reply.status(401).send({
          error: 'Unauthorized'
        });
      }

      const { tenantId: paramTenantId } = (request.params as any) || {};
      const { tenantId: queryTenantId } = (request.query as any) || {};

      const targetTenantId = paramTenantId?.trim() || queryTenantId?.trim() || actor.tenantId;

      if (!targetTenantId) {
        return reply.status(400).send({
          error: 'tenantId é obrigatório'
        });
      }

      if (actor.role !== 'ADMIN' && targetTenantId !== actor.tenantId) {
        return reply.status(403).send({
          error: 'Você não tem permissão para visualizar usuários deste tenant'
        });
      }

      const users = await prisma.user.findMany({
        where: {
          tenantId: targetTenantId
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          scopeId: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              plan: true,
            },
          },
          scope: {
            select: {
              id: true,
              name: true,
              mode: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.status(200).send(users);
    } catch (error) {
      request.log.error(error);

      return reply.status(400).send({
        error: 'Erro ao listar usuários'
      });
    }
  }

  async updateUser(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const { email, name, role, scopeId, password } = request.body as {
        email?: string;
        name?: string;
        role?: UserRole;
        scopeId?: string | null;
        password?: string;
      };

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      if (actor.role !== 'ADMIN' && existingUser.tenantId !== actor.tenantId) {
        return reply.status(403).send({ error: 'Você não tem permissão para editar usuários deste tenant' });
      }

      if (role && role !== existingUser.role) {
        if (!this.validateRoleCreation(actor.role, role)) {
          return reply.status(403).send({ error: 'Você não tem permissão para atribuir este papel' });
        }
      }

      let normalizedEmail = existingUser.email;
      if (email && email.trim() && email.trim().toLowerCase() !== existingUser.email) {
        normalizedEmail = email.trim().toLowerCase();
        const emailCheck = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (emailCheck) {
          return reply.status(409).send({ error: 'Já existe um usuário com este e-mail' });
        }
      }

      const updateData: any = {
        name: name !== undefined ? name.trim() : existingUser.name,
        email: normalizedEmail,
      };

      if (role) {
        updateData.role = role;
      }

      if (scopeId !== undefined) {
        updateData.scopeId = scopeId && scopeId !== 'none' ? scopeId.trim() : null;
      }

      if (password && password.trim()) {
        updateData.passwordHash = await this.hashPassword(password.trim());
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          scopeId: true,
          createdAt: true,
          scope: {
            select: {
              id: true,
              name: true,
              mode: true,
            },
          },
        },
      });

      await auditService.logEvent({
        tenantId: existingUser.tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'USERS_SETTINGS',
        action: 'USER_UPDATE',
        actionTitle: `Usuário ${updatedUser.name} Atualizado`,
        details: `Perfil do usuário ${updatedUser.email} (Perfil: ${updatedUser.role}) atualizado`,
        metadata: { updatedUserId: updatedUser.id, email: updatedUser.email, role: updatedUser.role }
      });

      return reply.status(200).send({
        message: 'Usuário atualizado com sucesso',
        user: updatedUser,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: 'Erro ao atualizar usuário' });
    }
  }

  async deleteUser(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      if (actor.id === id) {
        return reply.status(400).send({ error: 'Você não pode excluir sua própria conta' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      if (actor.role !== 'ADMIN' && existingUser.tenantId !== actor.tenantId) {
        return reply.status(403).send({ error: 'Você não tem permissão para excluir usuários deste tenant' });
      }

      await prisma.user.delete({
        where: { id },
      });

      await auditService.logEvent({
        tenantId: existingUser.tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'USERS_SETTINGS',
        action: 'USER_DELETE',
        actionTitle: `Usuário ${existingUser.name} Removido`,
        details: `Usuário ${existingUser.email} (Perfil: ${existingUser.role}) removido da organização`,
        metadata: { deletedUserId: existingUser.id, email: existingUser.email }
      });

      return reply.status(200).send({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: 'Erro ao excluir usuário' });
    }
  }
}