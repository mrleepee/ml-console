import React, { useEffect, useState } from "react";

/**
 * Displays progress information for streamed eval results.
 * Fetches an index.json describing the parts and shows the byte
 * count for each part along with a running cumulative total.
 */
export default function StreamedResultViewer({ indexUrl }) {
  const [parts, setParts] = useState([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [received, setReceived] = useState(0);

  // Load index.json describing the streamed parts
  useEffect(() => {
    if (!indexUrl) return;
    fetch(indexUrl)
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : data.parts || [];
        setParts(arr);
        const total = arr.reduce((sum, p) => sum + (p.bytes || 0), 0);
        setTotalBytes(total);
      })
      .catch(() => {
        setParts([]);
        setTotalBytes(0);
      });
  }, [indexUrl]);

  // Listen for streamed progress events from Electron
  useEffect(() => {
    const handler = (total) => setReceived(total);
    if (window.electronAPI?.onEvalStreamProgress) {
      window.electronAPI.onEvalStreamProgress(handler);
      return () => {
        window.electronAPI.removeEvalStreamProgressListener?.(handler);
      };
    }
  }, []);

  const cumulative = parts.reduce((acc, part) => {
    const next = acc.total + (part.bytes || 0);
    acc.list.push({ ...part, cumulative: next });
    acc.total = next;
    return acc;
  }, { list: [], total: 0 }).list;

  return (
    <div className="space-y-2">
      <div className="text-sm">
        Received {received} / {totalBytes} bytes
      </div>
      <progress className="progress w-full" value={received} max={totalBytes}></progress>
      <ul className="text-sm space-y-1">
        {cumulative.map((p, idx) => (
          <li key={idx}>
            {p.name || `Part ${idx + 1}`}: {p.bytes} bytes (total {p.cumulative})
          </li>
        ))}
      </ul>
    </div>
  );
}
