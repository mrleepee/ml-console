/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPipeline } from './transformers';

export type QueryLabel = 'xquery' | 'javascript' | 'sparql' | 'optic' | 'other';

let classifierSingleton: any | null = null;
let initializedAt = 0;

const LABELS: QueryLabel[] = ['xquery', 'javascript', 'sparql', 'optic', 'other'];
const HYPOTHESIS = 'The programming/query language of this text is {}.';

async function getClassifier() {
  if (!classifierSingleton) {
    classifierSingleton = await getPipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
    initializedAt = Date.now();
    window.electronAPI?.llm.update?.({ modelsLoaded: { classifier: true }, initializedAt });
  }
  return classifierSingleton;
}

export async function classifyQuery(text: string): Promise<{ label: QueryLabel; score: number }> {
  const clf = await getClassifier();
  const result = await clf(text, LABELS, { hypothesis_template: HYPOTHESIS });
  // result: { labels: string[], scores: number[] }
  const { labels, scores } = result;
  let bestIndex = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIndex]) bestIndex = i;
  }
  const label = (labels[bestIndex] as QueryLabel) || 'other';
  const score = scores[bestIndex] || 0;
  window.electronAPI?.llm.update?.({ telemetry: { classifications: 1 } });
  return { label, score };
}

export async function warmUpClassifier() {
  await classifyQuery('for $p in /protein return $p/name');
}


