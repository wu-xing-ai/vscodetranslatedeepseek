import * as vscode from 'vscode';
import { DeepSeekClient } from './deepseekClient';
import { getApiKey, saveApiKey, clearApiKey } from './secrets';

const CONFIG_SECTION = 'pythonHoverTranslator';

/** Preset providers shown as one-click buttons in the UI. */
interface Preset {
  id: string;
  name: string;
  apiUrl: string;
  model: string;
  maxTokens: number;
  keyUrl: string;
  note?: string;
}

const PRESETS: Preset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 2048,
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM（免费）',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    maxTokens: 1024,
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    note: 'glm-4-flash 免费可用',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    maxTokens: 2048,
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat',
    maxTokens: 2048,
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'ollama',
    name: 'Ollama（本地）',
    apiUrl: 'http://localhost:11434/v1/chat/completions',
    model: 'qwen2.5:7b',
    maxTokens: 2048,
    keyUrl: 'https://ollama.com/download',
    note: '本地运行，Key 可随意填（如 ollama）',
  },
  {
    id: 'custom',
    name: '自定义',
    apiUrl: '',
    model: '',
    maxTokens: 2048,
    keyUrl: '',
    note: '任意 OpenAI 兼容接口',
  },
];

/**
 * Manages the single settings webview panel.
 */
