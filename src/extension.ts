import * as vscode from 'vscode';
import { registerHoverProvider } from './hoverProvider';
import { LRUCache } from './cache';
import { getConfig } from './config';
import { initSecrets, isUsingBuiltinKey } from './secrets';
import { SettingsPanel } from './settingsPanel';

let cache: LRUCache<string> | undefined;

/**
 * Activate the extension.
 *
 * Called by VSCode when a Python file is opened (onLanguage:python).
 * Initialises the LRU cache, registers the hover provider, and
 * sets up commands and configuration listeners.
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('[Python Hover Translator] Activating...');

  // Load the API key from secure storage before anything else,
  // so the synchronous hover path can read it.
  await initSecrets(context);

  // Initialise the translation cache
  const config = getConfig();
  cache = new LRUCache<string>(config.cacheSize);

  // Register the hover provider (core functionality)
  registerHoverProvider(context, cache);

  // --- Commands ---

  // Open the visual settings panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pythonHoverTranslator.openSettings', () => {
      SettingsPanel.createOrShow(context.extensionUri);
    })
  );

  // Clear the translation cache
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'pythonHoverTranslator.clearCache',
      () => {
        if (cache) {
          const prevSize = cache.size;
          cache.clear();
          vscode.window.showInformationMessage(
            `Translation cache cleared (${prevSize} entries removed).`
          );
        }
      }
    )
  );

  // Toggle the extension on/off
  context.subscriptions.push(
    vscode.commands.registerCommand('pythonHoverTranslator.toggle', () => {
      const current = vscode.workspace
        .getConfiguration('pythonHoverTranslator')
        .get<boolean>('enabled', true);
      vscode.workspace
        .getConfiguration('pythonHoverTranslator')
        .update('enabled', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Python Hover Translator: ${!current ? 'ENABLED' : 'DISABLED'}`
      );
    })
  );

  // Keep cache capacity in sync with user settings
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pythonHoverTranslator.cacheSize')) {
        const newSize = vscode.workspace
          .getConfiguration('pythonHoverTranslator')
          .get<number>('cacheSize', 200);
        cache?.updateCapacity(newSize);
        console.log(
          `[Python Hover Translator] Cache capacity updated to ${newSize}`
        );
      }
    })
  );

  // First-run notice: tell the user they are using the shared free key and
  // how to configure their own provider.
  const alreadyPrompted = context.globalState.get<boolean>('hasPromptedForSetup');
  if (isUsingBuiltinKey() && !alreadyPrompted) {
    await context.globalState.update('hasPromptedForSetup', true);
    const action = await vscode.window.showInformationMessage(
      'AI Translate 已启用：正在使用内置免费额度（智谱 glm-4-flash），无需配置即可翻译。',
      '配置自己的 Key'
    );
    if (action === '配置自己的 Key') {
      SettingsPanel.createOrShow(context.extensionUri);
    }
  }

  console.log('[Python Hover Translator] Activated successfully.');
}

/**
 * Deactivate the extension. Cleanup is automatic via context.subscriptions.
 */
export function deactivate() {
  console.log('[Python Hover Translator] Deactivated.');
}
