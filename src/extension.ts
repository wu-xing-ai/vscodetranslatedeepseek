import * as vscode from 'vscode';
import { registerHoverProvider } from './hoverProvider';
import { LRUCache } from './cache';
import { getConfig } from './config';

let cache: LRUCache<string> | undefined;

/**
 * Activate the extension.
 *
 * Called by VSCode when a Python file is opened (onLanguage:python).
 * Initialises the LRU cache, registers the hover provider, and
 * sets up commands and configuration listeners.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('[Python Hover Translator] Activating...');

  // Initialise the translation cache
  const config = getConfig();
  cache = new LRUCache<string>(config.cacheSize);

  // Register the hover provider (core functionality)
  registerHoverProvider(context, cache);

  // --- Commands ---

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

  console.log('[Python Hover Translator] Activated successfully.');
}

/**
 * Deactivate the extension. Cleanup is automatic via context.subscriptions.
 */
export function deactivate() {
  console.log('[Python Hover Translator] Deactivated.');
}
