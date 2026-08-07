import { Quota } from '../src/index';

/**
 * Exemplo prático do SDK Quota em TypeScript / JavaScript
 */
async function runExample() {
  console.log('=== Teste do SDK Quota (@quota/sdk) ===\n');

  // 1. Inicializa o SDK com as configurações globais
  Quota.init({
    apiKey: 'qta_live_test_123456', // Substiua pela sua API Key do Quota
    endpoint: 'http://localhost:3000/collector',
    project: 'projeto-suporte',
    agent: 'bot-financeiro',
    environment: 'development',
    debug: true
  });

  console.log('--- Teste 1: Envio Manual de Métricas (Quota.trackUsage) ---');
  await Quota.trackUsage({
    provider: 'openai',
    model: 'gpt-4o',
    promptTokens: 150,
    completionTokens: 45,
    totalTokens: 195,
    latencyMs: 320,
    statusCode: 200,
    metadata: {
      externalUserId: 'user_991823',
      requestGroup: 'fluxo-cobranca',
      tags: ['manual-tracking', 'teste']
    }
  });

  console.log('\n--- Teste 2: Interceptação Automática via Cabeçalhos Customizados ---');
  
  // Simulando como o SDK intercepta uma chamada de requisição de IA (ex: OpenAI)
  // Quando o usuário passar cabeçalhos x-quota-*, o escutador captura automaticamente!
  try {
    const fakeOpenAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-fake-key-para-teste',
        'x-quota-agent': 'atendimento-humano',
        'x-quota-user-id': 'cliente_4412',
        'x-quota-tags': 'sac,ouvidoria'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Qual o meu saldo?' }]
      })
    });

    console.log('Status da chamada simulada:', fakeOpenAIResponse.status);
  } catch (err) {
    // Como a chave da OpenAI era fake no teste, pode retornar erro HTTP normal da OpenAI
    console.log('Chamada concluída (interceptador executou em background).');
  }

  // Aguarda 1s para visualizar os logs assíncronos do microtask
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

runExample();
