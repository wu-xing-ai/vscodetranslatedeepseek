"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekClient = void 0;
const config_1 = require("./config");
const utils_1 = require("./utils");
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
/**
 * Singleton client for the DeepSeek API.
 *
 * Bypass strategy: VSCode's @vscode/proxy-agent intercepts http/https/fetch
 * at the module level. We work around this by temporarily clearing the proxy
 * environment variables and using Node's built-in undici fetch (available
 * in Node 20+) which respects a per-request dispatcher.
 *
 * For WSL Remote setups: the VSCode server may inject proxy settings via
 * http.proxy. The key insight is that setting NO_PROXY="*" instructs the
 * VSCode proxy agent to skip proxying for all hosts, then we can use
 * a direct fetch with our own dispatcher.
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
        const body = {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 2048,
            stream: false,
        };
        console.log('[Python Hover Translator] Calling DeepSeek API...');
        try {
            // Strategy: save and clear proxy env vars so VSCode's proxy-agent
            // doesn't intercept, then restore after the call
            const savedVars = this.clearProxyEnv();
            let result;
            try {
                result = await this.doFetch(DEEPSEEK_API_URL, body, config.apiKey);
            }
            finally {
                this.restoreProxyEnv(savedVars);
            }
            return result;
        }
        catch (err) {
            const msg = err.message || String(err);
            console.error('[Python Hover Translator] API call failed:', msg);
            if (msg.includes('fetch failed') ||
                msg.includes('ENOTFOUND') ||
                msg.includes('ECONNREFUSED')) {
                console.error('[Python Hover Translator] 网络不通。WSL 代理: http://172.27.208.1:7890，', 'Windows 代理: http://127.0.0.1:7890');
            }
            throw err;
        }
    }
    /**
     * Save current proxy env vars and clear them so VSCode's proxy-agent
     * passes through traffic directly instead of routing to a dead proxy.
     */
    clearProxyEnv() {
        const vars = [
            'HTTP_PROXY', 'http_proxy',
            'HTTPS_PROXY', 'https_proxy',
            'NO_PROXY', 'no_proxy',
        ];
        const saved = {};
        for (const v of vars) {
            saved[v] = process.env[v];
            delete process.env[v];
        }
        // Tell VSCode's proxy-agent to skip ALL hosts
        process.env.NO_PROXY = '*';
        return saved;
    }
    restoreProxyEnv(saved) {
        for (const [k, v] of Object.entries(saved)) {
            if (v !== undefined) {
                process.env[k] = v;
            }
            else {
                delete process.env[k];
            }
        }
    }
    /**
     * Perform the actual fetch. With proxy env vars cleared, VSCode's
     * proxy-agent should not intercept this call.
     */
    async doFetch(url, body, apiKey) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            const errText = await response.text().catch(() => 'unknown');
            throw new Error(`API returned ${response.status}: ${errText.slice(0, 300)}`);
        }
        const data = (await response.json());
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('DeepSeek returned an empty response');
        }
        console.log('[Python Hover Translator] Translation OK, tokens:', data.usage?.total_tokens);
        return content.trim();
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