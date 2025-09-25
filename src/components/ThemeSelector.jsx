import React from 'react';

/**
 * ThemeSelector Component
 *
 * A focused component for theme management including both application theme
 * and Monaco editor theme selection. Can be used in navbar or settings contexts.
 *
 * Features:
 * - Application theme toggle button (light/dark)
 * - Monaco editor theme selector with multiple options
 * - Theme preview for Monaco editor
 * - Proper labeling and accessibility
 * - Compact toggle for navbar placement
 * - Detailed selector for settings forms
 *
 * @param {Object} props Component props
 * @param {string} props.variant Component variant - 'toggle' for navbar, 'full' for settings
 * @param {string} props.theme Current application theme
 * @param {Function} props.onThemeChange Callback when theme changes
 * @param {string} props.monacoTheme Current Monaco theme
 * @param {Function} props.onMonacoThemeChange Callback when Monaco theme changes
 * @param {React.Component} props.MonacoEditor Monaco editor component for preview
 * @returns {JSX.Element} ThemeSelector component
 */
export default function ThemeSelector({
  variant = 'toggle',
  theme = 'light',
  onThemeChange,
  monacoTheme = 'vs',
  onMonacoThemeChange,
  MonacoEditor
}) {

  // Handle theme toggle
  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  // Monaco theme options
  const monacoThemeOptions = [
    { value: 'vs', label: 'Light (Visual Studio)' },
    { value: 'vs-dark', label: 'Dark (Visual Studio Dark)' },
    { value: 'hc-black', label: 'High Contrast Black' },
    { value: 'hc-light', label: 'High Contrast Light' }
  ];

  // Get theme toggle properties
  const getToggleProps = () => ({
    className: "btn btn-ghost btn-sm",
    onClick: handleThemeToggle,
    title: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
    'aria-label': `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`
  });

  // Render theme preview
  const renderMonacoPreview = () => {
    if (!MonacoEditor) return null;

    const previewCode = `// Monaco Editor Theme Preview
const greeting = "Hello, World!";
console.log(greeting);

/* Multi-line comment
   showing syntax highlighting */
function example() {
  return { theme: "${monacoTheme}" };
}`;

    return (
      <div className="border border-base-300 rounded-lg overflow-hidden">
        <MonacoEditor
          content={previewCode}
          language="javascript"
          readOnly={true}
          height="120px"
        />
      </div>
    );
  };

  // Render compact toggle for navbar
  if (variant === 'toggle') {
    return (
      <button {...getToggleProps()}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    );
  }

  // Render full theme selector for settings
  return (
    <div className="space-y-4">
      {/* Application Theme Toggle */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Application Theme</span>
        </label>
        <div className="flex items-center gap-3">
          <button {...getToggleProps()}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <span className="text-sm text-base-content/70">
            Current: {theme === 'light' ? 'Light' : 'Dark'}
          </span>
        </div>
        <label className="label">
          <span className="label-text-alt text-base-content/60">
            Click to switch between light and dark modes
          </span>
        </label>
      </div>

      {/* Monaco Editor Theme Selector */}
      <div className="form-control">
        <label className="label" htmlFor="settings-monaco-theme">
          <span className="label-text font-medium">Monaco Editor Theme</span>
        </label>
        <select
          id="settings-monaco-theme"
          className="select select-bordered"
          value={monacoTheme}
          onChange={(e) => onMonacoThemeChange && onMonacoThemeChange(e.target.value)}
        >
          {monacoThemeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="label">
          <span className="label-text-alt text-base-content/60">
            Choose your preferred color scheme for code editors
          </span>
        </label>
      </div>

      {/* Theme Preview */}
      {MonacoEditor && (
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Theme Preview</span>
          </label>
          {renderMonacoPreview()}
        </div>
      )}
    </div>
  );
}