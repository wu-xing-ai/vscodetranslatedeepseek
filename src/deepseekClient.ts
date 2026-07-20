import * as tls from 'tls';
import * as net from 'net';
import { getConfig } from './config';
import { containsCJK, truncateText, estimatedTokens } from './utils';

const DEEPSEEK_HOST = 'api.deepseek.com';
const DEEPSEEK_PATH = '/v1/chat/completions';

interface DeepSeekResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Singleton client for the DeepSeek API.
 *
 * Uses raw tls.connect() to bypass VSCode's @vscode/proxy-agent.
 * Supports optional HTTP CONNECT proxy tunneling for users behind firewalls.
 */
export class DeepSeekClient {
  private static instance: DeepSeekClient;

  private callTimestamps: number[] = [];
  private readonly MAX_CALLS_PER_MINUTE = 30;
  private readonly RATE_WINDOW_MS = 60_000;

  static getInstance(): DeepSeekClient {
    if (!DeepSeekClient.instance) {
      DeepSeekClient.instance = new DeepSeekClient();
    }
    return DeepSeekClient.instance;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    const clean = text.trim();

    if (!clean || clean.length < 10) { return clean; }
    if (containsCJK(clean)) { return clean; }

    this.checkRateLimit();

    const input = estimatedTokens(clean) > 2000 ? truncateText(clean, 2000) : clean;

    return this.callAPI(input, targetLanguage);
  }

