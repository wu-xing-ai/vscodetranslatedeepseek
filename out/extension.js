"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const hoverProvider_1 = require("./hoverProvider");
const cache_1 = require("./cache");
const config_1 = require("./config");
let cache;
/**
 * Activate the extension.
 *
 * Called by VSCode when a Python file is opened (onLanguage:python).
 * Initialises the LRU cache, registers the hover provider, and
 * sets up commands and configuration listeners.
 */
function activate(context) {
    console.log('[Python Hover Translator] Activating...');
    // Initialise the translation cache
    const config = (0, config_1.getConfig)();
    cache = new cache_1.LRUCache(config.cacheSize);
    // Register the hover provider (core functionality)
    (0, hoverProvider_1.registerHoverProvider)(context, cache);
    // --- Commands ---
    // Clear the translation cache
    context.subscriptions.push(vscode.commands.registerCommand('pythonHoverTranslator.clearCache', () => {
        if (cache) {
            const prevSize = cache.size;
            cache.clear();
            vscode.window.showInformationMessage(`Translation cache cleared (${prevSize} entries removed).`);
        }
    }));
    // Toggle the extension on/off
    context.subscriptions.push(vscode.commands.registerCommand('pythonHoverTranslator.toggle', () => {
        const current = vscode.workspace
            .getConfiguration('pythonHoverTranslator')
            .get('enabled', true);
        vscode.workspace
            .getConfiguration('pythonHoverTranslator')
            .update('enabled', !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Python Hover Translator: ${!current ? 'ENABLED' : 'DISABLED'}`);
    }));
    // Keep cache capacity in sync with user settings
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('pythonHoverTranslator.cacheSize')) {
            const newSize = vscode.workspace
                .getConfiguration('pythonHoverTranslator')
                .get('cacheSize', 200);
            cache?.updateCapacity(newSize);
            console.log(`[Python Hover Translator] Cache capacity updated to ${newSize}`);
        }
    }));
    console.log('[Python Hover Translator] Activated successfully.');
}
/**
 * Deactivate the extension. Cleanup is automatic via context.subscriptions.
 */
function deactivate() {
    console.log('[Python Hover Translator] Deactivated.');
}
//# sourceMappingURL=extension.js.map