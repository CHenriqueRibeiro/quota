import type { FastifyInstance } from "fastify";
import { HomeController } from "../controllers/home.controller";
import { authenticate } from "../middleware/auth.middleware";


const homeController =
  new HomeController();



export async function homeRoutes(
  server: FastifyInstance
){


  server.get(
    '/home',
    {
      preHandler:[
        authenticate
      ]
    },
    homeController.getHome.bind(homeController)
  );


}