import fs from 'node:fs';
import type { CliTelemetryPayload } from '../utils/telemetry.js';

export function parseClaudeJsonl(filePath: string, fileOffset: number = 0): { payloads: CliTelemetryPayload[]; newOffset: number } {
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

    let processedBytes = 0;

    for (const line of lines) {
      processedBytes += Buffer.byteLength(line + '\n', 'utf-8');
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const obj = JSON.parse(trimmed);
        if (obj.type === 'assistant' && obj.message?.usage) {
          const usage = obj.message.usage;
          const model = obj.message.model || 'claude-3-7-sonnet';

          const promptTokens = Number(usage.input_tokens || 0);
          const completionTokens = Number(usage.output_tokens || 0);

          if (promptTokens > 0 || completionTokens > 0) {
            payloads.push({
              provider: 'anthropic',
              model,
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              cached_tokens: Number(usage.cache_read_input_tokens || 0),
              cache_creation_tokens: Number(usage.cache_creation_input_tokens || 0),
              latency_ms: 0,
              status_code: 200,
              request_id: `claude_${obj.message.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`
            });
          }
        }
      } catch {
        // Ignora linhas JSON parciais ou inválidas durante o streaming
      }
    }

    return { payloads, newOffset: stat.size };
  } catch {
    return { payloads, newOffset: fileOffset };
  }
}
