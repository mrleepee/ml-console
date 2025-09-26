import React from 'react';

/**
 * QueryEditorControls Component
 *
 * Provides compact controls for Monaco editor preferences in the query card header.
 * Focuses on the most commonly used settings that users want to adjust frequently.
 */
export default function QueryEditorControls({
  preferences,
  onUpdatePreference,
  increaseFontSize,
  decreaseFontSize,
  toggleLineNumbers,
  toggleWordWrap,
  toggleMinimap
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Font Size Controls */}
      <div className="flex items-center gap-1">
        <button
          className="btn btn-ghost btn-xs"
          onClick={decreaseFontSize}
          disabled={preferences.fontSize <= 8}
          title={`Decrease font size (${preferences.fontSize}px)`}
          aria-label="Decrease font size"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Font Size Display */}
        <div className="px-2 py-1 text-xs font-mono bg-base-200 rounded border min-w-[3rem] text-center">
          {preferences.fontSize}px
        </div>

        <button
          className="btn btn-ghost btn-xs"
          onClick={increaseFontSize}
          disabled={preferences.fontSize >= 32}
          title={`Increase font size (${preferences.fontSize}px)`}
          aria-label="Increase font size"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="divider divider-horizontal mx-1"></div>

      {/* Toggle Controls */}
      <div className="flex items-center gap-1">
        {/* Line Numbers Toggle */}
        <button
          className={`btn btn-xs ${preferences.lineNumbers === 'on' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={toggleLineNumbers}
          title={`Line numbers: ${preferences.lineNumbers}`}
          aria-label={`Toggle line numbers (currently ${preferences.lineNumbers})`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </button>

        {/* Word Wrap Toggle */}
        <button
          className={`btn btn-xs ${preferences.wordWrap === 'on' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={toggleWordWrap}
          title={`Word wrap: ${preferences.wordWrap}`}
          aria-label={`Toggle word wrap (currently ${preferences.wordWrap})`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>

        {/* Minimap Toggle */}
        <button
          className={`btn btn-xs ${preferences.minimap ? 'btn-primary' : 'btn-ghost'}`}
          onClick={toggleMinimap}
          title={`Minimap: ${preferences.minimap ? 'on' : 'off'}`}
          aria-label={`Toggle minimap (currently ${preferences.minimap ? 'on' : 'off'})`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Compact version for smaller spaces
 */
export function QueryEditorControlsCompact({
  preferences,
  onUpdatePreference,
  increaseFontSize,
  decreaseFontSize
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Font Size Only */}
      <button
        className="btn btn-ghost btn-xs"
        onClick={decreaseFontSize}
        disabled={preferences.fontSize <= 8}
        title={`Decrease font size (${preferences.fontSize}px)`}
        aria-label="Decrease font size"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      {/* Font Size Display */}
      <div className="px-2 py-1 text-xs font-mono bg-base-200 rounded border min-w-[3rem] text-center">
        {preferences.fontSize}px
      </div>

      <button
        className="btn btn-ghost btn-xs"
        onClick={increaseFontSize}
        disabled={preferences.fontSize >= 32}
        title={`Increase font size (${preferences.fontSize}px)`}
        aria-label="Increase font size"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}