// Monaco Editor theme definitions and utilities
// Centralized theme management to avoid duplication

// Helper function to get enhanced theme name
export const getEnhancedTheme = (themeName) => {
  // Normalize theme name by trimming whitespace
  const normalizedTheme = (themeName || '').trim();

  switch (normalizedTheme) {
    case 'vs':
      return 'vs-enhanced';
    case 'vs-dark':
      return 'vs-dark-enhanced';
    case 'hc-black':
      return 'hc-black-enhanced';
    case 'hc-light':
      return 'hc-light-enhanced';
    default:
      console.warn(`getEnhancedTheme: Unknown theme '${normalizedTheme}', defaulting to vs-dark-enhanced to preserve dark mode`);
      return 'vs-dark-enhanced';  // Default to dark theme instead of light
  }
};

// Define custom Monaco themes with proper selection highlighting
export const defineCustomMonacoThemes = (monaco) => {
  // Enhanced light theme with visible selection
  monaco.editor.defineTheme('vs-enhanced', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#ADD8E6CC',  // Light blue with transparency
      'editor.selectionForeground': '#000000',
      'editor.selectionHighlightBackground': '#B4D8FACC',  // Slightly different blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#E0E0E0AA',  // Gray for inactive selections
      'editor.selectionHighlightBorder': '#0078D4',  // Blue border for selection highlights
      'editor.findMatchBackground': '#FFFF00AA',  // Yellow for find matches
      'editor.findMatchHighlightBackground': '#FFFF0066',  // Lighter yellow for other matches
    }
  });

  // Enhanced dark theme with visible selection
  monaco.editor.defineTheme('vs-dark-enhanced', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#264F78CC',  // Dark blue with transparency
      'editor.selectionForeground': '#FFFFFF',
      'editor.selectionHighlightBackground': '#3A5998AA',  // Lighter blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#3C3C3CAA',  // Dark gray for inactive selections
      'editor.selectionHighlightBorder': '#4A90E2',  // Blue border for selection highlights
      'editor.findMatchBackground': '#515C6ACC',  // Dark blue for find matches
      'editor.findMatchHighlightBackground': '#515C6A88',  // Lighter for other matches
    }
  });

  // Enhanced high contrast black theme with visible selection
  monaco.editor.defineTheme('hc-black-enhanced', {
    base: 'hc-black',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#0000FFAA',  // Bright blue with transparency
      'editor.selectionForeground': '#FFFFFF',
      'editor.selectionHighlightBackground': '#0080FFAA',  // Lighter blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#808080AA',  // Gray for inactive selections
      'editor.selectionHighlightBorder': '#FFFFFF',  // White border for maximum contrast
      'editor.findMatchBackground': '#FFFF00CC',  // Bright yellow for find matches
      'editor.findMatchHighlightBackground': '#FFFF0088',  // Lighter yellow for other matches
    }
  });

  // Enhanced high contrast light theme with visible selection
  monaco.editor.defineTheme('hc-light-enhanced', {
    base: 'hc-light',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#0000FFAA',  // Bright blue with transparency
      'editor.selectionForeground': '#000000',
      'editor.selectionHighlightBackground': '#0080FFAA',  // Lighter blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#C0C0C0AA',  // Light gray for inactive selections
      'editor.selectionHighlightBorder': '#000000',  // Black border for maximum contrast
      'editor.findMatchBackground': '#FFFF00CC',  // Bright yellow for find matches
      'editor.findMatchHighlightBackground': '#FFFF0088',  // Lighter yellow for other matches
    }
  });
};
