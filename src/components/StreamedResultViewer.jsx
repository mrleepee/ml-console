import React from "react";
import MonacoViewer from "./MonacoViewer";

// Map MIME type to Monaco language
function getLanguageFromMimeType(mimeType) {
  if (!mimeType) return "plaintext";
  const type = mimeType.toLowerCase();
  if (type.includes("json")) return "json";
  if (type.includes("xml")) return "xml";
  if (type.includes("html")) return "html";
  if (type.includes("javascript") || type.includes("js")) return "javascript";
  return "plaintext";
}

export default function StreamedResultViewer({ content = "", mimeType }) {
  const language = getLanguageFromMimeType(mimeType);
  return (
    <div className="h-full w-full">
      <MonacoViewer value={content} language={language} />
    </div>
  );
}
