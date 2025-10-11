import React, { useState, useMemo, useCallback } from 'react';
import {
  getAllAvailableThemes,
  getThemesByCategory,
  searchThemes,
  getThemeDisplayName
} from '../utils/themeLoader.js';
import MonacoViewer from './MonacoViewer.jsx';
import EditorPreferencesSettings from './EditorPreferencesSettings.jsx';

// Built-in themes (hoisted to module scope to prevent recreation on every render)
const BUILT_IN_THEMES = [
  { id: 'vs', name: 'vs', displayName: 'Light (Visual Studio)', category: 'built-in' },
  { id: 'vs-dark', name: 'vs-dark', displayName: 'Dark (Visual Studio Dark)', category: 'built-in' },
  { id: 'hc-black', name: 'hc-black', displayName: 'High Contrast Black', category: 'built-in' }
  // Note: hc-light removed - Monaco doesn't properly support it, causes loading errors
];

/**
 * Enhanced theme selector component with search, categories, and preview
 */
export function EnhancedThemeSelector({
  value,
  onChange,
  showBuiltInThemes = true,
  className = '',
  disabled = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isOpen, setIsOpen] = useState(false);

  // Get all themes organized by category
  const themesByCategory = useMemo(() => getThemesByCategory(), []);
  const allCustomThemes = useMemo(() => getAllAvailableThemes(), []);

  // Filter themes based on search and category
  const filteredThemes = useMemo(() => {
    let themes = [...allCustomThemes];

    if (showBuiltInThemes) {
      themes = [...BUILT_IN_THEMES, ...themes];
    }

    if (searchTerm) {
      const searchResults = searchThemes(searchTerm);
      themes = themes.filter(theme =>
        searchResults.some(result => result.name === theme.name) ||
        theme.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      themes = themes.filter(theme => theme.category === selectedCategory);
    }

    return themes;
  }, [allCustomThemes, showBuiltInThemes, searchTerm, selectedCategory]);

  // Get categories for filter dropdown
  const availableCategories = useMemo(() => {
    const categories = [{ value: 'all', label: 'All Themes', count: filteredThemes.length }];

    if (showBuiltInThemes) {
      categories.push({
        value: 'built-in',
        label: 'Built-in Themes',
        count: BUILT_IN_THEMES.length
      });
    }

    Object.entries(themesByCategory).forEach(([category, themes]) => {
      if (themes.length > 0) {
        const categoryLabel = category.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        categories.push({
          value: category,
          label: categoryLabel,
          count: themes.length
        });
      }
    });

    return categories;
  }, [themesByCategory, showBuiltInThemes, filteredThemes.length]);

  // Get display name for current value (memoized)
  const getCurrentDisplayName = useCallback(() => {
    if (!value) return 'Select a theme...';

    const foundTheme = [...BUILT_IN_THEMES, ...allCustomThemes].find(theme => theme.name === value);
    return foundTheme ? foundTheme.displayName : getThemeDisplayName(value);
  }, [value, allCustomThemes]);

  const handleThemeSelect = useCallback((themeName) => {
    onChange(themeName);
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  const handleToggleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  }, [disabled, isOpen]);

  const handleCloseDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((e) => {
    setSelectedCategory(e.target.value);
  }, []);

  return (
    <div className={`theme-selector relative ${className}`}>
      {/* Main selector button */}
      <div className="relative">
        <button
          type="button"
          className={`select select-bordered w-full justify-between ${disabled ? 'select-disabled' : ''}`}
          onClick={handleToggleOpen}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate">{getCurrentDisplayName()}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
            {/* Search and filter header */}
            <div className="p-3 border-b border-base-300">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Search themes..."
                  className="input input-sm input-bordered flex-1"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <select
                  className="select select-sm select-bordered w-32"
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                >
                  {availableCategories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label} ({category.count})
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-base-content/60">
                {filteredThemes.length} theme{filteredThemes.length !== 1 ? 's' : ''} available
              </div>
            </div>

            {/* Theme list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredThemes.length > 0 ? (
                <div className="py-1">
                  {filteredThemes.map((theme) => {
                    const handleClick = () => handleThemeSelect(theme.name);
                    return (
                      <button
                        key={`${theme.category}-${theme.id || theme.name}`}
                        type="button"
                        className={`w-full px-3 py-2 text-left hover:bg-base-200 flex items-center justify-between group ${
                          value === theme.name ? 'bg-primary text-primary-content' : ''
                        }`}
                        onClick={handleClick}
                      >
                      <div>
                        <div className="font-medium">{theme.displayName}</div>
                        <div className="text-xs opacity-60">
                          {theme.category === 'built-in' ? 'Built-in' :
                           theme.category.split('-').map(word =>
                             word.charAt(0).toUpperCase() + word.slice(1)
                           ).join(' ')
                          }
                        </div>
                      </div>
                      {value === theme.name && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-base-content/60">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <div>No themes found</div>
                  <div className="text-xs mt-1">Try adjusting your search or filter</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleCloseDropdown}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

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
 * @returns {JSX.Element} ThemeSelector component
 */
export default function ThemeSelector({
  variant = 'toggle',
  theme = 'light',
  onThemeChange,
  monacoTheme = 'vs',
  onMonacoThemeChange
}) {

  // Handle theme toggle
  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  // Get theme toggle properties
  const getToggleProps = () => ({
    className: "btn btn-ghost btn-sm",
    onClick: handleThemeToggle,
    title: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
    'aria-label': `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`
  });

  // Render theme preview
  const renderMonacoPreview = () => {
    const previewCode = `// Monaco Editor Theme Preview
const greeting = "Hello, World!";
console.log(greeting);

/* Multi-line comment
   showing syntax highlighting */
function example() {
  return { theme: "${monacoTheme}" };
}`;

    return (
      <div className="border border-base-300 rounded-lg overflow-hidden" style={{ height: "144px" }}>
        <MonacoViewer
          value={previewCode}
          language="javascript"
          theme={monacoTheme}
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
        <label className="label mt-2 mb-2">
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

      {/* Enhanced Monaco Editor Theme Selector */}
      <div className="form-control">
        <label className="label mt-2 mb-2" htmlFor="settings-monaco-theme">
          <span className="label-text font-medium">Editor Theme</span>
        </label>
        <EnhancedThemeSelector
          value={monacoTheme}
          onChange={onMonacoThemeChange}
          showBuiltInThemes={true}
          className="w-full"
        />
        <label className="label">
          <span className="label-text-alt text-base-content/60">
            Choose from 55+ professional themes for code editors
          </span>
        </label>
      </div>

      {/* Theme Preview */}
      <div className="form-control">
        <label className="label mt-2 mb-2">
          <span className="label-text font-medium">Theme Preview</span>
        </label>
        {renderMonacoPreview()}
      </div>

      {/* Editor Preferences */}
      <div className="form-control">
        <label className="label mt-4 mb-2">
          <span className="label-text font-medium">Editor Preferences</span>
        </label>
        <EditorPreferencesSettings />
      </div>
    </div>
  );
}

// Optional: Export a simplified version for basic use cases
export function SimpleThemeSelector({ value, onChange, className = '', disabled = false }) {
  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <select
      className={`select select-bordered ${className}`}
      value={value}
      onChange={handleChange}
      disabled={disabled}
    >
      <option value="vs">Light (Visual Studio)</option>
      <option value="vs-dark">Dark (Visual Studio Dark)</option>
      <option value="hc-black">High Contrast Black</option>
      {/* hc-light removed - Monaco doesn't properly support it, causes loading errors */}
      <option value="GitHub Light">GitHub Light</option>
      <option value="GitHub Dark">GitHub Dark</option>
      <option value="Night Owl">Night Owl</option>
      <option value="Dracula">Dracula</option>
      <option value="Monokai Bright">Monokai Bright</option>
      <option value="Solarized-light">Solarized Light</option>
      <option value="Solarized-dark">Solarized Dark</option>
    </select>
  );
}