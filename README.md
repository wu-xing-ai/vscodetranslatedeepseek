# AI Translate

VSCode 插件，鼠标悬停到任意语言的函数/类/模块上时，自动调用 DeepSeek API 将英文文档翻译成中文，并附带使用示例。

支持 **Python、TypeScript、JavaScript、Go、Rust、Java、C#、C++** 等所有有 hover 文档的语言。

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

## 配置

安装后在 VSCode 设置中搜索 `Python Hover Translator`（设置项前缀保持兼容），需要配置以下两项：

### 必填：API Key

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `pythonHoverTranslator.apiKey` | (空) | 你的 DeepSeek API Key |

```json
{
  "pythonHoverTranslator.apiKey": "sk-你的-deepseek-key"
}
```

API Key 获取地址：https://platform.deepseek.com/api_keys

### 可选配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `pythonHoverTranslator.enabled` | `true` | 开关翻译 |
| `pythonHoverTranslator.targetLanguage` | `Chinese (Simplified)` | 目标语言 |
| `pythonHoverTranslator.model` | `deepseek-chat` | DeepSeek 模型 |
| `pythonHoverTranslator.cacheSize` | `200` | 缓存条数（LRU 淘汰） |
| `pythonHoverTranslator.showOriginal` | `true` | 显示原始英文 |
| `pythonHoverTranslator.showExamples` | `true` | 附带代码示例 |
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
| `Python Hover Translator: Clear Translation Cache` | 清空翻译缓存 |
| `Python Hover Translator: Toggle On/Off` | 开关翻译 |

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
