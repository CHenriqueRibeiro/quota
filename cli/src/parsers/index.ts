import fs from 'node:fs';
import { getToolPaths } from '../utils/config.js';
import { parseClaudeJsonl } from './claude.js';
import { parseCodexJsonl } from './codex.js';
import { parseGeminiChat } from './gemini.js';

export { parseClaudeJsonl, parseCodexJsonl, parseGeminiChat };

export interface ToolDetectionResult {
  claude: { installed: boolean; path: string };
  codex: { installed: boolean; path: string };
  gemini: { installed: boolean; path: string };
}

export function detectInstalledTools(): ToolDetectionResult {
  const toolPaths = getToolPaths();

  return {
    claude: {
      installed: fs.existsSync(toolPaths.claude),
      path: toolPaths.claude
    },
    codex: {
      installed: fs.existsSync(toolPaths.codex),
      path: toolPaths.codex
    },
    gemini: {
      installed: fs.existsSync(toolPaths.gemini),
      path: toolPaths.gemini
    }
  };
}
