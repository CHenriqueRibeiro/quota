import path from 'node:path';
import fs from 'node:fs';
import chokidar from 'chokidar';
import { loadCredentials } from '../utils/auth.js';
import { pingCliServer, sendCliTelemetry } from '../utils/telemetry.js';
import { detectInstalledTools, parseClaudeJsonl, parseCodexJsonl, parseGeminiChat } from '../parsers/index.js';
import { isDaemonRunning, spawnDaemon } from '../utils/daemon.js';

export async function watchCommand(options: { daemonWorker?: boolean; scriptPath?: string }) {
  const creds = loadCredentials();

  if (!creds || !creds.user_key) {
    console.error('❌ Não autenticado. Por favor, execute "quota login" primeiro.');
    process.exit(1);
  }

  // Se não for o worker de background, inicia o daemon desacoplado
  if (!options.daemonWorker) {
    if (isDaemonRunning()) {
      console.log('ℹ️ O Quota Watcher já está em execução em segundo plano.');
      process.exit(0);
    }

    const scriptPath = options.scriptPath || path.join(import.meta.dirname || process.cwd(), 'index.js');
    const pid = spawnDaemon(scriptPath);

    if (pid) {
      console.log(`\n👁️  Quota Watcher iniciado em segundo plano (PID: ${pid}).`);
      console.log('   Ele continuará capturando o consumo do Claude, Codex e Gemini de forma transparente.\n');
    } else {
      console.error('❌ Falha ao iniciar o watcher em segundo plano.');
    }
    process.exit(0);
  }

  // --- MODO DAEMON WORKER (Executa silenciosamente em background) ---
  const ping = await pingCliServer();
  if (!ping.success) {
    console.error('❌ Credenciais de CLI inválidas. Encerrando daemon.');
    process.exit(1);
  }

  const installed = detectInstalledTools();
  const offsetsMap = new Map<string, number>();
  const sentRequests = new Set<string>();

  const watchPaths: string[] = [];

  if (installed.claude.installed) {
    watchPaths.push(path.join(installed.claude.path, '**', '*.jsonl'));
  }

  if (installed.codex.installed) {
    watchPaths.push(path.join(installed.codex.path, '**', '*.jsonl'));
  }

  if (installed.gemini.installed) {
    watchPaths.push(path.join(installed.gemini.path, '**', '*.json'));
    watchPaths.push(path.join(installed.gemini.path, '**', '*.jsonl'));
  }

  if (watchPaths.length === 0) {
    console.log('⚠️ Nenhuma ferramenta (Claude, Codex, Gemini) detectada localmente. Monitorando mesmo assim...');
    // Monitora as pastas raiz caso venham a ser criadas
    const toolPaths = detectInstalledTools();
    watchPaths.push(toolPaths.claude.path, toolPaths.codex.path, toolPaths.gemini.path);
  }

  const watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  async function processFileChange(filePath: string) {
    const currentOffset = offsetsMap.get(filePath) || 0;

    let result: { payloads: any[]; newOffset: number } = { payloads: [], newOffset: currentOffset };

    if (filePath.includes('.claude')) {
      result = parseClaudeJsonl(filePath, currentOffset);
    } else if (filePath.includes('.codex')) {
      result = parseCodexJsonl(filePath, currentOffset);
    } else if (filePath.includes('.gemini')) {
      result = parseGeminiChat(filePath, currentOffset);
    }

    offsetsMap.set(filePath, result.newOffset);

    for (const payload of result.payloads) {
      if (payload.request_id && sentRequests.has(payload.request_id)) {
        continue;
      }
      if (payload.request_id) {
        sentRequests.add(payload.request_id);
      }

      await sendCliTelemetry(payload);
    }
  }

  watcher.on('add', (filePath) => void processFileChange(filePath));
  watcher.on('change', (filePath) => void processFileChange(filePath));

  process.on('SIGTERM', () => {
    watcher.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    watcher.close();
    process.exit(0);
  });
}
