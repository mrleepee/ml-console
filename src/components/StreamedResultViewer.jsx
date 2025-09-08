import React from "react";
import MonacoViewer from "./MonacoViewer";

// Map MIME type to a Monaco language id
function getLanguageFromMimeType(mimeType) {
  if (!mimeType) return "plaintext";
  const type = mimeType.toLowerCase();
  if (type.includes("json")) return "json";
  if (type.includes("xml")) return "xml";
  if (type.includes("html")) return "html";
  if (type.includes("javascript") || type.includes("js")) return "javascript";
  return "plaintext";
}

// Accept either a full part object or raw content/mimeType props
export default function StreamedResultViewer({ part, content = "", mimeType }) {
  const actualContent = part?.content ?? content ?? "";
  const type = part?.mimeType || part?.contentType || mimeType;
  const language = getLanguageFromMimeType(type);

  return (
    <div className="h-full w-full">
      <MonacoViewer value={actualContent} language={language} />
    </div>
  );
}
