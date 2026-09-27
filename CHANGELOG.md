# Changelog

## 0.3.2

- 移除内置共享 Key：明文写在代码里会随 vsix/GitHub 公开，存在被滥用风险。
- 恢复为使用用户自己的 Key；设置面板引导免费申请智谱 GLM（`glm-4-flash`）。

## 0.3.1

- 修复「测试连接」对推理模型（如 `deepseek-flash`）误报失败的问题：
  推理模型会先消耗 token 进行思考，之前 16 token 的测试预算不够导致返回空内容。
- 改进错误提示：当模型只返回 reasoning_content 而无正文时，提示需增大 `maxTokens`。
- 更新 DeepSeek 预设模型为 `deepseek-flash`。

## 0.3.0

- **可视化设置面板**：新增 `AI Hover Translator: Open Settings` 命令，
  提供一键选择服务商（DeepSeek / 智谱 GLM / OpenAI / OpenRouter / Ollama / 自定义）、
  粘贴 Key、测试连接、保存配置的图形界面。
- **API Key 安全存储**：Key 改为保存在 VS Code SecretStorage（系统密钥库），
  不再明文写入 `settings.json`；旧的明文配置仍作为回退兼容。
- 新增「测试连接」功能，可在保存前验证 Key / 地址 / 模型是否正确。
- 首次安装未配置 Key 时会弹窗引导打开设置面板。

## 0.2.0

- Support custom OpenAI-compatible API endpoint (`pythonHoverTranslator.apiUrl`),
  so you can use DeepSeek, OpenAI, OpenRouter, Ollama, LM Studio, etc.
- Works with any language, not just Python (JS/TS, Go, Rust, Java, C#, C++ ...).
- Better API error messages (invalid key / model are now surfaced).
- Support plain `http://` endpoints (e.g. local Ollama / LM Studio).

## 0.1.0

- Initial release: hover documentation translation via DeepSeek API
  with LRU cache, proxy support and configurable model/target language.
