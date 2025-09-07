#!/usr/bin/env node
/**
 * Download LLM models for offline use
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Get the models directory
const modelsDir = path.join(process.cwd(), 'models');
const wasmDir = path.join(process.cwd(), 'wasm');

console.log('📦 LLM Model Downloader');
console.log(`Models directory: ${modelsDir}`);
console.log(`WASM directory: ${wasmDir}`);

// Create directories
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log('✅ Created models directory');
}

if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
  console.log('✅ Created WASM directory');
}

// Model configurations
const models = [
  {
    name: 'MobileBERT Classifier',
    repo: 'Xenova/mobilebert-uncased-mnli',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model.onnx'
    ]
  },
  {
    name: 'Qwen3 Generator',
    repo: 'onnx-community/Qwen3-0.6B-ONNX',
    files: [
      'config.json',
      'generation_config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model.onnx'
    ]
  }
];

async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
    }).on('error', reject);
  });
}

async function downloadModel(model) {
  console.log(`\n📥 Downloading ${model.name}...`);
  
  const modelDir = path.join(modelsDir, model.repo);
  
  for (const file of model.files) {
    const url = `https://huggingface.co/${model.repo}/resolve/main/${file}`;
    const filePath = path.join(modelDir, file);
    const fileDir = path.dirname(filePath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    // Skip if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`  ⏭️  ${file} (already exists)`);
      continue;
    }
    
    try {
      console.log(`  📁 ${file}...`);
      await downloadFile(url, filePath);
      console.log(`  ✅ ${file}`);
    } catch (error) {
      console.error(`  ❌ ${file}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('\n🚀 Starting model downloads...\n');
  
  try {
    for (const model of models) {
      await downloadModel(model);
    }
    
    console.log('\n🎉 Model download complete!');
    console.log('\nTo test the models:');
    console.log('1. npm run dev');
    console.log('2. Go to Settings tab');
    console.log('3. Click "Test Classification" or "Test LLM Summarization"');
    
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
