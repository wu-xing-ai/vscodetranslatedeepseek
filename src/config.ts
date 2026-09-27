import * as vscode from 'vscode';
import { getApiKey, isUsingBuiltinKey } from './secrets';
import {
  BUILTIN_MODEL,
  BUILTIN_API_URL,
  BUILTIN_MAX_TOKENS,
} from './builtin';

const CONFIG_SECTION = 'pythonHoverTranslator';

/** Full configuration snapshot. */
export interface ExtensionConfig {
  enabled: boolean;
  apiKey: string;
  apiUrl: string;
  targetLanguage: string;
  cacheSize: number;
  model: string;
  maxTokens: number;
  showOriginal: boolean;
  showExamples: boolean;
  proxyUrl: string;
}

/** Read all configuration values at once. */
export function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);

  // When no user key is configured we fall back to the shared free key,
  // which is only valid for the free 智谱 glm-4-flash model. In that case
  // ignore the user's url/model/tokens so requests always succeed.
  const usingBuiltin = isUsingBuiltinKey();

  return {
    enabled: cfg.get<boolean>('enabled', true),
    apiKey: getApiKey(),
    apiUrl: usingBuiltin
      ? BUILTIN_API_URL
      : cfg.get<string>('apiUrl', 'https://api.deepseek.com/v1/chat/completions'),
    targetLanguage: cfg.get<string>('targetLanguage', 'Chinese (Simplified)'),
    cacheSize: cfg.get<number>('cacheSize', 200),
    model: usingBuiltin ? BUILTIN_MODEL : cfg.get<string>('model', 'deepseek-chat'),
    maxTokens: usingBuiltin
      ? BUILTIN_MAX_TOKENS
      : cfg.get<number>('maxTokens', 1024),
    showOriginal: cfg.get<boolean>('showOriginal', true),
    showExamples: cfg.get<boolean>('showExamples', true),
    proxyUrl: cfg.get<string>('proxyUrl', ''),
  };
}

/** Quick check called on every hover before doing any work. */
export function isEnabled(): boolean {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>('enabled', true);
}

/** Check if user has configured an API key. */
export function hasApiKey(): boolean {
  const key = getApiKey();
  return !!key && key.trim().length > 0;
}
