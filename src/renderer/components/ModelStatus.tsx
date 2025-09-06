import React, { useEffect, useState } from 'react';

type Status = {
  backend: 'unknown' | 'webgpu' | 'wasm';
  modelsLoaded: { classifier: boolean; generator: boolean };
  telemetry: { tokensGenerated?: number; generations?: number; classifications?: number; startedAt?: number };
  updatedAt: number;
};

export default function ModelStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  const refresh = async () => {
    try {
      const s = await window.electronAPI.llm.status();
      setStatus(s);
    } catch {}
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  const warmUp = async () => {
    try {
      // lazy import to avoid overhead
      const { warmUpClassifier } = await import('../llm/classifier');
      await warmUpClassifier();
      setTimeout(refresh, 500);
    } catch {}
  };

  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
      <div>Backend: <strong>{status?.backend || 'unknown'}</strong></div>
      <div>Classifier loaded: {status?.modelsLoaded?.classifier ? 'yes' : 'no'}</div>
      <div>Generator loaded: {status?.modelsLoaded?.generator ? 'yes' : 'no'}</div>
      <div>Generations: {status?.telemetry?.generations || 0} · Classifications: {status?.telemetry?.classifications || 0}</div>
      <button onClick={warmUp} style={{ marginTop: 6 }}>Warm up</button>
    </div>
  );
}


