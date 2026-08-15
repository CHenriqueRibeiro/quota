import fs from 'node:fs';
import type { CliTelemetryPayload } from '../utils/telemetry.js';

export function parseCodexJsonl(filePath: string, fileOffset: number = 0): { payloads: CliTelemetryPayload[]; newOffset: number } {
  const payloads: CliTelemetryPayload[] = [];
  try {
    if (!fs.existsSync(filePath)) return { payloads, newOffset: fileOffset };

    const stat = fs.statSync(filePath);
    if (stat.size <= fileOffset) {
      return { payloads, newOffset: stat.size };
    }

    const stream = fs.readFileSync(filePath, 'utf-8');
    const content = stream.slice(fileOffset);
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const obj = JSON.parse(trimmed);
        const usage = obj.usage || obj.tokens || obj.token_usage;

        if (usage) {
          const model = obj.model || obj.model_name || 'gpt-4o';
          const promptTokens = Number(usage.input_tokens || usage.prompt_tokens || 0);
          const completionTokens = Number(usage.output_tokens || usage.completion_tokens || 0);

          if (promptTokens > 0 || completionTokens > 0) {
            payloads.push({
              provider: 'openai',
              model,
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              cached_tokens: Number(usage.cached_tokens || usage.cache_read_tokens || 0),
              reasoning_tokens: Number(usage.reasoning_tokens || usage.thoughts_tokens || 0),
              latency_ms: Number(obj.latency_ms || 0),
              status_code: 200,
              request_id: `codex_${obj.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`
            });
          }
        }
      } catch {
        // Ignora linhas incompletas
      }
    }

    return { payloads, newOffset: stat.size };
  } catch {
    return { payloads, newOffset: fileOffset };
  }
}
