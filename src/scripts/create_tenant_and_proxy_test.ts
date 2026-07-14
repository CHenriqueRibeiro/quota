import 'dotenv/config';
import { PrismaClient, ProviderName } from '@prisma/client';
import crypto from 'crypto';
import { fetch } from 'bun';

const prisma = new PrismaClient();

async function run() {
  try {

    const tenantSlug = `test-tenant-${Date.now()}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantSlug,
        slug: tenantSlug,
        plan: 'STARTER',
      },
    });


    const credential = await prisma.providerCredential.create({
      data:{
        tenantId: tenant.id,
        provider: ProviderName.openai,
        apiKey:'fake-test-key',
        baseUrl:'https://api.openai.com',
        isActive:true
      }
    });


    const apiKey = `quota_test_${crypto.randomBytes(8).toString('hex')}`;


    await prisma.apiKey.create({
      data: {

        key: apiKey,

        name: 'test-key',

        tenantId: tenant.id,

        provider: ProviderName.openai,

        providerCredentialId: credential.id

      },
    });


    const res = await fetch('http://127.0.0.1:3000/proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'x-billing-group': 'test-group'
      },
      body: JSON.stringify({

        provider:'openai',

        model:'gpt-test',

        promptTokens:7,

        completionTokens:3,

        message:'hello from test script'

      }),
    });


    const text = await res.text();


  } catch(err){

    console.error(err);

  } finally {

    await prisma.$disconnect();

  }
}

run();