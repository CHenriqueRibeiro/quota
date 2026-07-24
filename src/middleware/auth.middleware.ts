import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '../types/auth';

const prisma = new PrismaClient();


const roleHierarchy: Record<UserRole, number> = {
  OWNER: 4,
  MANAGER: 3,
  ANALYST: 2,
  DEV: 1
};


const isValidRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' && value in roleHierarchy;
};


export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {

  try {

    const systemSecret = process.env.SYSTEM_OWNER_SECRET;
    const systemSecretHeader = request.headers['x-system-secret'];


    if (
      typeof systemSecretHeader === 'string' &&
      systemSecret &&
      systemSecretHeader === systemSecret
    ) {

      request.user = {
        id: 'system-owner',
        role: 'OWNER'
      } as any;

      return;
    }



    const authHeader = request.headers.authorization;


    if (
      !authHeader ||
      typeof authHeader !== 'string'
    ) {

      return reply.status(401).send({
        error:'Token missing'
      });

    }



    const [
      scheme,
      token
    ] = authHeader.split(' ');



    if (
      scheme !== 'Bearer' ||
      !token
    ) {

      return reply.status(401).send({
        error:'Invalid authorization header'
      });

    }



    const secret = process.env.JWT_SECRET;


    if(!secret){

      return reply.status(500).send({
        error:'JWT secret not configured'
      });

    }



    const decoded = jwt.verify(
      token,
      secret
    ) as {
      id?: unknown;
    };



    if(
      typeof decoded.id !== 'string'
    ){

      return reply.status(401).send({
        error:'Invalid token payload'
      });

    }



    const user = await prisma.user.findUnique({

      where:{
        id: decoded.id
      },

      select:{
        id:true,
        role:true,
        tenantId:true,
        scopeId:true
      }

    });



    if(!user){

      return reply.status(401).send({
        error:'User not found'
      });

    }



    request.user = {

      id:user.id,

      role:user.role,

      tenantId:user.tenantId,

      scopeId:user.scopeId ?? undefined

    };


  } catch(error){

    request.log.error(error);

    return reply.status(401).send({
      error:'Invalid token'
    });

  }

};



export const authorize = (
  requiredRole: UserRole
) => {

  return async (
    request:FastifyRequest,
    reply:FastifyReply
  )=>{


    const user = request.user;


    const userLevel =
      user?.role
        ? roleHierarchy[user.role]
        : undefined;



    const requiredLevel =
      roleHierarchy[requiredRole];



    if(
      userLevel === undefined ||
      userLevel < requiredLevel
    ){

      return reply.status(403).send({

        error:
        'Access denied: insufficient permission'

      });

    }

  };

};