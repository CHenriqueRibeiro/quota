import "dotenv/config";
import { prisma } from "../lib/prisma";

const alerts = await prisma.alertConfig.findMany();
