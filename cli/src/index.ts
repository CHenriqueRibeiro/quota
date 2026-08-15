#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { watchCommand } from './commands/watch.js';
import { statusCommand } from './commands/status.js';
import { stopCommand } from './commands/stop.js';
import { docsCommand } from './commands/docs.js';

const program = new Command();

program
  .name('quota')
  .description('CLI oficial do Quota para monitoramento transparente de consumo de IA')
  .version('0.1.3');

program
  .command('login [key]')
  .description('Autentica a CLI salvando a QUOTA_USER_KEY')
  .option('-k, --key <key>', 'Sua QUOTA_USER_KEY de acesso de longa duração')
  .option('-u, --url <url>', 'URL base da API do Quota')
  .option('-o, --open', 'Abre o navegador na página de chaves CLI')
  .action((keyArg, options) => {
    return loginCommand({ key: keyArg || options.key, ...options });
  });

program
  .command('watch')
  .description('Inicia o monitoramento transparente de logs do Claude, Codex e Gemini')
  .option('--daemon-worker', 'Flag interna para execução em segundo plano', false)
  .action(async (options) => {
    await watchCommand(options);
  });

program
  .command('status')
  .description('Exibe o status da conexão, chaves e do watcher em background')
  .action(async () => {
    await statusCommand();
  });

program
  .command('stop')
  .description('Para a execução do Quota Watcher em segundo plano')
  .action(() => {
    stopCommand();
  });

program
  .command('docs')
  .description('Abre ou exibe a documentação oficial da CLI do Quota')
  .option('-o, --open', 'Abre a documentação diretamente no navegador')
  .action(async (options) => {
    await docsCommand(options);
  });

program.parse(process.argv);
