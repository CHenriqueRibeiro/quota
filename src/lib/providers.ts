export const SUPPORTED_PROVIDERS = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Claude' },
  { key: 'google', label: 'Gemini' },
  { key: 'groq', label: 'Groq' },
  { key: 'mistral', label: 'Mistral' },
] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]['key'];

const PROVIDER_ALIASES: Record<string, string> = {
  openai: 'openai',
  chatgpt: 'openai',
  claude: 'anthropic',
  anthropic: 'anthropic',
  gemini: 'google',
  google: 'google',
  groq: 'groq',
  mistral: 'mistral',
};

export function normalizeProvider(value?: string | null): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';
  return PROVIDER_ALIASES[raw] ?? raw;
}

export function isSupportedProvider(value?: string | null): value is SupportedProvider {
  const provider = normalizeProvider(value);
  return SUPPORTED_PROVIDERS.some(item => item.key === provider);
}
