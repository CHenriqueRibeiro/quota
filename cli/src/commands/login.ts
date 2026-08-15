import readline from 'node:readline';
import open from 'open';
import { saveCredentials } from '../utils/auth.js';
import { pingCliServer } from '../utils/telemetry.js';
import { DEFAULT_API_URL, DEFAULT_APP_URL } from '../utils/config.js';

export async function loginCommand(options: { key?: string; url?: string; appUrl?: string; open?: boolean }) {
  console.log('\n🔑 QUOTA CLI - Autenticação de Desenvolvedor\n');

  const apiUrl = options.url || DEFAULT_API_URL;
  const appUrl = options.appUrl || DEFAULT_APP_URL;
  let key = options.key?.trim();

  if (options.open) {
    console.log(`🌐 Abrindo navegador em: ${appUrl}/cli-keys ...`);
    await open(`${appUrl}/cli-keys`).catch(() => {});
  }

  if (!key) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    key = await new Promise<string>((resolve) => {
      rl.question('Cole a sua QUOTA_USER_KEY: ', (ans) => {
        resolve(ans.trim());
      });
    });
    rl.close();

    if (key.toLowerCase() === 'open') {
      console.log(`\n🌐 Abrindo navegador em ${appUrl}/cli-keys para você obter sua chave...`);
      await open(`${appUrl}/cli-keys`).catch(() => {});
      key = '';
    }
  }

  if (!key) {
    console.error('❌ Nenhuma chave informada. Operação cancelada.');
    process.exit(1);
  }

  // Salva temporariamente para testar o ping
  saveCredentials(key, apiUrl);

  console.log('\n🔄 Validando chave no servidor Quota...');
  const ping = await pingCliServer();

  if (!ping.success) {
    console.error(`\n❌ Falha na validação: ${ping.error}`);
    console.error('Verifique se a chave de acesso está correta e ativa no seu painel.');
    process.exit(1);
  }

  const user = ping.data?.user;
  const meta = ping.data?.cliKeyMeta;

  console.log('\n✅ Autenticação realizada com sucesso!\n');
  if (user) {
    console.log(`   👤 Usuário:  ${user.name} (${user.email})`);
    console.log(`   🏢 Tenant:   ${user.tenantId}`);
  }
  if (meta) {
    if (meta.project) console.log(`   📁 Projeto:  ${meta.project}`);
    if (meta.agent) console.log(`   🤖 Agente:   ${meta.agent}`);
    if (meta.billingGroup) console.log(`   👥 Equipe:   ${meta.billingGroup}`);
  }

  console.log('\n🚀 Próximo passo: execute "quota watch" para iniciar o monitoramento em segundo plano.\n');
}
