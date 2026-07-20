import * as vscode from 'vscode';
import { DeepSeekClient } from './deepseekClient';
import { LRUCache } from './cache';
import { hashContent } from './utils';
import { isEnabled, hasApiKey, getConfig } from './config';

/**
 * Recursion guard flag.
 *
 * When we call `vscode.executeHoverProvider` to get the original hover text,
 * VSCode would re-invoke our own hover provider, causing infinite recursion.
 * We set this flag to `true` before the call so our provider returns `null`
 * during the inner invocation.
 */
let isTranslating = false;

function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
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
function extractHoverText(hover: vscode.Hover): string {
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
function buildMergedMarkdown(
  originalText: string,
  translatedText: string,
  config: ReturnType<typeof getConfig>
): vscode.MarkdownString {
  const parts: string[] = [];

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
 * Register a hover provider for Python files that translates
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
export function registerHoverProvider(
  ctx: vscode.ExtensionContext,
  cache: LRUCache<string>
): vscode.Disposable {
  const provider = vscode.languages.registerHoverProvider('python', {
    async provideHover(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
      // --- Early exit guards ---

      if (isTranslating) {
        // Recursion guard: we are currently fetching the original hover.
        // Return null so the original provider runs without interference.
        return null;
      }

      if (!isEnabled() || !hasApiKey()) {
        return null;
      }

      // --- Fetch original hover ---

      isTranslating = true;
      let originalHovers: vscode.Hover[] | undefined;
      try {
        originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          position
        );
      } finally {
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

      const cacheKey = hashContent(originalText);
      let cached = cache.get(cacheKey);
      let translatedText: string;

      if (cached !== undefined) {
        translatedText = cached;
      } else {
        try {
          const config = getConfig();
          translatedText = await DeepSeekClient.getInstance().translate(
            originalText,
            config.targetLanguage
          );
          cache.set(cacheKey, translatedText);
        } catch (err) {
          // Graceful fallback: log the error and return the original hover.
          // The user's hover experience is never broken by API failures.
          console.warn(
            '[Python Hover Translator] Translation failed:',
            (err as Error).message
          );
          return originalHover;
        }
      }

      // User moved cursor away during the API call
      if (token.isCancellationRequested) {
        return null;
      }

      // --- Build and return merged hover ---

      const config = getConfig();
      const mergedContent = buildMergedMarkdown(
        originalText,
        translatedText,
        config
      );

      return new vscode.Hover(mergedContent, originalHover.range);
    },
  });

  ctx.subscriptions.push(provider);
  return provider;
}
