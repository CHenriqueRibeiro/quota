import fs from 'node:fs';
import type { CliTelemetryPayload } from '../utils/telemetry.js';

export function parseGeminiChat(filePath: string, fileOffset: number = 0): { payloads: CliTelemetryPayload[]; newOffset: number } {
  const payloads: CliTelemetryPayload[] = [];
  try {
    if (!fs.existsSync(filePath)) return { payloads, newOffset: fileOffset };

    const stat = fs.statSync(filePath);
    if (stat.size <= fileOffset) {
      return { payloads, newOffset: stat.size };
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Tentar parse como JSONL primeiro
    if (filePath.endsWith('.jsonl')) {
      const lines = content.slice(fileOffset).split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const obj = JSON.parse(trimmed);
          if (obj.stats?.models) {
            for (const [modelName, modelData] of Object.entries<any>(obj.stats.models)) {
              const tokens = modelData?.tokens;
              if (tokens) {
                const promptTokens = Number(tokens.prompt || 0);
                const completionTokens = Number(tokens.candidates || 0);

                if (promptTokens > 0 || completionTokens > 0) {
                  payloads.push({
                    provider: 'google',
                    model: modelName,
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    cached_tokens: Number(tokens.cached || 0),
                    reasoning_tokens: Number(tokens.thoughts || 0),
                    latency_ms: Number(modelData?.api?.totalLatencyMs || 0),
                    status_code: 200,
                    request_id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                  });
                }
              }
            }
          }
        } catch {}
      }
    } else {
      // Parse como JSON único
      try {
        const obj = JSON.parse(content);
        if (obj.stats?.models) {
          for (const [modelName, modelData] of Object.entries<any>(obj.stats.models)) {
            const tokens = modelData?.tokens;
            if (tokens) {
              const promptTokens = Number(tokens.prompt || 0);
              const completionTokens = Number(tokens.candidates || 0);

              if (promptTokens > 0 || completionTokens > 0) {
                payloads.push({
                  provider: 'google',
                  model: modelName,
                  prompt_tokens: promptTokens,
                  completion_tokens: completionTokens,
                  cached_tokens: Number(tokens.cached || 0),
                  reasoning_tokens: Number(tokens.thoughts || 0),
                  latency_ms: Number(modelData?.api?.totalLatencyMs || 0),
                  status_code: 200,
                  request_id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                });
              }
            }
          }
        }
      } catch {}
    }

    return { payloads, newOffset: stat.size };
  } catch {
    return { payloads, newOffset: fileOffset };
  }
}
