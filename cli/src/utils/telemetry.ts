import { loadCredentials } from './auth.js';

export interface CliTelemetryPayload {
  provider: 'anthropic' | 'openai' | 'google' | string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens?: number;
  cache_creation_tokens?: number;
  reasoning_tokens?: number;
  latency_ms?: number;
  status_code?: number;
  trace_id?: string;
  request_id?: string;
}

export async function sendCliTelemetry(payload: CliTelemetryPayload): Promise<boolean> {
  try {
    const creds = loadCredentials();
    if (!creds || !creds.user_key) return false;

    const url = `${creds.api_url.replace(/\/$/, '')}/cli-telemetry`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.user_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return res.ok;
  } catch {
    // Transparente ao usuário: ignora falhas de rede silenciosamente
    return false;
  }
}

export async function pingCliServer(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const creds = loadCredentials();
    if (!creds || !creds.user_key) {
      return { success: false, error: 'Credenciais não encontradas. Rode "quota login".' };
    }

    const url = `${creds.api_url.replace(/\/$/, '')}/cli-telemetry/ping`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${creds.user_key}`
      }
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { success: false, error: (errBody as any).error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha de conexão com o servidor Quota.' };
  }
}
