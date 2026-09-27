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
exports.DeepSeekClient = void 0;
const tls = __importStar(require("tls"));
const net = __importStar(require("net"));
const config_1 = require("./config");
const utils_1 = require("./utils");
const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions';
/**
 * Parse and validate a user-configured API URL into connection details.
 */
function parseEndpoint(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        throw new Error(`Invalid API URL: ${rawUrl}`);
    }
    const protocol = url.protocol;
    if (protocol !== 'https:' && protocol !== 'http:') {
        throw new Error(`Unsupported protocol "${url.protocol}" — use http or https`);
    }
    const port = url.port
        ? parseInt(url.port, 10)
        : (protocol === 'https:' ? 443 : 80);
    // If the user only gave a base URL (no explicit endpoint), append the
    // standard OpenAI-compatible path. This makes configs like
    // "https://open.bigmodel.cn/api/paas/v4" or "http://localhost:11434/v1"
    // work without having to type the full "/chat/completions" suffix.
    let path = url.pathname + url.search;
    if (!/\/chat\/completions\/?$/.test(url.pathname)) {
        path = path.replace(/\/+$/, '') + '/chat/completions';
    }
    return {
        protocol,
        host: url.hostname,
        port,
        path,
    };
}
/**
 * Singleton client for OpenAI-compatible chat completion APIs.
 *
 * The endpoint, model and API key are all read from user configuration,
 * so the extension works with DeepSeek, OpenAI, Ollama, LM Studio,
 * OpenRouter, or any other OpenAI-compatible provider.
 *
 * Uses a raw socket (tls/net) to bypass VSCode's @vscode/proxy-agent.
 * Supports optional HTTP CONNECT proxy tunneling for users behind firewalls.
 */
