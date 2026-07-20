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
exports.registerHoverProvider = registerHoverProvider;
const vscode = __importStar(require("vscode"));
const deepseekClient_1 = require("./deepseekClient");
const utils_1 = require("./utils");
const config_1 = require("./config");
/**
 * Recursion guard flag.
 *
 * When we call `vscode.executeHoverProvider` to get the original hover text,
 * VSCode would re-invoke our own hover provider, causing infinite recursion.
 * We set this flag to `true` before the call so our provider returns `null`
 * during the inner invocation.
 */
let isTranslating = false;
function getLanguageLabel(lang) {
    const labels = {
        'Chinese (Simplified)': '简体中文',
        'Chinese (Traditional)': '繁體中文',
        'Japanese': '日本語',
        'Korean': '한국어',
    };
    return labels[lang] || lang;
}
/**
 * Extract plain markdown text from a vscode.Hover's contents array.
 * Contents can be either a plain string or a vscode.MarkdownString.
 */
function extractHoverText(hover) {
    return hover.contents
        .map((c) => {
        if (typeof c === 'string') {
            return c;
        }
        if (c instanceof vscode.MarkdownString) {
            return c.value;
        }
        return '';
    })
        .join('\n');
}
/**
 * Build the final merged markdown string combining original docs
 * (optionally) and the translated text.
 */
function buildMergedMarkdown(originalText, translatedText, config) {
    const parts = [];
    if (config.showOriginal) {
        parts.push(originalText);
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push(`### ${getLanguageLabel(config.targetLanguage)} 翻译`);
        parts.push('');
    }
    parts.push(translatedText);
    const markdown = new vscode.MarkdownString(parts.join('\n'));
    markdown.isTrusted = false;
    markdown.supportHtml = false;
    return markdown;
}
/**
 * Register a hover provider for all languages that translates
 * hover documentation using the DeepSeek API.
 *
 * Flow:
 * 1. Guard: skip if disabled, no API key, or inside our own recursion
 * 2. Fetch the original VSCode hover from the built-in Python provider
 * 3. Check the LRU cache (by SHA-256 hash of original text)
 * 4. If cache miss → call DeepSeek API → store in cache
 * 5. Merge original + translation into a single MarkdownString
 * 6. On ANY error → return the original hover unchanged
 */
function registerHoverProvider(ctx, cache) {
    // Register for all languages — not just Python.
    // Documented functions in any language (JS/TS/Go/Rust/Java etc.) get translated.
    const provider = vscode.languages.registerHoverProvider('*', {
        async provideHover(document, position, token) {
            // --- Early exit guards ---
            if (isTranslating) {
                // Recursion guard: we are currently fetching the original hover.
                // Return null so the original provider runs without interference.
                return null;
            }
            if (!(0, config_1.isEnabled)() || !(0, config_1.hasApiKey)()) {
                return null;
            }
            // --- Fetch original hover ---
            isTranslating = true;
            let originalHovers;
            try {
                originalHovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', document.uri, position);
            }
            finally {
                isTranslating = false;
            }
            if (!originalHovers || originalHovers.length === 0) {
                return null;
            }
            const originalHover = originalHovers[0];
            const originalText = extractHoverText(originalHover).trim();
            if (!originalText) {
                return null;
            }
            // User moved cursor away during the fetch
            if (token.isCancellationRequested) {
                return null;
            }
            // --- Translation (cached or API) ---
            const cacheKey = (0, utils_1.hashContent)(originalText);
            let cached = cache.get(cacheKey);
            let translatedText;
            if (cached !== undefined) {
                translatedText = cached;
            }
            else {
                try {
                    const config = (0, config_1.getConfig)();
                    translatedText = await deepseekClient_1.DeepSeekClient.getInstance().translate(originalText, config.targetLanguage);
                    cache.set(cacheKey, translatedText);
                }
                catch (err) {
                    // Graceful fallback: log the error and return the original hover.
                    // The user's hover experience is never broken by API failures.
                    console.warn('[Python Hover Translator] Translation failed:', err.message);
                    return originalHover;
                }
            }
            // User moved cursor away during the API call
            if (token.isCancellationRequested) {
                return null;
            }
            // --- Build and return merged hover ---
            const config = (0, config_1.getConfig)();
            const mergedContent = buildMergedMarkdown(originalText, translatedText, config);
            return new vscode.Hover(mergedContent, originalHover.range);
        },
    });
    ctx.subscriptions.push(provider);
    return provider;
}
//# sourceMappingURL=hoverProvider.js.map