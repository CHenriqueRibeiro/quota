import { FailedUsageController } from "../controllers/failedUsage.controller";

const controller = new FailedUsageController();


export async function failedUsageRoutes(app:any){

  app.get(
    "/failed-usage",
    controller.list.bind(controller)
  );


  app.post(
    "/failed-usage/:id/retry",
    controller.retry.bind(controller)
  );


  app.post(
    "/failed-usage/tenant/:tenantId/retry",
    controller.retryTenant.bind(controller)
  );

}