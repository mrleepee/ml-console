import React, { useEffect, useState } from 'react';

/**
 * Display streamed evaluation results showing per-part byte sizes and
 * cumulative download progress. The component listens for the
 * `eval-stream-progress` IPC event exposed through the preload script.
 *
 * @param {object} props
 * @param {object} props.index JSON index describing stream parts
 */
export default function StreamedResultViewer({ index }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.electronAPI?.onEvalStreamProgress) {
      const remove = window.electronAPI.onEvalStreamProgress((total) => {
        setProgress(total);
      });
      return () => remove && remove();
    }
  }, []);

  const parts = index?.parts || [];
  const totalBytes = parts.reduce((sum, p) => sum + (p.bytes || 0), 0);

  return (
    <div className="streamed-result-viewer">
      <div className="progress mb-2">
        <span data-testid="byte-progress">{progress} bytes</span>
      </div>
      <ul>
        {parts.map((part, i) => (
          <li key={i} data-testid={`part-${i}-bytes`}>
            Part {i + 1}: {part.bytes} bytes
          </li>
        ))}
      </ul>
      <div className="mt-2 font-bold" data-testid="total-bytes">
        Total: {totalBytes} bytes
      </div>
    </div>
  );
}
