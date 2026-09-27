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
exports.getConfig = getConfig;
exports.isEnabled = isEnabled;
exports.hasApiKey = hasApiKey;
const vscode = __importStar(require("vscode"));
const secrets_1 = require("./secrets");
const builtin_1 = require("./builtin");
const CONFIG_SECTION = 'pythonHoverTranslator';
/** Read all configuration values at once. */
function getConfig() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    // When no user key is configured we fall back to the shared free key,
    // which is only valid for the free 智谱 glm-4-flash model. In that case
    // ignore the user's url/model/tokens so requests always succeed.
    const usingBuiltin = (0, secrets_1.isUsingBuiltinKey)();
    return {
        enabled: cfg.get('enabled', true),
        apiKey: (0, secrets_1.getApiKey)(),
        apiUrl: usingBuiltin
            ? builtin_1.BUILTIN_API_URL
            : cfg.get('apiUrl', 'https://api.deepseek.com/v1/chat/completions'),
        targetLanguage: cfg.get('targetLanguage', 'Chinese (Simplified)'),
        cacheSize: cfg.get('cacheSize', 200),
        model: usingBuiltin ? builtin_1.BUILTIN_MODEL : cfg.get('model', 'deepseek-chat'),
        maxTokens: usingBuiltin
            ? builtin_1.BUILTIN_MAX_TOKENS
            : cfg.get('maxTokens', 1024),
        showOriginal: cfg.get('showOriginal', true),
        showExamples: cfg.get('showExamples', true),
        proxyUrl: cfg.get('proxyUrl', ''),
    };
}
/** Quick check called on every hover before doing any work. */
function isEnabled() {
    return vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get('enabled', true);
}
/** Check if user has configured an API key. */
function hasApiKey() {
    const key = (0, secrets_1.getApiKey)();
    return !!key && key.trim().length > 0;
}
//# sourceMappingURL=config.js.map