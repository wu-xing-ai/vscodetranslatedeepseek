import * as vscode from 'vscode';

const CONFIG_SECTION = 'pythonHoverTranslator';

/** Full configuration snapshot. */
export interface ExtensionConfig {
  enabled: boolean;
  apiKey: string;
  targetLanguage: string;
  cacheSize: number;
  model: string;
  showOriginal: boolean;
  showExamples: boolean;
  proxyUrl: string;
}

/** Read all configuration values at once. */
export function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    enabled: cfg.get<boolean>('enabled', true),
    apiKey: cfg.get<string>('apiKey', ''),
    targetLanguage: cfg.get<string>('targetLanguage', 'Chinese (Simplified)'),
    cacheSize: cfg.get<number>('cacheSize', 200),
    model: cfg.get<string>('model', 'deepseek-chat'),
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
  const key = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string>('apiKey', '');
  return !!key && key.trim().length > 0;
}