class DeepSeekClient {
    static instance;
    callTimestamps = [];
    MAX_CALLS_PER_MINUTE = 30;
    RATE_WINDOW_MS = 60_000;
    static getInstance() {
        if (!DeepSeekClient.instance) {
            DeepSeekClient.instance = new DeepSeekClient();
        }
        return DeepSeekClient.instance;
    }
    async translate(text, targetLanguage) {
        const clean = text.trim();
        if (!clean || clean.length < 10) {
            return clean;
        }
        if ((0, utils_1.containsCJK)(clean)) {
            return clean;
        }
        this.checkRateLimit();
        const input = (0, utils_1.estimatedTokens)(clean) > 2000 ? (0, utils_1.truncateText)(clean, 2000) : clean;
        return this.callAPI(input, targetLanguage);
    }
    /**
     * Lightweight connectivity test used by the settings webview.
     * Sends a tiny request and returns the model's short reply on success.
     * Does not touch the translation cache or rate limiter.
     */
    async testConnection(opts) {
        if (!opts.apiKey || !opts.apiKey.trim()) {
            throw new Error('API key is empty.');
        }
        const endpoint = parseEndpoint(opts.apiUrl || DEFAULT_API_URL);
        const proxyUrl = opts.proxyUrl
            || process.env.HTTPS_PROXY
            || process.env.https_proxy
            || process.env.HTTP_PROXY
            || process.env.http_proxy
            || '';
        const body = JSON.stringify({
            model: opts.model,
            messages: [
                { role: 'user', content: 'Reply with exactly: OK' },
            ],
            temperature: 0,
            // Reasoning models (e.g. deepseek-flash) spend tokens on hidden
            // "reasoning" before emitting any content, so a tiny budget can
            // produce an empty reply. 64 leaves room for both.
            max_tokens: Math.max(Math.min(opts.maxTokens || 64, 64), 64),
            stream: false,
        });
        if (proxyUrl) {
            return this.requestViaProxy(proxyUrl, endpoint, body, opts.apiKey);
        }
        return this.requestDirect(endpoint, body, opts.apiKey);
    }
    async callAPI(text, targetLanguage) {
        const config = (0, config_1.getConfig)();
        if (!config.apiKey) {
            throw new Error('API key not configured.');
        }
        const endpoint = parseEndpoint(config.apiUrl || DEFAULT_API_URL);
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
            `Translate the user's programming documentation from English into ${targetLanguage}.`,
            'The documentation may describe code in any programming language (Python, JavaScript, TypeScript, Go, Rust, Java, C#, C++, etc.).',
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
            ? `${text}\n\n翻译完成后，请在底部用围栏代码块额外提供 1-2 个简洁的使用示例（使用与该文档相同的编程语言）。`
            : text;
        const requestBody = JSON.stringify({
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: config.maxTokens,
            stream: false,
        });
        console.log('[Python Hover Translator] Connecting to', `${endpoint.protocol}//${endpoint.host}:${endpoint.port}${endpoint.path}`, useProxy ? `via proxy ${proxyUrl}` : '(direct)');
        if (useProxy) {
            return this.requestViaProxy(proxyUrl, endpoint, requestBody, config.apiKey);
        }
        return this.requestDirect(endpoint, requestBody, config.apiKey);
    }
    /** Build the raw HTTP request headers string. */
    buildRequestHead(endpoint, body, apiKey) {
        const defaultPort = endpoint.protocol === 'https:' ? 443 : 80;
        const hostHeader = endpoint.port === defaultPort
            ? endpoint.host
            : `${endpoint.host}:${endpoint.port}`;
        return [
            `POST ${endpoint.path} HTTP/1.1`,
            `Host: ${hostHeader}`,
            `Content-Type: application/json`,
            `Authorization: Bearer ${apiKey}`,
            `Content-Length: ${Buffer.byteLength(body)}`,
            `Connection: close`,
            '',
            '',
        ].join('\r\n');
    }
    /** Open a plain TCP or TLS socket depending on the endpoint protocol. */
    connectSocket(endpoint, onConnect, onError, onTimeout) {
        if (endpoint.protocol === 'http:') {
            const sock = net.connect({ host: endpoint.host, port: endpoint.port, timeout: 15_000 }, () => onConnect(sock));
            sock.on('error', onError);
            sock.on('timeout', onTimeout);
            return sock;
        }
        const sock = tls.connect({
            host: endpoint.host,
            port: endpoint.port,
            servername: endpoint.host,
            rejectUnauthorized: false,
            timeout: 15_000,
        }, () => onConnect(sock));
        sock.on('error', onError);
        sock.on('timeout', onTimeout);
        return sock;
    }
    /** Direct connection (no proxy). */
    requestDirect(endpoint, body, apiKey) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const socket = this.connectSocket(endpoint, (sock) => {
                sock.write(this.buildRequestHead(endpoint, body, apiKey));
                sock.write(body);
            }, (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(err);
            }, () => {
                if (settled) {
                    return;
                }
                settled = true;
                socket.destroy();
                reject(new Error('Connection timed out'));
            });
            const chunks = [];
            socket.on('data', (chunk) => chunks.push(chunk));
            socket.on('end', () => {
                if (settled) {
                    return;
                }
                settled = true;
                const raw = Buffer.concat(chunks).toString();
                this.processResponse(raw, resolve, reject);
            });
        });
    }
    /** HTTP CONNECT proxy tunnel → TLS/TCP over the tunnel. */
    requestViaProxy(proxyUrl, endpoint, body, apiKey) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let proxyHost;
            let proxyPort;
            try {
                const u = new URL(proxyUrl);
                proxyHost = u.hostname;
                proxyPort = parseInt(u.port || '7890', 10);
            }
            catch {
                reject(new Error('Invalid proxy URL: ' + proxyUrl));
                return;
            }
            const targetPort = endpoint.port;
            const targetHost = endpoint.host;
            // Step 1: connect to proxy
            const proxySocket = net.connect({ host: proxyHost, port: proxyPort, timeout: 15_000 }, () => {
                // Step 2: send CONNECT to establish tunnel
                proxySocket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
                    `Host: ${targetHost}:${targetPort}\r\n` +
                    `Proxy-Connection: Keep-Alive\r\n\r\n`);
            });
            let connectResponse = '';
            proxySocket.on('data', (chunk) => {
                connectResponse += chunk.toString();
                // Check if we got the full CONNECT response (ends with \r\n\r\n)
                if (!connectResponse.includes('\r\n\r\n')) {
                    return;
                }
                const statusLine = connectResponse.split('\r\n')[0];
                if (!statusLine.includes('200')) {
                    proxySocket.destroy();
                    if (!settled) {
                        settled = true;
                        reject(new Error(`Proxy rejected CONNECT: ${statusLine}`));
                    }
                    return;
                }
                // Step 3: upgrade tunnel to TLS (https) or use raw TCP (http)
                proxySocket.removeAllListeners('data');
                const requestHead = this.buildRequestHead(endpoint, body, apiKey);
                const onConnected = (socket) => {
                    socket.write(requestHead);
                    socket.write(body);
                };
                if (endpoint.protocol === 'http:') {
                    const socket = proxySocket;
                    onConnected(socket);
                    this.pipeResponse(socket, resolve, reject, () => settled, () => { settled = true; });
                    return;
                }
                const tlsSocket = tls.connect({
                    socket: proxySocket,
                    servername: targetHost,
                    rejectUnauthorized: false,
                    timeout: 15_000,
                }, () => onConnected(tlsSocket));
                this.pipeResponse(tlsSocket, resolve, reject, () => settled, () => { settled = true; });
            });
            proxySocket.on('error', (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(err);
            });
            proxySocket.on('timeout', () => {
                if (settled) {
                    return;
                }
                settled = true;
                proxySocket.destroy();
                reject(new Error('Proxy connection timed out'));
            });
        });
    }
    /** Attach end/error/timeout handlers that resolve/reject the request. */
    pipeResponse(socket, resolve, reject, isSettled, markSettled) {
        const chunks = [];
        socket.on('data', (chunk) => chunks.push(chunk));
        socket.on('end', () => {
            if (isSettled()) {
                return;
            }
            markSettled();
            const raw = Buffer.concat(chunks).toString();
            this.processResponse(raw, resolve, reject);
        });
        socket.on('error', (err) => {
            if (isSettled()) {
                return;
            }
            markSettled();
            reject(err);
        });
        socket.on('timeout', () => {
            if (isSettled()) {
                return;
            }
            markSettled();
            socket.destroy();
            reject(new Error('Connection timed out'));
        });
    }
    /**
     * Process raw HTTP response: extract body, sanitize, parse JSON.
     */
    processResponse(raw, resolve, reject) {
        console.log('[Python Hover Translator] Response received,', raw.length, 'bytes');
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
            let data;
            try {
                data = JSON.parse(cleanBody);
            }
            catch (parseErr) {
                console.error('[Python Hover Translator] JSON parse failed.');
                console.error('[Python Hover Translator] Body start:', cleanBody.slice(0, 300));
                console.error('[Python Hover Translator] Body end:', cleanBody.slice(-300));
                reject(parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
                return;
            }
            const choice = data.choices?.[0];
            const content = choice?.message?.content;
            const reasoning = choice?.message?.reasoning_content;
            if (!content) {
                // Surface API-level errors (e.g. invalid key/model) when present
                const apiError = data.error;
                if (apiError?.message) {
                    reject(new Error(apiError.message));
                    return;
                }
                // Reasoning model used up the budget on hidden reasoning but returned
                // no visible content. The connection itself succeeded; fall back to the
                // reasoning text so the caller gets *something* useful.
                if (reasoning && reasoning.trim()) {
                    reject(new Error('API returned only reasoning content (increase maxTokens)'));
                    return;
                }
                reject(new Error('API returned empty response body'));
                return;
            }
            console.log('[Python Hover Translator] Translation OK, tokens:', data.usage?.total_tokens);
            resolve(content.trim());
        }
        catch (e) {
            console.error('[Python Hover Translator] Parse error. Response start:', raw.slice(0, 500));
            reject(e instanceof Error ? e : new Error(String(e)));
        }
    }
    /** Extract HTTP body from raw response, handling chunked encoding. */
    extractHttpBody(raw) {
        const headerEnd = raw.indexOf('\r\n\r\n');
        if (headerEnd < 0) {
            return '';
        }
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
    decodeChunked(raw) {
        const lines = raw.split('\r\n');
        const parts = [];
        let expectingData = false;
        for (const line of lines) {
            if (!expectingData) {
                const size = parseInt(line, 16);
                if (size === 0 || isNaN(size)) {
                    break;
                }
                expectingData = true;
            }
            else {
                parts.push(line);
                expectingData = false;
            }
        }
        return parts.join('');
    }
    /**
     * Escape control characters inside JSON string values.
     */
    sanitizeJson(json) {
        let result = '';
        let inString = false;
        let escape = false;
        for (let i = 0; i < json.length; i++) {
            const ch = json[i];
            const code = ch.charCodeAt(0);
            if (escape) {
                escape = false;
                result += ch;
                continue;
            }
            if (ch === '\\' && inString) {
                escape = true;
                result += ch;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                result += ch;
                continue;
            }
            if (inString && code < 0x20) {
                if (ch === '\n') {
                    result += '\\n';
                }
                else if (ch === '\r') {
                    result += '\\r';
                }
                else if (ch === '\t') {
                    result += '\\t';
                }
                else {
                    result += ' ';
                }
                continue;
            }
            result += ch;
        }
        return result;
    }
    checkRateLimit() {
        const now = Date.now();
        this.callTimestamps = this.callTimestamps.filter((ts) => now - ts < this.RATE_WINDOW_MS);
        if (this.callTimestamps.length >= this.MAX_CALLS_PER_MINUTE) {
            throw new Error('Rate limit reached.');
        }
        this.callTimestamps.push(now);
    }
}
exports.DeepSeekClient = DeepSeekClient;
//# sourceMappingURL=deepseekClient.js.map