export class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;
  private static readonly viewType = 'pythonHoverTranslator.settings';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message: { type: string; payload?: Record<string, unknown> }) => {
        switch (message.type) {
          case 'ready':
            await this.postState();
            break;
          case 'save':
            await this.handleSave(message.payload || {});
            break;
          case 'test':
            await this.handleTest(message.payload || {});
            break;
          case 'clearKey':
            await clearApiKey();
            await this.postState();
            this.panel.webview.postMessage({
              type: 'toast',
              level: 'info',
              text: 'API Key 已清除',
            });
            break;
          case 'openExternal':
            if (typeof message.payload?.url === 'string') {
              vscode.env.openExternal(vscode.Uri.parse(message.payload.url as string));
            }
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri): SettingsPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel.panel.reveal(column);
      SettingsPanel.currentPanel.postState();
      return SettingsPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      'AI Translate 设置',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    return SettingsPanel.currentPanel;
  }

  /** Read current config + key and push it to the webview. */
  private async postState(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const key = getApiKey();
    await this.panel.webview.postMessage({
      type: 'state',
      payload: {
        enabled: cfg.get<boolean>('enabled', true),
        apiUrl: cfg.get<string>('apiUrl', 'https://api.deepseek.com/v1/chat/completions'),
        model: cfg.get<string>('model', 'deepseek-chat'),
        maxTokens: cfg.get<number>('maxTokens', 1024),
        targetLanguage: cfg.get<string>('targetLanguage', 'Chinese (Simplified)'),
        showOriginal: cfg.get<boolean>('showOriginal', true),
        showExamples: cfg.get<boolean>('showExamples', true),
        proxyUrl: cfg.get<string>('proxyUrl', ''),
        // Never send the full key back; only whether it exists + a masked hint.
        hasKey: !!key && key.trim().length > 0,
        keyHint: SettingsPanel.maskKey(key),
      },
    });
  }

  private static maskKey(key: string): string {
    if (!key) { return ''; }
    if (key.length <= 8) { return '••••••'; }
    return key.slice(0, 4) + '••••••' + key.slice(-4);
  }

  private async handleSave(payload: Record<string, unknown>): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const target = vscode.ConfigurationTarget.Global;

    const asBool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    const asNum = (v: unknown, d: number) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(n) ? d : n;
    };
    const asStr = (v: unknown, d: string) => (typeof v === 'string' ? v : d);

    try {
      await cfg.update('enabled', asBool(payload.enabled, true), target);
      await cfg.update('apiUrl', asStr(payload.apiUrl, '').trim(), target);
      await cfg.update('model', asStr(payload.model, '').trim(), target);
      await cfg.update(
        'maxTokens',
        Math.max(64, Math.min(32768, asNum(payload.maxTokens, 1024))),
        target
      );
      await cfg.update(
        'targetLanguage',
        asStr(payload.targetLanguage, 'Chinese (Simplified)'),
        target
      );
      await cfg.update('showOriginal', asBool(payload.showOriginal, true), target);
      await cfg.update('showExamples', asBool(payload.showExamples, true), target);
      await cfg.update('proxyUrl', asStr(payload.proxyUrl, '').trim(), target);

      // Only overwrite the stored key if the user actually typed a new one.
      const newKey = asStr(payload.apiKey, '').trim();
      if (newKey) {
        await saveApiKey(newKey);
      }

      await this.postState();
      this.panel.webview.postMessage({
        type: 'toast',
        level: 'success',
        text: '设置已保存',
      });
    } catch (err) {
      this.panel.webview.postMessage({
        type: 'toast',
        level: 'error',
        text: '保存失败：' + (err as Error).message,
      });
    }
  }

  private async handleTest(payload: Record<string, unknown>): Promise<void> {
    const apiKey = (typeof payload.apiKey === 'string' && payload.apiKey.trim())
      ? (payload.apiKey as string).trim()
      : getApiKey();

    if (!apiKey) {
      this.panel.webview.postMessage({
        type: 'testResult',
        ok: false,
        text: '请先填写 API Key',
      });
      return;
    }

    this.panel.webview.postMessage({ type: 'testStart' });

    try {
      const reply = await DeepSeekClient.getInstance().testConnection({
        apiKey,
        apiUrl: typeof payload.apiUrl === 'string' ? payload.apiUrl : '',
        model: typeof payload.model === 'string' ? payload.model : '',
        maxTokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 16,
        proxyUrl: typeof payload.proxyUrl === 'string' ? payload.proxyUrl : '',
      });
      this.panel.webview.postMessage({
        type: 'testResult',
        ok: true,
        text: '连接成功！模型回复：' + reply.slice(0, 100),
      });
    } catch (err) {
      this.panel.webview.postMessage({
        type: 'testResult',
        ok: false,
        text: '连接失败：' + (err as Error).message,
      });
    }
  }

  public dispose(): void {
    SettingsPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }

  /** Build the webview HTML (self-contained, no external resources). */
  private getHtml(): string {
    const presetsJson = JSON.stringify(PRESETS);
    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Translate 设置</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 20px 26px 60px;
    max-width: 720px;
    margin: 0 auto;
    line-height: 1.5;
  }
  h1 { font-size: 1.35em; margin: 0 0 4px; }
  .sub { opacity: .65; margin-bottom: 20px; font-size: .9em; }
  fieldset {
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35));
    border-radius: 6px;
    padding: 14px 16px 18px;
    margin: 0 0 18px;
  }
  legend { padding: 0 6px; font-weight: 600; opacity: .9; }
  label { display: block; margin: 12px 0 4px; font-weight: 500; }
  .hint { font-size: .82em; opacity: .6; margin-top: 3px; }
  input[type=text], input[type=password], input[type=number], select {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 9px;
    border-radius: 4px;
    border: 1px solid var(--vscode-input-border, rgba(128,128,128,.4));
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    font-family: inherit;
    font-size: inherit;
  }
  input:focus, select:focus { outline: 1px solid var(--vscode-focusBorder); }
  .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
  .preset {
    padding: 7px 13px;
    border-radius: 20px;
    border: 1px solid var(--vscode-button-secondaryBackground, rgba(128,128,128,.4));
    background: var(--vscode-button-secondaryBackground, rgba(128,128,128,.15));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    cursor: pointer;
    font-size: .9em;
  }
  .preset:hover { filter: brightness(1.2); }
  .preset.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
  }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .key-wrap { display: flex; gap: 8px; }
  .key-wrap input { flex: 1; }
  .checkbox { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
  .checkbox input { width: auto; }
  button.action {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }
  button.action:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground, rgba(128,128,128,.2));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  }
  button.secondary:hover { filter: brightness(1.15); }
  button:disabled { opacity: .5; cursor: default; }
  .footer { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
  .bar { margin-left: auto; font-size: .9em; }
  .status-ok { color: var(--vscode-testing-iconPassed, #3fb950); }
  .status-err { color: var(--vscode-testing-iconFailed, #f85149); }
  .note { font-size: .85em; opacity: .75; margin-top: 8px; }
  a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  .toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    padding: 10px 18px; border-radius: 6px; font-size: .9em;
    background: var(--vscode-notifications-background, #333);
    color: var(--vscode-notifications-foreground, #fff);
    border: 1px solid var(--vscode-notifications-border, rgba(128,128,128,.4));
    opacity: 0; transition: opacity .25s; pointer-events: none;
  }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
  <h1>AI Translate 设置</h1>
  <div class="sub">悬停翻译任意语言的文档 · 支持任意 OpenAI 兼容接口</div>

  <fieldset>
    <legend>① 选择服务商</legend>
    <div class="presets" id="presets"></div>
    <div class="note" id="presetNote"></div>
  </fieldset>

  <fieldset>
    <legend>② 连接配置</legend>

    <label for="apiKey">API Key</label>
    <div class="key-wrap">
      <input id="apiKey" type="password" placeholder="粘贴你的 API Key" autocomplete="off" spellcheck="false" />
      <button class="action secondary" id="toggleKey" type="button">显示</button>
      <button class="action secondary" id="clearKey" type="button">清除</button>
    </div>
    <div class="hint" id="keyHint"></div>

    <label for="apiUrl">API 地址（Base URL 或完整地址均可，自动补 /chat/completions）</label>
    <input id="apiUrl" type="text" spellcheck="false" placeholder="https://api.deepseek.com/v1/chat/completions" />

    <div class="row">
      <div>
        <label for="model">模型名</label>
        <input id="model" type="text" spellcheck="false" placeholder="deepseek-chat" />
      </div>
      <div>
        <label for="maxTokens">最大回复 tokens</label>
        <input id="maxTokens" type="number" min="64" max="32768" step="64" />
      </div>
    </div>

    <label for="proxyUrl">代理（可选）</label>
    <input id="proxyUrl" type="text" spellcheck="false" placeholder="http://127.0.0.1:7890" />
    <div class="hint">留空则使用系统 HTTPS_PROXY 环境变量或直连。</div>

    <div class="footer">
      <button class="action secondary" id="testBtn" type="button">测试连接</button>
      <span class="bar" id="testStatus"></span>
    </div>
  </fieldset>

  <fieldset>
    <legend>③ 翻译选项</legend>

    <label for="targetLanguage">目标语言</label>
    <select id="targetLanguage">
      <option value="Chinese (Simplified)">简体中文</option>
      <option value="Chinese (Traditional)">繁體中文</option>
      <option value="Japanese">日本語</option>
      <option value="Korean">한국어</option>
    </select>

    <div class="checkbox">
      <input id="enabled" type="checkbox" />
      <label for="enabled" style="margin:0">启用悬停翻译</label>
    </div>
    <div class="checkbox">
      <input id="showOriginal" type="checkbox" />
      <label for="showOriginal" style="margin:0">显示原始英文文档</label>
    </div>
    <div class="checkbox">
      <input id="showExamples" type="checkbox" />
      <label for="showExamples" style="margin:0">附加使用示例</label>
    </div>
  </fieldset>

  <div class="footer">
    <button class="action" id="saveBtn" type="button">保存设置</button>
    <span class="bar" id="saveStatus"></span>
  </div>

  <div class="toast" id="toast"></div>

<script>
  const vscode = acquireVsCodeApi();
  const PRESETS = ${presetsJson};
  let state = {};
  let selectedPreset = null;

  const $ = (id) => document.getElementById(id);

  function renderPresets() {
    const box = $('presets');
    box.innerHTML = '';
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'preset' + (selectedPreset === p.id ? ' active' : '');
      b.textContent = p.name;
      b.type = 'button';
      b.onclick = () => {
        selectedPreset = p.id;
        if (p.apiUrl) $('apiUrl').value = p.apiUrl;
        if (p.model) $('model').value = p.model;
        if (p.maxTokens) $('maxTokens').value = p.maxTokens;
        $('presetNote').innerHTML = p.keyUrl
          ? '获取 Key：<a id="keyLink">' + p.keyUrl + '</a>' + (p.note ? ' · ' + p.note : '')
          : (p.note || '');
        const link = $('keyLink');
        if (link) link.onclick = () => vscode.postMessage({ type: 'openExternal', payload: { url: p.keyUrl } });
        renderPresets();
      };
      box.appendChild(b);
    });
  }

  function applyState(s) {
    state = s;
    $('apiKey').value = '';
    $('apiKey').placeholder = s.hasKey ? '已保存（如需修改请重新输入）' : '粘贴你的 API Key';
    $('keyHint').textContent = s.hasKey ? '当前：' + s.keyHint + '（安全存储于系统密钥库）' : '尚未配置 API Key';
    $('apiUrl').value = s.apiUrl || '';
    $('model').value = s.model || '';
    $('maxTokens').value = s.maxTokens || 1024;
    $('targetLanguage').value = s.targetLanguage || 'Chinese (Simplified)';
    $('proxyUrl').value = s.proxyUrl || '';
    $('enabled').checked = !!s.enabled;
    $('showOriginal').checked = !!s.showOriginal;
    $('showExamples').checked = !!s.showExamples;
  }

  function getPayload() {
    return {
      apiKey: $('apiKey').value.trim(),
      apiUrl: $('apiUrl').value.trim(),
      model: $('model').value.trim(),
      maxTokens: parseInt($('maxTokens').value, 10),
      targetLanguage: $('targetLanguage').value,
      proxyUrl: $('proxyUrl').value.trim(),
      enabled: $('enabled').checked,
      showOriginal: $('showOriginal').checked,
      showExamples: $('showExamples').checked,
    };
  }

  function toast(text, level) {
    const t = $('toast');
    t.textContent = text;
    t.className = 'toast show';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = 'toast'; }, 2500);
  }

  $('saveBtn').onclick = () => {
    $('saveStatus').textContent = '';
    vscode.postMessage({ type: 'save', payload: getPayload() });
  };

  $('testBtn').onclick = () => {
    $('testStatus').textContent = '';
    vscode.postMessage({ type: 'test', payload: getPayload() });
  };

  $('toggleKey').onclick = () => {
    const el = $('apiKey');
    const show = el.type === 'password';
    el.type = show ? 'text' : 'password';
    $('toggleKey').textContent = show ? '隐藏' : '显示';
  };

  $('clearKey').onclick = () => vscode.postMessage({ type: 'clearKey' });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'state':
        applyState(msg.payload);
        break;
      case 'testStart':
        $('testBtn').disabled = true;
        $('testStatus').textContent = '测试中…';
        $('testStatus').className = 'bar';
        break;
      case 'testResult':
        $('testBtn').disabled = false;
        $('testStatus').textContent = (msg.ok ? '✓ ' : '✗ ') + msg.text;
        $('testStatus').className = 'bar ' + (msg.ok ? 'status-ok' : 'status-err');
        break;
      case 'toast':
        toast(msg.text, msg.level);
        break;
    }
  });

  renderPresets();
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}
