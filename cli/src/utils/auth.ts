import fs from 'node:fs';
import path from 'node:path';
import { QUOTA_DIR, CREDENTIALS_PATH, DEFAULT_API_URL } from './config.js';

export interface QuotaCredentials {
  user_key: string;
  api_url: string;
  updated_at: string;
}

export function ensureQuotaDir() {
  if (!fs.existsSync(QUOTA_DIR)) {
    fs.mkdirSync(QUOTA_DIR, { recursive: true });
  }
}

export function saveCredentials(key: string, apiUrl: string = DEFAULT_API_URL): QuotaCredentials {
  ensureQuotaDir();
  const data: QuotaCredentials = {
    user_key: key.trim(),
    api_url: apiUrl.trim(),
    updated_at: new Date().toISOString()
  };
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export function loadCredentials(): QuotaCredentials | null {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return null;
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const data = JSON.parse(raw) as QuotaCredentials;
    if (!data.user_key) return null;
    return data;
  } catch {
    return null;
  }
}
