import * as vscode from 'vscode';
import { BUILTIN_API_KEY } from './builtin';

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
 * Return the user's own API key, or an empty string if none is configured.
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

/**
 * Return the key actually used for requests.
 * Falls back to the built-in shared free key when the user has none, so the
 * extension works out-of-the-box without any configuration.
 */
export function getApiKey(): string {
  const userKey = getUserApiKey();
  return userKey && userKey.trim().length > 0 ? userKey : BUILTIN_API_KEY;
}

/** True when no user key is configured and the shared built-in key is used. */
export function isUsingBuiltinKey(): boolean {
  const userKey = getUserApiKey();
  return !(userKey && userKey.trim().length > 0);
}

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
