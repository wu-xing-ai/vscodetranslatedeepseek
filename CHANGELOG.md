# Changelog

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
