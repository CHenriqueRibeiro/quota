import { test, expect } from "bun:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


test("deve executar retry do FailedUsage pela rota", async () => {

  const tenant = await prisma.tenant.create({
    data:{
      name:`retry-test-${Date.now()}`,
      slug:`retry-test-${Date.now()}`,
      plan:"STARTER"
    }
  });


  const failed = await prisma.failedUsage.create({
    data:{
      tenantId: tenant.id,

      requestId: crypto.randomUUID(),

      traceId:"trace-retry-test",

      payload:{
        tenantId: tenant.id,
        requestId:"retry-request",
        provider:"INVALID_PROVIDER",
        model:"teste",
        totalTokens:10
      },

      error:"Teste de falha",

      status:"PENDING"
    }
  });



  console.log("ANTES DO RETRY");

  console.dir(failed,{
    depth:null
  });



  const response = await fetch(
  `http://localhost:3000/failed-usage/${failed.id}/retry`,
  {
    method:"POST",
    headers:{
      "content-type":"application/json"
    },
    body: JSON.stringify({})
  }
);


  const body = await response.json();


  console.log("RESPOSTA RETRY");

  console.log(body);



  await Bun.sleep(1000);



  const updated =
    await prisma.failedUsage.findUnique({
      where:{
        id:failed.id
      }
    });



  console.log("DEPOIS DO RETRY");

  console.dir(updated,{
    depth:null
  });



  expect(updated).not.toBeNull();


  expect(updated?.status)
    .toBe("PROCESSING");


  expect(updated?.attempts)
    .toBe(1);


  expect(updated?.lastAttemptAt)
    .not.toBeNull();



  await prisma.$disconnect();

});