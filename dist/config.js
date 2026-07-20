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
const CONFIG_SECTION = 'pythonHoverTranslator';
/** Read all configuration values at once. */
function getConfig() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
        enabled: cfg.get('enabled', true),
        apiKey: cfg.get('apiKey', ''),
        targetLanguage: cfg.get('targetLanguage', 'Chinese (Simplified)'),
        cacheSize: cfg.get('cacheSize', 200),
        model: cfg.get('model', 'deepseek-chat'),
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
    const key = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get('apiKey', '');
    return !!key && key.trim().length > 0;
}
//# sourceMappingURL=config.js.map