  private async callAPI(text: string, targetLanguage: string): Promise<string> {
    const config = getConfig();

    if (!config.apiKey) {
      throw new Error('DeepSeek API key not configured.');
    }

    // Resolve proxy: config setting takes priority, then env vars
    const proxyUrl = config.proxyUrl
      || process.env.HTTPS_PROXY
      || process.env.https_proxy
      || process.env.HTTP_PROXY
      || process.env.http_proxy
      || '';

    const useProxy = !!proxyUrl;

    const isChinese = targetLanguage.includes('Chinese');

    const systemPrompt = [
      'You are a professional technical documentation translator.',
      `Translate the user's Python documentation from English into ${targetLanguage}.`,
      '',
      isChinese
        ? '关键规则（必须遵守）：'
        : 'Critical rules (must follow):',
      '- 所有描述性文字必须翻译成目标语言，不允许保留英文原文。',
      '- 输出的每一个字都必须是目标语言（函数名、类名、变量名、代码块除外）。',
      '- 保留所有代码块、反引号、类型标注、参数名原样不动。',
      '- 保留原标题结构（标题层级、列表、代码围栏）。',
      '- 函数名、类名、模块名、变量名、代码一律不翻译。',
    ].join('\n');

    const userPrompt = config.showExamples
      ? `${text}\n\n翻译完成后，请在底部用围栏代码块额外提供 1-2 个简洁的 Python 使用示例。`
      : text;

    const requestBody = JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      stream: false,
    });

    console.log(
      '[Python Hover Translator] Connecting to', DEEPSEEK_HOST,
      useProxy ? `via proxy ${proxyUrl}` : '(direct TLS)'
    );

    if (useProxy) {
      return this.requestViaProxy(proxyUrl, requestBody, config.apiKey);
    }
    return this.requestDirect(requestBody, config.apiKey);
  }

  /**
   * Direct TLS connection (no proxy).
   */
  private requestDirect(body: string, apiKey: string): Promise<string> {
    const httpRequest = [
      `POST ${DEEPSEEK_PATH} HTTP/1.1`,
      `Host: ${DEEPSEEK_HOST}`,
      `Content-Type: application/json`,
      `Authorization: Bearer ${apiKey}`,
      `Content-Length: ${Buffer.byteLength(body)}`,
      `Connection: close`,
      '',
      '',
    ].join('\r\n');

    return new Promise((resolve, reject) => {
      let settled = false;

      const sock = tls.connect(
        {
          host: DEEPSEEK_HOST,
          port: 443,
          servername: DEEPSEEK_HOST,
          rejectUnauthorized: false,
          timeout: 15_000,
        },
        () => {
          sock.write(httpRequest);
          sock.write(body);
        }
      );

      const chunks: Buffer[] = [];
      sock.on('data', (chunk: Buffer) => chunks.push(chunk));

      sock.on('end', () => {
        if (settled) { return; }
        settled = true;
        const raw = Buffer.concat(chunks).toString();
        this.processResponse(raw, resolve, reject);
      });

      sock.on('error', (err: Error) => {
        if (settled) { return; }
        settled = true;
        reject(err);
      });

      sock.on('timeout', () => {
        if (settled) { return; }
        settled = true;
        sock.destroy();
        reject(new Error('TLS connection timed out'));
      });
    });
  }

  /**
   * HTTP CONNECT proxy tunnel → TLS over the tunnel.
   */
  private requestViaProxy(
    proxyUrl: string,
    body: string,
    apiKey: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let proxyHost: string;
      let proxyPort: number;

      try {
        const u = new URL(proxyUrl);
        proxyHost = u.hostname;
        proxyPort = parseInt(u.port || '7890');
      } catch {
        reject(new Error('Invalid proxy URL: ' + proxyUrl));
        return;
      }

      // Step 1: connect to proxy
      const proxySocket = net.connect(
        { host: proxyHost, port: proxyPort, timeout: 15_000 },
        () => {
          // Step 2: send CONNECT to establish tunnel
          proxySocket.write(
            `CONNECT ${DEEPSEEK_HOST}:443 HTTP/1.1\r\n` +
            `Host: ${DEEPSEEK_HOST}:443\r\n` +
            `Proxy-Connection: Keep-Alive\r\n\r\n`
          );
        }
      );

      let connectResponse = '';

      proxySocket.on('data', (chunk: Buffer) => {
        connectResponse += chunk.toString();

        // Check if we got the full CONNECT response (ends with \r\n\r\n)
        if (connectResponse.includes('\r\n\r\n')) {
          const statusLine = connectResponse.split('\r\n')[0];
          if (!statusLine.includes('200')) {
            proxySocket.destroy();
            if (!settled) {
              settled = true;
              reject(new Error(`Proxy rejected CONNECT: ${statusLine}`));
            }
            return;
          }

          // Step 3: upgrade to TLS over the proxy tunnel
          proxySocket.removeAllListeners('data');

          const tlsSocket = tls.connect(
            {
              socket: proxySocket,
              servername: DEEPSEEK_HOST,
              rejectUnauthorized: false,
              timeout: 15_000,
            },
            () => {
              // Step 4: send the actual HTTPS request
              const httpRequest = [
                `POST ${DEEPSEEK_PATH} HTTP/1.1`,
                `Host: ${DEEPSEEK_HOST}`,
                `Content-Type: application/json`,
                `Authorization: Bearer ${apiKey}`,
                `Content-Length: ${Buffer.byteLength(body)}`,
                `Connection: close`,
                '',
                '',
              ].join('\r\n');

              tlsSocket.write(httpRequest);
              tlsSocket.write(body);
            }
          );

          const chunks: Buffer[] = [];
          tlsSocket.on('data', (chunk: Buffer) => chunks.push(chunk));

          tlsSocket.on('end', () => {
            if (settled) { return; }
            settled = true;
            const raw = Buffer.concat(chunks).toString();
            this.processResponse(raw, resolve, reject);
          });

          tlsSocket.on('error', (err: Error) => {
            if (settled) { return; }
            settled = true;
            reject(err);
          });

          tlsSocket.on('timeout', () => {
            if (settled) { return; }
            settled = true;
            tlsSocket.destroy();
            reject(new Error('TLS over proxy timed out'));
          });
        }
      });

      proxySocket.on('error', (err: Error) => {
        if (settled) { return; }
        settled = true;
        reject(err);
      });

      proxySocket.on('timeout', () => {
        if (settled) { return; }
        settled = true;
        proxySocket.destroy();
        reject(new Error('Proxy connection timed out'));
      });
    });
  }

  /**
   * Process raw HTTP response: extract body, sanitize, parse JSON.
   */
  private processResponse(
    raw: string,
    resolve: (value: string) => void,
    reject: (err: Error) => void
  ): void {
    console.log('[Python Hover Translator] TLS response received,', raw.length, 'bytes');

    if (!raw) {
      reject(new Error('Empty response from API'));
      return;
    }

    try {
      const body = this.extractHttpBody(raw);
      if (!body) {
        console.error('[Python Hover Translator] Raw response:', raw.slice(0, 500));
        reject(new Error('Could not extract HTTP body from response'));
        return;
      }

      const cleanBody = this.sanitizeJson(body);

      let data: DeepSeekResponse;
      try {
        data = JSON.parse(cleanBody) as DeepSeekResponse;
      } catch (parseErr) {
        console.error('[Python Hover Translator] JSON parse failed.');
        console.error('[Python Hover Translator] Body start:', cleanBody.slice(0, 300));
        console.error('[Python Hover Translator] Body end:', cleanBody.slice(-300));
        reject(parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
        return;
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        reject(new Error('DeepSeek returned empty response body'));
        return;
      }

      console.log(
        '[Python Hover Translator] Translation OK, tokens:',
        data.usage?.total_tokens
      );
      resolve(content.trim());
    } catch (e) {
      console.error(
        '[Python Hover Translator] Parse error. Response start:',
        raw.slice(0, 500)
      );
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Extract HTTP body from raw response, handling chunked encoding. */
  private extractHttpBody(raw: string): string {
    const headerEnd = raw.indexOf('\r\n\r\n');
    if (headerEnd < 0) { return ''; }

    const headerSection = raw.slice(0, headerEnd);
    const afterHeaders = raw.slice(headerEnd + 4);

    if (/transfer-encoding:\s*chunked/i.test(headerSection)) {
      return this.decodeChunked(afterHeaders);
    }
    return afterHeaders;
  }

  /**
   * Decode HTTP chunked transfer encoding.
   * Splits by \r\n, identifies hex chunk-size lines, collects data lines.
   */
  private decodeChunked(raw: string): string {
    const lines = raw.split('\r\n');
    const parts: string[] = [];
    let expectingData = false;

    for (const line of lines) {
      if (!expectingData) {
        const size = parseInt(line, 16);
        if (size === 0 || isNaN(size)) { break; }
        expectingData = true;
      } else {
        parts.push(line);
        expectingData = false;
      }
    }
    return parts.join('');
  }

  /**
   * Escape control characters inside JSON string values.
   */
  private sanitizeJson(json: string): string {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < json.length; i++) {
      const ch = json[i];
      const code = ch.charCodeAt(0);

      if (escape) { escape = false; result += ch; continue; }
      if (ch === '\\' && inString) { escape = true; result += ch; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }

      if (inString && code < 0x20) {
        if (ch === '\n') { result += '\\n'; }
        else if (ch === '\r') { result += '\\r'; }
        else if (ch === '\t') { result += '\\t'; }
        else { result += ' '; }
        continue;
      }

      result += ch;
    }
    return result;
  }

  private checkRateLimit(): void {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(
      (ts) => now - ts < this.RATE_WINDOW_MS
    );
    if (this.callTimestamps.length >= this.MAX_CALLS_PER_MINUTE) {
      throw new Error('Rate limit reached.');
    }
    this.callTimestamps.push(now);
  }
}
