# Python Hover Translator

一个 VSCode 插件，在你鼠标悬停到 Python 函数/模块上时，自动调用 DeepSeek API 将英文文档翻译成中文，并展示使用示例。

## 功能特性

- 🐍 **Python 专属**：仅在打开 Python 文件时激活，其他语言零开销。
- 🌐 **悬停自动翻译**：鼠标悬停到任意 Python 函数、类或模块上，实时显示中文翻译。
- 📚 **使用示例**：翻译下方自动生成 1~2 个简洁的 Python 代码使用示例。
- ⚡ **LRU 缓存**：翻译结果本地缓存，重复悬停瞬间显示，不消耗 API 额度。
- 🛡️ **静默降级**：API 不可用时，原始英文文档正常显示，绝不打断你的工作流。
- 🔧 **高度可配**：开关、目标语言、缓存大小、DeepSeek 模型均可自由配置。

## 效果预览

鼠标悬停到 `torch` 上时，原本只显示：

```
(module) torch
The torch package contains data structures for multi-dimensional tensors
and defines mathematical operations over these tensors. Additionally, it
provides many utilities for efficient serialization of Tensors and
arbitrary types, and other useful utilities.

It has a CUDA counterpart, that enables you to run your tensor
computations on an NVIDIA GPU with compute capability >= 3.0.
```

安装插件后，hover 弹窗会变成：

```
(module) torch
The torch package contains data structures for multi-dimensional tensors
and defines mathematical operations over these tensors. Additionally, it
provides many utilities for efficient serialization of Tensors and
arbitrary types, and other useful utilities.

It has a CUDA counterpart, that enables you to run your tensor
computations on an NVIDIA GPU with compute capability >= 3.0.

---

### 简体中文 翻译

torch 是一个 Python 模块。该包提供了多维张量的数据结构，并定义了这些
张量上的数学运算。此外，它还提供了许多用于高效序列化张量和任意类型的
工具，以及其他实用功能。

它还有一个 CUDA 版本，使你能够在计算能力 >= 3.0 的 NVIDIA GPU 上运行
张量计算。

**使用示例：**

​```python
import torch

# 创建一个 2x3 的张量
x = torch.tensor([[1.0, 2.0, 3.0],
                  [4.0, 5.0, 6.0]])
print(x.shape)  # torch.Size([2, 3])

# GPU 上运行张量计算
if torch.cuda.is_available():
    x = x.cuda()
    y = x + 1
​```
```

## 安装与配置

### 第一步：获取 DeepSeek API Key

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys)
2. 注册或登录
3. 创建一个 API Key
4. 复制 Key（格式为 `sk-xxxxxxxx`）

### 第二步：配置插件

在 VSCode 中按 `Ctrl+,` 打开设置，搜索 `Python Hover Translator`：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `pythonHoverTranslator.apiKey` | (空) | 你的 DeepSeek API Key |
| `pythonHoverTranslator.enabled` | `true` | 是否启用悬停翻译 |
| `pythonHoverTranslator.targetLanguage` | `Chinese (Simplified)` | 翻译目标语言 |
| `pythonHoverTranslator.model` | `deepseek-chat` | DeepSeek 模型名称 |
| `pythonHoverTranslator.cacheSize` | `200` | 最大缓存条目数（LRU 淘汰） |
| `pythonHoverTranslator.showOriginal` | `true` | 是否同时显示原始英文文档 |
| `pythonHoverTranslator.showExamples` | `true` | 是否在翻译后附带代码示例 |

也可以直接在 `settings.json` 中添加：

```json
{
  "pythonHoverTranslator.apiKey": "sk-你的-deepseek-key",
  "pythonHoverTranslator.targetLanguage": "Chinese (Simplified)"
}
```

### 第三步：打开 Python 文件

打开任意 `.py` 文件，将鼠标悬停到有文档的函数、类或模块上，即可看到翻译结果。

> **注意**：需要同时安装 [Python 扩展](https://marketplace.visualstudio.com/items?itemName=ms-python.python)（VSCode 官方 Python 支持），否则无法获取原始 hover 文档。

## 命令

| 命令 | 说明 |
|---|---|
| `Python Hover Translator: Clear Translation Cache` | 清空所有翻译缓存 |
| `Python Hover Translator: Toggle On/Off` | 快速开关翻译功能 |

## 支持的目标语言

| 语言 | 说明 |
|---|---|
| `Chinese (Simplified)` | 简体中文 |
| `Chinese (Traditional)` | 繁體中文 |
| `Japanese` | 日本語 |
| `Korean` | 한국어 |

## 从源码构建

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 在 VSCode 中按 F5 启动扩展开发宿主进行调试
```

打包为 `.vsix` 安装包（需要先安装 `@vscode/vsce`）：

```bash
npm install -g @vscode/vsce
vsce package
# 生成 python-hover-translator-0.1.0.vsix

# 本地安装
code --install-extension python-hover-translator-0.1.0.vsix
```

## 工作原理

```
用户悬停到 Python 符号
        │
        ▼
  ┌─ 检查：插件是否开启？是否配置了 API Key？ ─┐
  │  任一为否 → 显示原始 hover，不做处理         │
  └──────────────────────────────────────────┘
        │ (是)
        ▼
  获取 VSCode 原始 hover 内容（英文文档）
        │
        ▼
  对原文做 SHA-256 哈希 → 查 LRU 缓存
        │
   ┌─ 命中 ──────────────> 直接使用缓存翻译
   │
   └─ 未命中 → 调用 DeepSeek API 翻译 → 存入缓存
        │
        ▼
  合并 Markdown：
    原始英文（可选）
    ───────────
    中文翻译 + 代码示例（可选）
        │
        ▼
  显示在 hover 弹窗中

错误处理：API 调用失败 → 控制台记录警告 → 显示原始 hover
```

## 错误处理策略

| 场景 | 行为 |
|---|---|
| 未配置 API Key | 静默跳过，显示原始 hover |
| 网络超时（15 秒） | 控制台警告，回退原始 hover |
| API 返回错误（4xx/5xx） | 控制台警告，回退原始 hover |
| 请求频率过高（>30次/分钟） | 控制台警告，回退原始 hover |
| 用户快速移动光标 | 通过 CancellationToken 取消请求 |
| 文档内容已是中文 | 自动跳过，不浪费 API 调用 |

**核心原则：翻译失败绝不破坏 hover 体验。**

## 环境要求

- VSCode 1.85.0 或更高版本
- VSCode Python 扩展（提供原始 hover 文档）
- DeepSeek API Key

## 许可证

MIT
