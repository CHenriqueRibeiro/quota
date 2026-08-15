import path from 'node:path';
import os from 'node:os';

export const QUOTA_DIR = path.join(os.homedir(), '.quota');
export const CREDENTIALS_PATH = path.join(QUOTA_DIR, 'credentials');
export const PID_PATH = path.join(QUOTA_DIR, 'watcher.pid');
export const LOG_PATH = path.join(QUOTA_DIR, 'watcher.log');

export const DEFAULT_API_URL = process.env.QUOTA_API_URL || 'https://quota-api.up.railway.app';
export const DEFAULT_APP_URL = process.env.QUOTA_APP_URL || 'http://localhost:5173';

export function getToolPaths() {
  const home = os.homedir();

  const claudeBase = process.env.CLAUDE_CONFIG_DIR || process.env.CLAUDE_HOME || path.join(home, '.claude');
  const claudePath = claudeBase.endsWith('projects') ? claudeBase : path.join(claudeBase, 'projects');

  const codexBase = process.env.CODEX_HOME || path.join(home, '.codex');
  const codexPath = codexBase.endsWith('sessions') ? codexBase : path.join(codexBase, 'sessions');

  const geminiBase = process.env.GEMINI_HOME || path.join(home, '.gemini');
  const geminiPath = geminiBase.endsWith('tmp') ? geminiBase : path.join(geminiBase, 'tmp');

  return {
    claude: claudePath,
    codex: codexPath,
    gemini: geminiPath
  };
}
