import React, { useEffect, useState } from "react";
import MonacoViewer from "./MonacoViewer";
import { getLanguageFromContentType } from "../utils/languageUtils";


/**
 * Display streamed evaluation results showing per-part byte sizes and
 * cumulative download progress. The component listens for the
 * `eval-stream-progress` IPC event exposed through the preload script.
 *
 * Additionally, when a part's content is provided via `part` or explicit
 * `content`/`mimeType` props, it renders the payload using the Monaco viewer
 * with syntax highlighting based on the MIME type.
 *
 * @param {object} props
 * @param {object} [props.index] JSON index describing stream parts
 * @param {object} [props.part] Stream part containing `content` and `mimeType`
 * @param {string} [props.content] Raw content to display
 * @param {string} [props.mimeType] MIME type of the content
 */
export default function StreamedResultViewer({
  index,
  part,
  content = "",
  mimeType,
}) {
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
  const actualContent = part?.content ?? content ?? "";
  const type = part?.mimeType || part?.contentType || mimeType;
  const language = getLanguageFromContentType(type);

  return (
    <div className="streamed-result-viewer h-full w-full">
      <div className="progress mb-2">
        <span data-testid="byte-progress">{progress} bytes</span>
      </div>
      <ul>
        {parts.map((p, i) => (
          <li key={i} data-testid={`part-${i}-bytes`}>
            Part {i + 1}: {p.bytes} bytes
          </li>
        ))}
      </ul>
      <div className="mt-2 font-bold" data-testid="total-bytes">
        Total: {totalBytes} bytes
      </div>
      <MonacoViewer value={actualContent} language={language} />
    </div>
  );
}
