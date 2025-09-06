/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPipeline } from './transformers';

type Lang = 'xquery' | 'javascript' | 'sparql' | 'optic';

let generatorSingleton: any | null = null;
let unloadTimer: any = null;

const SYSTEM_PROMPT = (lang: Lang) =>
  `You generate concise, correct ${lang.toUpperCase()} for MarkLogic/Optic. Return only code. Prefer idiomatic constructs. Include minimal comments. If SPARQL, use SELECT unless specified; for XQuery, ML 10+ compatible.`;

const STOP_SEQS: Record<Lang, string[]> = {
  xquery: ['\n\n', '(:', ';', '</'],
  javascript: ['\n\n', ';', '\n}'],
  sparql: ['\n\n', '}'],
  optic: ['\n\n', ';', '\n}'],
};

function scheduleUnload() {
  if (unloadTimer) clearTimeout(unloadTimer);
  unloadTimer = setTimeout(() => {
    generatorSingleton = null;
    window.electronAPI?.llm.update?.({ modelsLoaded: { generator: false } });
  }, 5 * 60 * 1000);
}

async function getGenerator() {
  if (!generatorSingleton) {
    generatorSingleton = await getPipeline('text-generation', 'onnx-community/Qwen3-0.6B-ONNX', {
      dtype: 'q4f16',
    });
    window.electronAPI?.llm.update?.({ modelsLoaded: { generator: true } });
  }
  scheduleUnload();
  return generatorSingleton;
}

export async function* generateCode(opts: {
  instruction: string;
  language: Lang;
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
  signal?: AbortSignal;
}): AsyncIterable<string> {
  const gen = await getGenerator();
  const stop = opts.stop && opts.stop.length ? opts.stop : STOP_SEQS[opts.language];
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const maxNewTokens = typeof opts.maxTokens === 'number' ? opts.maxTokens : 128;

  const prompt = `${SYSTEM_PROMPT(opts.language)}\n\nInstruction: ${opts.instruction}\n\nAnswer:`;

  const stream = await gen.stream(prompt, {
    temperature,
    max_new_tokens: maxNewTokens,
    stop,
    callback_function: (token: string) => {
      // no-op here; we will read from stream iterator below
    },
  });

  try {
    for await (const chunk of stream) {
      if (opts.signal?.aborted) break;
      const text = String(chunk);
      yield text;
    }
  } finally {
    window.electronAPI?.llm.update?.({ telemetry: { generations: 1 } });
    scheduleUnload();
  }
}

export async function* suggestNext(opts: {
  buffer: string;
  cursor: number;
  language: Lang;
  maxTokens?: number;
  signal?: AbortSignal;
}): AsyncIterable<string> {
  const windowSize = 2048; // ~1–2 KB window
  const start = Math.max(0, opts.cursor - windowSize);
  const context = opts.buffer.slice(start, opts.cursor);
  const stop = STOP_SEQS[opts.language];
  const maxNewTokens = typeof opts.maxTokens === 'number' ? opts.maxTokens : 48;

  const gen = await getGenerator();
  const prompt = `${SYSTEM_PROMPT(opts.language)}\n\nGiven the context, suggest the next code tokens.\n\nContext:\n${context}\n\nNext:`;

  const stream = await gen.stream(prompt, {
    temperature: 0.2,
    max_new_tokens: maxNewTokens,
    stop,
  });

  try {
    for await (const chunk of stream) {
      if (opts.signal?.aborted) break;
      const text = String(chunk);
      yield text;
    }
  } finally {
    scheduleUnload();
  }
}


