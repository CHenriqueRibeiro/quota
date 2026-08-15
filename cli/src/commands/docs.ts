import open from 'open';
import { DEFAULT_APP_URL } from '../utils/config.js';

export async function docsCommand(options: { open?: boolean }) {
  console.log('\n📚 QUOTA CLI - Documentação\n');

  console.log('  📌 Comandos disponíveis:');
  console.log('     quota login [key]   - Autentica a CLI vinculando sua chave QUOTA_USER_KEY');
  console.log('     quota watch          - Inicia o monitoramento em segundo plano (background daemon)');
  console.log('     quota status         - Exibe o status da conexão e do daemon');
  console.log('     quota stop           - Encerra o monitoramento em segundo plano');
  console.log('     quota docs           - Exibe esta ajuda e links para a documentação\n');

  console.log('  🌐 Assistentes suportados:');
  console.log('     - Claude Code (logs em ~/.claude/)');
  console.log('     - Codex (logs em ~/.codex/)');
  console.log('     - Gemini (logs em ~/.gemini/)\n');

  const docsUrl = 'https://github.com/CHenriqueRibeiro/quota/tree/main/cli#readme';
  console.log(`🔗 Documentação completa online: ${docsUrl}\n`);

  if (options.open) {
    console.log(`🌐 Abrindo documentação no navegador...`);
    await open(docsUrl).catch(() => {});
  }
}
