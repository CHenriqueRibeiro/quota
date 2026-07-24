import type { FastifyInstance } from 'fastify';

import { UserController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';


const userController = new UserController();


export async function userRoutes(
  server: FastifyInstance
) {


  server.post(
    '/users',
    { 
      preHandler: [
        authenticate
      ] 
    },
    userController.createUser
  );



  server.post(
    '/users/create-owner',
    { 
      preHandler: [
        authenticate,
        authorize('OWNER')
      ] 
    },
    userController.createOwner
  );



  server.put(
    '/users/:id/scope',
    {
      preHandler:[
        authenticate
      ],
    },
    userController.assignScope
  );


}