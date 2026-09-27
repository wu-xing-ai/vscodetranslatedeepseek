# AI Translate

VSCode 插件，鼠标悬停到任意语言的函数/类/模块上时，自动调用 AI API 将英文文档翻译成中文，并附带使用示例。

支持 **Python、TypeScript、JavaScript、Go、Rust、Java、C#、C++** 等所有有 hover 文档的语言。

兼容**任意 OpenAI 格式的 API**：DeepSeek、OpenAI、OpenRouter、Ollama、LM Studio、通义千问等，可自定义 **模型名、URL 和 Key**。

---

## ⚡ 快速开始（零配置，开箱即用）

> **装完就能用，不用填任何 Key！** 插件内置了免费的智谱 `glm-4-flash` 额度，安装后直接悬停即可翻译。

想换成自己的模型（DeepSeek / OpenAI / 本地 Ollama 等）？

**按 `Ctrl+Shift+P`（macOS 为 `Cmd+Shift+P`）→ 输入 `AI Translate` → 选择：**

```
AI Hover Translator: Open Settings
```

在可视化面板里：选服务商 → 粘贴 Key → **测试连接** → 保存。

---

## 效果预览

鼠标悬停到 `torch.arange` 上时：

**安装前**（仅英文）：

```
(function) def arange(end, *, out=None, dtype=None, ...) -> Tensor
Returns a 1-D tensor with values from the interval [start, end)...
```

**安装后**（英文 + 中文翻译 + 示例）：

```
(function) def arange(end, *, out=None, dtype=None, ...) -> Tensor
Returns a 1-D tensor with values from the interval [start, end)...

────────────────────────────

### 简体中文 翻译

返回一个一维张量，其值来自区间 [start, end) ...

使用示例：

​```python
import torch
torch.arange(0, 10, 2)  # tensor([0, 2, 4, 6, 8])
​```
```

## 安装方式

### 方式一：安装 .vsix 包（推荐）

