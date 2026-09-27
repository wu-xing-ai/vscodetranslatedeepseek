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
exports.getApiKey = void 0;
exports.initSecrets = initSecrets;
exports.getUserApiKey = getUserApiKey;
exports.saveApiKey = saveApiKey;
exports.clearApiKey = clearApiKey;
const vscode = __importStar(require("vscode"));
const SECRET_KEY = 'pythonHoverTranslator.apiKey';
const CONFIG_SECTION = 'pythonHoverTranslator';
let cachedApiKey = '';
let contextRef;
/**
 * Load the API key from secure storage into memory.
 * Must be awaited during activation so that the synchronous hover path
 * (`hasApiKey()` / `getConfig()`) can read it without awaiting.
 */
async function initSecrets(context) {
    contextRef = context;
    try {
        cachedApiKey = (await context.secrets.get(SECRET_KEY)) || '';
    }
    catch (err) {
        console.warn('[Python Hover Translator] Failed to read secret storage:', err);
        cachedApiKey = '';
    }
}
/**
 * Return the API key.
 * Prefers the securely stored secret; falls back to the legacy plain-text
 * `pythonHoverTranslator.apiKey` setting for backward compatibility.
 */
function getUserApiKey() {
    if (cachedApiKey && cachedApiKey.trim().length > 0) {
        return cachedApiKey;
    }
    return vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get('apiKey', '');
}
/** Alias kept for callers that just want the effective key. */
exports.getApiKey = getUserApiKey;
/** Persist the API key to secure storage (and mirror to memory). */
async function saveApiKey(key) {
    cachedApiKey = key;
    if (!contextRef) {
        throw new Error('Secret storage not initialised');
    }
    await contextRef.secrets.store(SECRET_KEY, key);
}
/** Remove the API key from secure storage. */
async function clearApiKey() {
    cachedApiKey = '';
    if (contextRef) {
        await contextRef.secrets.delete(SECRET_KEY);
    }
}
//# sourceMappingURL=secrets.js.map