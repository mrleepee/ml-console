## Offline LLM Integration

This app integrates two offline models via Transformers.js:

- Classifier: `Xenova/mobilebert-uncased-mnli` (zero-shot classification)
- Generator: `onnx-community/Qwen3-0.6B-ONNX` (text-generation, WebGPU preferred)

Models are loaded from local disk only.

### Paths

- Models dir: `app.getPath('userData')/models` is exposed as `window.__MODELS_DIR__`.
- ONNX/WASM dir: `process.resourcesPath/wasm` exposed as `window.__WASM_DIR__`.

### Runtime

- WebGPU is used when available, else WASM/CPU.
- Models are lazy-loaded on first use and reused.
- Generator unloads after 5 minutes idle.
- Suggestions are debounced and support cancellation.

### How to bundle models

Place the downloaded model folders under the models directory above, preserving structure expected by Transformers.js. For ONNX backends, ensure ONNX runtime WASM files are placed under the WASM directory.

### Optional downloader (disabled by default)

Set `ENABLE_OFFLINE_MODEL_FETCH=1` and provide `MODEL_URLS` JSON to run the verifier/downloader during postinstall. SHA-256 verification is enforced.

### Troubleshooting

- If models fail to load, verify the directory paths and that `env.allowRemoteModels=false` is set (it is by default in code).
- Ensure WebGPU is available in your environment to get best performance; otherwise, WASM will be used.
- In full offline scenarios, any attempt to fetch remote models will fail fast with a clear console error.