从 [GitHub Releases](https://github.com/wu-xing-ai/vscodetranslatedeepseek/releases) 下载 `aitranslate-0.1.0.vsix`，然后：

```bash
code --install-extension aitranslate-0.1.0.vsix
```

或者在 VSCode 中：`Ctrl+Shift+P` → `Extensions: Install from VSIX...` → 选择文件。

### 方式二：从源码运行

```bash
# 1. 克隆仓库
git clone https://github.com/wu-xing-ai/vscodetranslatedeepseek.git
cd vscodetranslatedeepseek

# 2. 安装依赖（需要 Node.js 18+）
npm install

# 3. 编译
bash build.sh

# 4. 在 VSCode 中打开该文件夹，按 F5 启动调试
```

## 可视化配置面板

安装后按 `Ctrl+Shift+P`（macOS 为 `Cmd+Shift+P`）输入 **AI Translate**，选择：

```
AI Hover Translator: Open Settings
```

打开可视化面板，一键完成配置：

1. **选择服务商** — DeepSeek / 智谱 GLM（免费）/ OpenAI / OpenRouter / Ollama / 自定义，点一下自动填好地址和模型
2. **粘贴 API Key** — 点「显示」可查看，点「清除」可删除
3. **点「测试连接」** — 立即验证 Key、地址、模型是否正确，不用等悬停
4. **点「保存设置」** — 完成

> 🔒 API Key 保存在操作系统密钥库（VS Code SecretStorage），**不会明文写入 `settings.json`，也不会上传到设置同步云端**。

### 关于内置免费额度

未配置自己的 Key 时，插件会使用**内置的共享免费额度**（智谱 `glm-4-flash`）：

- ✅ 开箱即用，装完直接悬停就能翻译，无需任何配置
- ⚠️ 为保护共享额度，内置额度**仅限免费的 `glm-4-flash` 模型**（忽略自定义 URL/模型）
- 🔒 内置 Key 只写在插件代码里，**永不写入 `settings.json`**，因此不会被同步到你的云端账号
- 💡 想要更强的模型（DeepSeek / GPT / 本地模型）或更高频使用，请配置**自己的 Key**

## 配置（手动 / settings.json）

如果偏好手动编辑 `settings.json`，配置项前缀为 `pythonHoverTranslator`：

### 可选：API Key 与 API URL

> 不配置也可用（走内置免费额度）。以下为使用自己账号时的配置。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `pythonHoverTranslator.apiKey` | (空) | 你的 API Key（留空则用内置免费额度） |
| `pythonHoverTranslator.apiUrl` | `https://api.deepseek.com/v1/chat/completions` | API 地址（OpenAI 兼容） |
| `pythonHoverTranslator.model` | `deepseek-chat` | 模型名 |

```json
{
  "pythonHoverTranslator.apiKey": "sk-你的-key",
  "pythonHoverTranslator.apiUrl": "https://api.deepseek.com/v1/chat/completions",
  "pythonHoverTranslator.model": "deepseek-chat"
}
```

DeepSeek Key 获取地址：https://platform.deepseek.com/api_keys

#### 其他服务示例

OpenAI：

```json
{
  "pythonHoverTranslator.apiKey": "sk-...",
  "pythonHoverTranslator.apiUrl": "https://api.openai.com/v1/chat/completions",
  "pythonHoverTranslator.model": "gpt-4o-mini"
}
```

本地 Ollama（无需 Key，可填任意非空字符串）：

```json
{
  "pythonHoverTranslator.apiKey": "ollama",
  "pythonHoverTranslator.apiUrl": "http://localhost:11434/v1/chat/completions",
  "pythonHoverTranslator.model": "qwen2.5:7b"
}
```

OpenRouter：

```json
{
  "pythonHoverTranslator.apiKey": "sk-or-...",
  "pythonHoverTranslator.apiUrl": "https://openrouter.ai/api/v1/chat/completions",
  "pythonHoverTranslator.model": "deepseek/deepseek-chat"
}
```

智谱 GLM（可填 base URL 或完整地址，插件会自动补 `/chat/completions`）：

```json
{
  "pythonHoverTranslator.apiKey": "你的智谱-key",
  "pythonHoverTranslator.apiUrl": "https://open.bigmodel.cn/api/paas/v4",
  "pythonHoverTranslator.model": "glm-4-flash",
  "pythonHoverTranslator.maxTokens": 1024
}
```

> 注意：`GLM-4V-Flash` 是视觉模型，纯文本翻译时可能重复输出，建议用 `glm-4-flash`。
> 某些模型对 `max_tokens` 有上限（如 `GLM-4V-Flash` 最大 1024），可用 `pythonHoverTranslator.maxTokens` 调整。

### 可选配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `pythonHoverTranslator.enabled` | `true` | 开关翻译 |
| `pythonHoverTranslator.targetLanguage` | `Chinese (Simplified)` | 目标语言 |
| `pythonHoverTranslator.cacheSize` | `200` | 缓存条数（LRU 淘汰） |
| `pythonHoverTranslator.showOriginal` | `true` | 显示原始英文 |
| `pythonHoverTranslator.showExamples` | `true` | 附带代码示例 |
| `pythonHoverTranslator.maxTokens` | `1024` | API 回复最大 token 数 |
| `pythonHoverTranslator.proxyUrl` | (空) | 代理地址（国内用户可能需要） |

### 代理配置（国内用户）

如果直连 DeepSeek API 不通，配置代理：

```json
{
  "pythonHoverTranslator.proxyUrl": "http://127.0.0.1:7890"
}
```

WSL 用户注意：WSL2 中代理地址是宿主机 IP，例如 `http://172.27.208.1:7890`。

## 使用

1. 配置好 API Key
2. 打开任意有文档的代码文件（`.py` / `.ts` / `.go` / `.rs` / `.java` 等）
3. 鼠标悬停到函数/类/模块名上
4. 等待 1~2 秒（首次调用 API），hover 弹窗显示中文翻译

**同一条文档第二次 hover 瞬间显示——走本地 LRU 缓存，不消耗 API。**

## 命令

| 命令 | 说明 |
|---|---|
| `AI Hover Translator: Open Settings` | 打开可视化设置面板 |
| `AI Hover Translator: Clear Translation Cache` | 清空翻译缓存 |
| `AI Hover Translator: Toggle On/Off` | 开关翻译 |

## 工作原理

```
鼠标悬停
    │
    ▼
 检查：开启？有 Key？
    │
    ▼
 获取 VSCode 原始 hover 文档
    │
    ▼
 SHA-256 哈希 → 查 LRU 缓存
    │
 命中？──→ 直接用缓存 ──┐
    │                    │
 未命中？                 │
    │                    │
  调 DeepSeek API        │
    │                    │
  翻译 + 存入缓存         │
    │                    │
    ▼                    ▼
 合并显示：原文 + 翻译 + 示例
    │
    ▼
 hover 弹窗展示
```

**任何一步失败 → 静默回退，显示原始 hover，不打断工作流。**

## 从源码构建 .vsix

```bash
git clone https://github.com/wu-xing-ai/vscodetranslatedeepseek.git
cd vscodetranslatedeepseek
npm install
bash build.sh
bash package.sh
# 生成 aitranslate-0.1.0.vsix
```

## 项目结构

```
plu/
├── src/
│   ├── extension.ts          # 入口：激活、注册命令
│   ├── hoverProvider.ts       # 核心：拦截 hover → 翻译 → 合并
│   ├── deepseekClient.ts      # DeepSeek API（TLS 直连，绕开代理拦截）
│   ├── cache.ts               # LRU 缓存
│   ├── config.ts              # 读取 VSCode 设置
│   └── utils.ts               # 哈希、token 估算等工具
├── dist/                      # 编译产物
├── icon.png                   # 插件图标
├── package.json               # 扩展清单
├── build.sh                   # 编译脚本
├── package.sh                 # 打包脚本
└── README.md
```

## 环境要求

- VSCode 1.85.0+
- DeepSeek API Key

## 许可证

MIT
