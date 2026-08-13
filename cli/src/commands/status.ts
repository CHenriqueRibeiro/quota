import { loadCredentials } from '../utils/auth.js';
import { pingCliServer } from '../utils/telemetry.js';
import { detectInstalledTools } from '../parsers/index.js';
import { isDaemonRunning, loadPid } from '../utils/daemon.js';

export async function statusCommand() {
  console.log('\n📊 QUOTA CLI - Status da Conexão & Ferramentas\n');

  const creds = loadCredentials();

  if (!creds || !creds.user_key) {
    console.log('❌ Estado: NÃO AUTENTICADO');
    console.log('   Por favor, execute "quota login" para autenticar esta máquina.\n');
    return;
  }

  const maskedKey = `${creds.user_key.slice(0, 9)}...${creds.user_key.slice(-4)}`;
  console.log(`🔑 Chave Salva:    ${maskedKey}`);
  console.log(`🌐 Servidor API:   ${creds.api_url}`);
  console.log(`🕒 Atualizado em:   ${new Date(creds.updated_at).toLocaleString('pt-BR')}`);

  console.log('\n📡 Testando conexão com o servidor...');
  const ping = await pingCliServer();

  if (ping.success) {
    const user = ping.data?.user;
    const meta = ping.data?.cliKeyMeta;
    console.log('✅ Servidor:       CONECTADO');
    if (user) console.log(`👤 Usuário:        ${user.name} (${user.email})`);
    if (meta) {
      if (meta.project) console.log(`📁 Projeto:        ${meta.project}`);
      if (meta.agent) console.log(`🤖 Agente:         ${meta.agent}`);
      if (meta.billingGroup) console.log(`👥 Equipe:         ${meta.billingGroup}`);
    }
  } else {
    console.log(`❌ Servidor:       FALHA DE CONEXÃO (${ping.error})`);
  }

  const running = isDaemonRunning();
  const pid = loadPid();

  console.log('\n👁️  Status do Watcher (Daemon):');
  if (running && pid) {
    console.log(`   ✅ Em execução (PID: ${pid})`);
  } else {
    console.log('   ⏹️  Parado. Execute "quota watch" para iniciar.');
  }

  const tools = detectInstalledTools();
  console.log('\n🔍 Ferramentas Detectadas no Sistema:');
  console.log(`   - Claude Code:  ${tools.claude.installed ? '🟢 Detectado' : '⚪ Não encontrado'}`);
  console.log(`   - Codex CLI:    ${tools.codex.installed ? '🟢 Detectado' : '⚪ Não encontrado'}`);
  console.log(`   - Gemini CLI:   ${tools.gemini.installed ? '🟢 Detectado' : '⚪ Não encontrado'}`);

  console.log('\n');
}
