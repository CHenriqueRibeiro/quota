import type { FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

import type {
  AuthenticatedRequest,
  UserRole
} from '../types/auth';



const prisma = new PrismaClient();

const DEFAULT_PASSWORD = '123456';



export class UserController {


  constructor() {

    this.createUser = this.createUser.bind(this);
    this.createOwner = this.createOwner.bind(this);
    this.assignScope = this.assignScope.bind(this);

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


    if(actorRole === 'OWNER') {
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
        tenantId

      } = request.body as {
        email:string;
        name?:string;
        role:UserRole;
        tenantId?:string;
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
        role === 'OWNER' &&
        actor.role !== 'OWNER'
      ){

        return reply.status(403).send({
          error:'Somente OWNER pode criar outro OWNER'
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

            role

          }

        });




      return reply.status(201).send({

        message:'Usuário criado com sucesso',

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




      if(actor.role !== 'OWNER'){

        return reply.status(403).send({
          error:'Somente OWNER pode criar outro OWNER'
        });

      }





      const {
        email,
        tenantId,
        name

      } = request.body as {
        email:string;
        tenantId:string;
        name?:string;
      };





      if(
        !email?.trim() ||
        !tenantId?.trim()
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
            id:tenantId
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

            tenantId,

            role:'OWNER'

          }

        });





      return reply.status(201).send({

        message:'Owner criado com sucesso',

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



}