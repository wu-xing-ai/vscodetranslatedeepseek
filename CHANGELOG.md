# Changelog

## 0.2.0

- Support custom OpenAI-compatible API endpoint (`pythonHoverTranslator.apiUrl`),
  so you can use DeepSeek, OpenAI, OpenRouter, Ollama, LM Studio, etc.
- Works with any language, not just Python (JS/TS, Go, Rust, Java, C#, C++ ...).
- Better API error messages (invalid key / model are now surfaced).
- Support plain `http://` endpoints (e.g. local Ollama / LM Studio).

## 0.1.0

- Initial release: hover documentation translation via DeepSeek API
  with LRU cache, proxy support and configurable model/target language.
