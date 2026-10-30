import type { CustomProvider } from '../shared/types';

// The built-in provider list. Everything about a provider is data, so a URL
// change on their side is a one-line fix here.

export interface Provider {
  id: string;
  name: string;
  url: string;
  /** Cookie jar. Providers that share one (Google) only need one login. */
  partition: string;
  /** Domains this tab may navigate within (suffix match). Login domains included. */
  hosts: string[];
  /** Brand-ish accent used for the active pill glow. */
  color: string;
  /** Set for providers added with "+". */
  base?: string;
  icon?: string;
  custom?: boolean;
}

export const PROVIDERS: Provider[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', partition: 'persist:chatgpt', hosts: ['chatgpt.com', 'openai.com', 'oaistatic.com', 'oaiusercontent.com'], color: '#10a37f' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', partition: 'persist:google', hosts: ['google.com', 'gstatic.com', 'googleusercontent.com'], color: '#4f8df9' },
  { id: 'aistudio', name: 'AI Studio', url: 'https://aistudio.google.com/prompts/new_chat', partition: 'persist:google', hosts: ['google.com', 'gstatic.com', 'googleusercontent.com'], color: '#4285f4' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', partition: 'persist:claude', hosts: ['claude.ai', 'anthropic.com', 'claudeusercontent.com'], color: '#d97757' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/', partition: 'persist:grok', hosts: ['grok.com', 'x.ai', 'x.com', 'twitter.com'], color: '#a0a0a0' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/', partition: 'persist:deepseek', hosts: ['deepseek.com'], color: '#4d6bfe' },
  { id: 'mistral', name: 'Le Chat', url: 'https://chat.mistral.ai/chat', partition: 'persist:mistral', hosts: ['mistral.ai'], color: '#fa520f' },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com/', partition: 'persist:copilot', hosts: ['microsoft.com', 'live.com', 'microsoftonline.com', 'bing.com', 'msauth.net', 'msftauth.net'], color: '#2a8cff' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', partition: 'persist:perplexity', hosts: ['perplexity.ai'], color: '#20b8cd' },
  { id: 'qwen', name: 'Qwen', url: 'https://chat.qwen.ai/', partition: 'persist:qwen', hosts: ['qwen.ai', 'qwenlm.ai', 'alibaba.com', 'aliyun.com'], color: '#615ced' },
  { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/', partition: 'persist:kimi', hosts: ['kimi.com', 'moonshot.cn', 'kimi.ai'], color: '#a9a9ff' },
  { id: 'zai', name: 'Z.ai', url: 'https://chat.z.ai/', partition: 'persist:zai', hosts: ['z.ai', 'zhipuai.cn', 'bigmodel.cn'], color: '#7aa2ff' },
  { id: 'meta', name: 'Meta AI', url: 'https://www.meta.ai/', partition: 'persist:meta', hosts: ['meta.ai', 'meta.com', 'facebook.com', 'instagram.com', 'fbcdn.net'], color: '#0081fb' },
  { id: 'huggingchat', name: 'HuggingChat', url: 'https://huggingface.co/chat/', partition: 'persist:huggingchat', hosts: ['huggingface.co', 'hf.co'], color: '#ffcc4d' },
  { id: 'lmarena', name: 'LMArena', url: 'https://lmarena.ai/', partition: 'persist:lmarena', hosts: ['lmarena.ai'], color: '#e4e4e7' },
  { id: 'duck', name: 'Duck.ai', url: 'https://duck.ai/', partition: 'persist:duck', hosts: ['duck.ai', 'duckduckgo.com'], color: '#de5833' },
];

/** Third-party sign-in providers ("Continue with Google/Apple/...") plus bot checks. */
export const AUTH_HOSTS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'appleid.apple.com',
  'idmsa.apple.com',
  'login.microsoftonline.com',
  'login.live.com',
  'account.live.com',
  'github.com',
  'x.com',
  'api.x.com',
  'twitter.com',
  'facebook.com',
  'discord.com',
  'challenges.cloudflare.com',
  'hcaptcha.com',
  'recaptcha.net',
];

export function hostMatches(url: string, hosts: string[]): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    host = u.hostname;
  } catch {
    return false;
  }
  return hosts.some((h) => host === h || host.endsWith('.' + h));
}

// ---------- user-added providers ("+") ----------

let extras: Provider[] = [];

export function setExtraProviders(list: CustomProvider[]): void {
  extras = list.map((c) => ({ ...c, custom: true }));
}

export function allProviders(): Provider[] {
  return [...PROVIDERS, ...extras];
}

export function findProvider(id: string | null | undefined): Provider | undefined {
  return allProviders().find((p) => p.id === id);
}

export function isExtra(id: string): boolean {
  return extras.some((p) => p.id === id);
}

/** Tab icon URL as seen from dist/renderer/index.html. */
export function iconFor(p: Provider): string {
  if (p.icon) return p.icon;

  // Extra accounts inherit their base provider's icon (including custom sites).
  const base = p.base ? findProvider(p.base) : undefined;
  if (base?.icon) return base.icon;

  const id = base?.id ?? p.id;
  return PROVIDERS.some((b) => b.id === id) ? `../../resources/icons/${id}.png` : '';
}
