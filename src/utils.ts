import { createHash } from 'crypto';

/**
 * Create a deterministic SHA-256 hash of the input text.
 * Used as the cache key so that identical hover content always
 * maps to the same translation regardless of file path or cursor position.
 */
export function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Rough token count estimate for English text.
 * A common heuristic: ~4 characters per token for English prose.
 * Used as a guard to avoid sending extremely long hover content to the API.
 */
export function estimatedTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if text contains CJK (Chinese/Japanese/Korean) characters.
 * If the hover content is already in Chinese, we skip translation
 * to avoid unnecessary API calls and potential degradation.
 */
export function containsCJK(text: string): boolean {
  // Unicode ranges:
  //   CJK Unified Ideographs:   U+4E00–U+9FFF
  //   CJK Extension A:          U+3400–U+4DBF
  //   CJK Compatibility:        U+F900–U+FAFF
  return /[㐀-䶿一-鿿豈-﫿]/.test(text);
}

/**
 * Truncate text to a maximum character length for API calls.
 * Keeps the beginning and end of long documents to preserve
 * the most relevant documentation content.
 */
export function truncateText(text: string, maxChars: number = 2000): string {
  if (text.length <= maxChars) {
    return text;
  }
  // Keep first 80% and last 20% to preserve signature + description
  const head = Math.floor(maxChars * 0.8);
  const tail = maxChars - head;
  return text.slice(0, head) + '\n\n... (truncated) ...\n\n' + text.slice(-tail);
}
