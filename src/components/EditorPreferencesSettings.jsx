import React from 'react';
import useEditorPreferences from '../hooks/useEditorPreferences';

/**
 * EditorPreferencesSettings Component
 *
 * Provides comprehensive editor preference controls for the settings page.
 * Includes advanced options that are changed less frequently than header controls.
 */
export default function EditorPreferencesSettings() {
  const {
    preferences,
    updatePreference,
    resetPreferences,
    tabSizeOptions,
    whitespaceOptions
  } = useEditorPreferences();

  return (
    <div className="space-y-4">
      {/* Editor Behavior Section */}
      <div className="form-control">
        <label className="label mt-2 mb-2">
          <span className="label-text font-medium">Editor Behavior</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tab Size */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Tab Size</span>
            </label>
            <select
              className="select select-bordered select-sm"
              value={preferences.tabSize}
              onChange={(e) => updatePreference('tabSize', parseInt(e.target.value))}
            >
              {tabSizeOptions.map(size => (
                <option key={size} value={size}>{size} spaces</option>
              ))}
            </select>
          </div>

          {/* Whitespace Rendering */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Show Whitespace</span>
            </label>
            <select
              className="select select-bordered select-sm"
              value={preferences.renderWhitespace}
              onChange={(e) => updatePreference('renderWhitespace', e.target.value)}
            >
              {whitespaceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Editor Features Section */}
      <div className="form-control">
        <label className="label mt-2 mb-2">
          <span className="label-text font-medium">Editor Features</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Indentation Guides */}
          <div className="form-control">
            <label className="cursor-pointer label justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={preferences.indentationGuides}
                onChange={(e) => updatePreference('indentationGuides', e.target.checked)}
              />
              <div>
                <div className="label-text">Indentation Guides</div>
                <div className="label-text-alt text-base-content/60">
                  Show vertical lines for indentation levels
                </div>
              </div>
            </label>
          </div>

          {/* Bracket Matching */}
          <div className="form-control">
            <label className="cursor-pointer label justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={preferences.bracketMatching}
                onChange={(e) => updatePreference('bracketMatching', e.target.checked)}
              />
              <div>
                <div className="label-text">Bracket Matching</div>
                <div className="label-text-alt text-base-content/60">
                  Highlight matching brackets and parentheses
                </div>
              </div>
            </label>
          </div>

          {/* Auto-completion */}
          <div className="form-control">
            <label className="cursor-pointer label justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={preferences.autoCompletion}
                onChange={(e) => updatePreference('autoCompletion', e.target.checked)}
              />
              <div>
                <div className="label-text">Auto-completion</div>
                <div className="label-text-alt text-base-content/60">
                  Show IntelliSense suggestions while typing
                </div>
              </div>
            </label>
          </div>

          {/* Format on Paste */}
          <div className="form-control">
            <label className="cursor-pointer label justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={preferences.formatOnPaste}
                onChange={(e) => updatePreference('formatOnPaste', e.target.checked)}
              />
              <div>
                <div className="label-text">Format on Paste</div>
                <div className="label-text-alt text-base-content/60">
                  Automatically format code when pasting
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Current Settings Summary */}
      <div className="form-control">
        <label className="label mt-2 mb-2">
          <span className="label-text font-medium">Current Settings Summary</span>
        </label>
        <div className="bg-base-200 p-4 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Font Size</div>
              <div className="text-base-content/70">{preferences.fontSize}px</div>
            </div>
            <div>
              <div className="font-medium">Line Numbers</div>
              <div className="text-base-content/70">{preferences.lineNumbers}</div>
            </div>
            <div>
              <div className="font-medium">Word Wrap</div>
              <div className="text-base-content/70">{preferences.wordWrap}</div>
            </div>
            <div>
              <div className="font-medium">Minimap</div>
              <div className="text-base-content/70">{preferences.minimap ? 'On' : 'Off'}</div>
            </div>
            <div>
              <div className="font-medium">Tab Size</div>
              <div className="text-base-content/70">{preferences.tabSize} spaces</div>
            </div>
            <div>
              <div className="font-medium">Whitespace</div>
              <div className="text-base-content/70">{preferences.renderWhitespace}</div>
            </div>
            <div>
              <div className="font-medium">Indentation</div>
              <div className="text-base-content/70">{preferences.indentationGuides ? 'On' : 'Off'}</div>
            </div>
            <div>
              <div className="font-medium">Brackets</div>
              <div className="text-base-content/70">{preferences.bracketMatching ? 'On' : 'Off'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="form-control">
        <div className="flex justify-end">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (confirm('Reset all editor preferences to defaults?')) {
                resetPreferences();
              }
            }}
          >
            Reset to Defaults
          </button>
        </div>
        <label className="label">
          <span className="label-text-alt text-base-content/60">
            This will reset all editor preferences to their default values
          </span>
        </label>
      </div>
    </div>
  );
}