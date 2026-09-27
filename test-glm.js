// Test harness: mocks the 'vscode' module so we can run the compiled
// DeepSeekClient outside of VSCode, then calls the real GLM endpoint.
const Module = require('module');
const originalLoad = Module._load;

const settings = {
  enabled: true,
  apiKey: process.env.TEST_API_KEY || '',
  apiUrl: process.env.TEST_API_URL || 'https://open.bigmodel.cn/api/paas/v4',
  model: process.env.TEST_MODEL || 'glm-4-flash',
  maxTokens: parseInt(process.env.TEST_MAX_TOKENS || '1024', 10),
  targetLanguage: 'Chinese (Simplified)',
  cacheSize: 200,
  showOriginal: true,
  showExamples: true,
  proxyUrl: '',
};

Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return {
      workspace: {
        getConfiguration: () => ({
          get: (key, def) => (key in settings ? settings[key] : def),
        }),
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { DeepSeekClient } = require('./dist/deepseekClient.js');

const docs = `def arange(end, *, out=None, dtype=None, device=None, requires_grad=False)
Returns a 1-D tensor with values from the interval [start, end) taken with common difference step beginning from start.`;

(async () => {
  console.log(`\nModel: ${settings.model}`);
  console.log(`URL:   ${settings.apiUrl}`);
  console.log(`max_tokens: ${settings.maxTokens}\n`);
  const t0 = Date.now();
  try {
    const result = await DeepSeekClient.getInstance().translate(docs, 'Chinese (Simplified)');
    console.log('--- Translation ---');
    console.log(result);
    console.log(`\nOK in ${Date.now() - t0}ms`);
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();
