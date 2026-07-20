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
const config_1 = require("./config");
const utils_1 = require("./utils");
const DEEPSEEK_HOST = 'api.deepseek.com';
const DEEPSEEK_PATH = '/v1/chat/completions';
/**
 * Singleton client for the DeepSeek API.
 *
 * Uses raw tls.connect() to bypass ALL VSCode proxy interception.
 * VSCode's @vscode/proxy-agent patches fetch(), http.request(),
 * https.request(), and even the Agent prototypes. The ONLY thing it
 * can't patch is tls.connect() — the lowest level TLS API.
 *
 * We construct HTTP/1.1 requests manually over the TLS socket.
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
    async callAPI(text, targetLanguage) {
        const config = (0, config_1.getConfig)();
        if (!config.apiKey) {
            throw new Error('DeepSeek API key not configured.');
        }
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
        const httpRequest = [
            `POST ${DEEPSEEK_PATH} HTTP/1.1`,
            `Host: ${DEEPSEEK_HOST}`,
            `Content-Type: application/json`,
            `Authorization: Bearer ${config.apiKey}`,
            `Content-Length: ${Buffer.byteLength(requestBody)}`,
            `Connection: close`,
            '',
            '',
        ].join('\r\n');
        console.log('[Python Hover Translator] Connecting raw TLS to', DEEPSEEK_HOST);
        return new Promise((resolve, reject) => {
            let settled = false;
            const sock = tls.connect({
                host: DEEPSEEK_HOST,
                port: 443,
                servername: DEEPSEEK_HOST,
                rejectUnauthorized: false,
                timeout: 15_000,
            }, () => {
                // TLS handshake done — send HTTP request
                sock.write(httpRequest);
                sock.write(requestBody);
                // Don't call end() — let the server close after responding
            });
            const chunks = [];
            sock.on('data', (chunk) => {
                chunks.push(chunk);
            });
            sock.on('end', () => {
                if (settled) {
                    return;
                }
                settled = true;
                const raw = Buffer.concat(chunks).toString();
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
                    // Sanitize: escape control characters inside JSON string values
                    const cleanBody = this.sanitizeJson(body);
                    let data;
                    try {
                        data = JSON.parse(cleanBody);
                    }
                    catch (parseErr) {
                        console.error('[Python Hover Translator] JSON parse failed.');
                        console.error('[Python Hover Translator] Body start:', cleanBody.slice(0, 300));
                        console.error('[Python Hover Translator] Body end:', cleanBody.slice(-300));
                        reject(parseErr);
                        return;
                    }
                    const content = data.choices?.[0]?.message?.content;
                    if (!content) {
                        reject(new Error('DeepSeek returned empty response body'));
                        return;
                    }
                    console.log('[Python Hover Translator] Translation OK, tokens:', data.usage?.total_tokens);
                    resolve(content.trim());
                }
                catch (e) {
                    console.error('[Python Hover Translator] Parse error. Response start:', raw.slice(0, 500));
                    reject(e);
                }
            });
            sock.on('error', (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(err);
            });
            sock.on('timeout', () => {
                if (settled) {
                    return;
                }
                settled = true;
                sock.destroy();
                reject(new Error('TLS connection timed out'));
            });
        });
    }
    /**
     * Extract the HTTP body from a raw HTTP/1.1 response string.
     * Handles both Content-Length and Transfer-Encoding: chunked.
     */
    extractHttpBody(raw) {
        const headerEnd = raw.indexOf('\r\n\r\n');
        if (headerEnd < 0) {
            return '';
        }
        const headerSection = raw.slice(0, headerEnd);
        const afterHeaders = raw.slice(headerEnd + 4);
        // Check for chunked transfer encoding
        if (/transfer-encoding:\s*chunked/i.test(headerSection)) {
            return this.decodeChunked(afterHeaders);
        }
        // For Content-Length, the body is just after headers
        return afterHeaders;
    }
    /**
     * Decode HTTP chunked transfer encoding.
     * Format: <hex-size>\r\n<data>\r\n ... 0\r\n\r\n
     *
     * More robust: split by \r\n, identify chunk-size lines (pure hex),
     * and collect the data lines that follow each size.
     */
    decodeChunked(raw) {
        const lines = raw.split('\r\n');
        const parts = [];
        let expectingData = false;
        for (const line of lines) {
            if (!expectingData) {
                // This line should be a chunk size in hex
                const size = parseInt(line, 16);
                if (size === 0 || isNaN(size)) {
                    break; // Last chunk or malformed
                }
                expectingData = true;
            }
            else {
                // This line is the chunk data
                parts.push(line);
                expectingData = false;
            }
        }
        return parts.join('');
    }
    /**
     * Sanitize a JSON string by replacing unescaped control characters
     * (newlines, tabs, etc.) that may appear inside JSON string values
     * from DeepSeek's translated text output.
     *
     * We replace literal control chars with their escaped equivalents
     * ONLY when they appear inside JSON string values (between quotes).
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
            // Replace control characters inside JSON strings
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
                } // Replace other control chars with space
                continue;
            }
            result += ch;
        }
        return result;
    }
    /**
     * Extract the first complete JSON object from a string.
     * Uses brace counting to handle nested objects/strings.
     */
    extractFirstJson(raw) {
        const start = raw.indexOf('{');
        if (start < 0) {
            return null;
        }
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < raw.length; i++) {
            const ch = raw[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\' && inString) {
                escape = true;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }
            if (ch === '{') {
                depth++;
            }
            if (ch === '}') {
                depth--;
                if (depth === 0) {
                    return raw.slice(start, i + 1);
                }
            }
        }
        return null; // Unclosed brace
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