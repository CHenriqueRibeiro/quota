import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { ensureQuotaDir } from './auth.js';
import { PID_PATH, LOG_PATH } from './config.js';

export function savePid(pid: number) {
  ensureQuotaDir();
  fs.writeFileSync(PID_PATH, pid.toString(), 'utf-8');
}

export function loadPid(): number | null {
  try {
    if (!fs.existsSync(PID_PATH)) return null;
    const raw = fs.readFileSync(PID_PATH, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function clearPid() {
  try {
    if (fs.existsSync(PID_PATH)) {
      fs.unlinkSync(PID_PATH);
    }
  } catch {}
}

export function isDaemonRunning(): boolean {
  const pid = loadPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    clearPid();
    return false;
  }
}

export function stopDaemon(): boolean {
  const pid = loadPid();
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    clearPid();
    return true;
  } catch {
    clearPid();
    return false;
  }
}

export function spawnDaemon(cliScriptPath: string) {
  ensureQuotaDir();
  const out = fs.openSync(LOG_PATH, 'a');
  const err = fs.openSync(LOG_PATH, 'a');

  const child = spawn(process.execPath, [cliScriptPath, 'watch', '--daemon-worker'], {
    detached: true,
    stdio: ['ignore', out, err]
  });

  if (child.pid) {
    savePid(child.pid);
    child.unref();
    return child.pid;
  }
  return null;
}
