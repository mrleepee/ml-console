import React from 'react';
import QueryEditor from './QueryEditor';
import QueryEditorControls from './QueryEditorControls';
import useEditorPreferences from '../hooks/useEditorPreferences';

/**
 * QueryEditorWithControls Component
 *
 * Combines QueryEditor with QueryEditorControls for a complete editing experience.
 * This is the main component to use when you want editor controls in the header.
 */
export default function QueryEditorWithControls({
  value = "",
  onChange,
  onKeyDown,
  language = "plaintext",
  disabled = false,
  theme = "vs",
  placeholder = "",
  controlsPosition = "header", // "header" | "none"
  compact = false, // use compact controls
}) {
  const {
    preferences,
    updatePreference,
    increaseFontSize,
    decreaseFontSize,
    toggleLineNumbers,
    toggleWordWrap,
    toggleMinimap,
    fontSizes
  } = useEditorPreferences();

  const renderControls = () => {
    if (controlsPosition === "none") return null;

    return (
      <QueryEditorControls
        preferences={preferences}
        onUpdatePreference={updatePreference}
        increaseFontSize={increaseFontSize}
        decreaseFontSize={decreaseFontSize}
        toggleLineNumbers={toggleLineNumbers}
        toggleWordWrap={toggleWordWrap}
        toggleMinimap={toggleMinimap}
        fontSizes={fontSizes}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls Header */}
      {controlsPosition === "header" && (
        <div className="flex justify-end p-2 border-b border-base-300 bg-base-50">
          {renderControls()}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <QueryEditor
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          language={language}
          disabled={disabled}
          theme={theme}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

/**
 * Export individual components for flexibility
 */
export { QueryEditor, QueryEditorControls };