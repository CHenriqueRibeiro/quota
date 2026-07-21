import "dotenv/config";
import { prisma } from "../lib/prisma";

const tenant = await prisma.tenant.findFirst();

if (!tenant) {
  throw new Error("Nenhum tenant encontrado");
}

const alert = await prisma.alertConfig.create({
  data: {
    tenantId: tenant.id,
    type: "COST",
    period: "MONTHLY",
    threshold: 10,
    email: "chmr66@gmail.com",
  },
});
