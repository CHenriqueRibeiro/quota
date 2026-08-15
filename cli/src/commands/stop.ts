import { isDaemonRunning, stopDaemon, loadPid } from '../utils/daemon.js';

export function stopCommand() {
  console.log('\n🛑 QUOTA CLI - Parando Watcher...\n');

  if (!isDaemonRunning()) {
    console.log('ℹ️ O Quota Watcher não está em execução.');
    return;
  }

  const pid = loadPid();
  const stopped = stopDaemon();

  if (stopped) {
    console.log(`✅ Quota Watcher (PID: ${pid}) parado com sucesso.\n`);
  } else {
    console.log('⚠️ Não foi possível encerrar o processo diretamente.\n');
  }
}
