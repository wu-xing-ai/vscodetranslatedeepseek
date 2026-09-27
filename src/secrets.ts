import * as vscode from 'vscode';

const SECRET_KEY = 'pythonHoverTranslator.apiKey';
const CONFIG_SECTION = 'pythonHoverTranslator';

let cachedApiKey = '';
let contextRef: vscode.ExtensionContext | undefined;

/**
 * Load the API key from secure storage into memory.
 * Must be awaited during activation so that the synchronous hover path
 * (`hasApiKey()` / `getConfig()`) can read it without awaiting.
 */
export async function initSecrets(context: vscode.ExtensionContext): Promise<void> {
  contextRef = context;
  try {
    cachedApiKey = (await context.secrets.get(SECRET_KEY)) || '';
  } catch (err) {
    console.warn('[Python Hover Translator] Failed to read secret storage:', err);
    cachedApiKey = '';
  }
}

/**
 * Return the API key.
 * Prefers the securely stored secret; falls back to the legacy plain-text
 * `pythonHoverTranslator.apiKey` setting for backward compatibility.
 */
export function getUserApiKey(): string {
  if (cachedApiKey && cachedApiKey.trim().length > 0) {
    return cachedApiKey;
  }
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string>('apiKey', '');
}

/** Alias kept for callers that just want the effective key. */
export const getApiKey = getUserApiKey;

/** Persist the API key to secure storage (and mirror to memory). */
export async function saveApiKey(key: string): Promise<void> {
  cachedApiKey = key;
  if (!contextRef) {
    throw new Error('Secret storage not initialised');
  }
  await contextRef.secrets.store(SECRET_KEY, key);
}

/** Remove the API key from secure storage. */
export async function clearApiKey(): Promise<void> {
  cachedApiKey = '';
  if (contextRef) {
    await contextRef.secrets.delete(SECRET_KEY);
  }
}
