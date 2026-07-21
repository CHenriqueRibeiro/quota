import "dotenv/config";
import { triggerAlert } from "../service/alert.service";


await triggerAlert({

  alertConfigId: "79afe435-7b08-41d1-80ba-b01d551f61f5",

  title:
    "Limite de consumo atingido",

  message:
    "O tenant Empresa Teste atingiu 90% do limite mensal de tokens.",

});
