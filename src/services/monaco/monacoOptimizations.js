// Monaco Editor performance optimizations for large XQuery files and theme switching

export class MonacoOptimizationManager {
  constructor() {
    this.optimizationSettings = {
      // Large file optimizations
      largeFileThreshold: 1000000, // 1MB
      veryLargeFileThreshold: 5000000, // 5MB

      // Editor options for different file sizes
      defaultOptions: {
        minimap: { enabled: false }, // Disabled - future editor control feature
        wordWrap: 'on',
        lineNumbers: 'on',
        folding: true,
        bracketMatching: 'always',
        automaticLayout: true,
        scrollBeyondLastLine: true,
        renderLineHighlight: 'all',
        occurrencesHighlight: true,
        selectionHighlight: true
      },

      largeFileOptions: {
        minimap: { enabled: false },
        wordWrap: 'off',
        lineNumbers: 'on',
        folding: false,
        bracketMatching: 'near',
        automaticLayout: false,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        occurrencesHighlight: false,
        selectionHighlight: false
      },

      veryLargeFileOptions: {
        minimap: { enabled: false },
        wordWrap: 'off',
        lineNumbers: 'off',
        folding: false,
        bracketMatching: 'never',
        automaticLayout: false,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        occurrencesHighlight: false,
        selectionHighlight: false,
        renderWhitespace: 'none',
        renderControlCharacters: false
      }
    };

    this.registrationCache = new WeakMap();
    this.themeCache = new Map();
  }

  // Get optimized editor options based on content size
  getOptimizedEditorOptions(content = '', baseOptions = {}) {
    const contentSize = content.length;
    let optimizations = this.optimizationSettings.defaultOptions;

    if (contentSize >= this.optimizationSettings.veryLargeFileThreshold) {
      optimizations = this.optimizationSettings.veryLargeFileOptions;
      console.log(`Applying very large file optimizations for ${contentSize} bytes`);
    } else if (contentSize >= this.optimizationSettings.largeFileThreshold) {
      optimizations = this.optimizationSettings.largeFileOptions;
      console.log(`Applying large file optimizations for ${contentSize} bytes`);
    }

    return {
      ...baseOptions,
      ...optimizations
    };
  }

  // Optimized XQuery language registration with caching
  async registerXQueryLanguageOptimized(monaco, config) {
    // Check if already registered for this Monaco instance
    if (this.registrationCache.has(monaco)) {
      return this.registrationCache.get(monaco);
    }

    // Import and register XQuery language
    try {
      const { registerXQueryLanguage } = await import('./monacoXquery.js');
      const result = registerXQueryLanguage(monaco, config);
      this.registrationCache.set(monaco, result);
      return result;
    } catch (error) {
      console.error('XQuery language registration failed:', error);
      return null;
    }
  }

  // Optimized theme switching with caching and batching
  async switchThemeOptimized(monaco, themeName, editor) {
    // Check theme cache first
    if (this.themeCache.has(themeName)) {
      const cachedTheme = this.themeCache.get(themeName);
      if (cachedTheme.status === 'ready') {
        monaco.editor.setTheme(themeName);
        return true;
      }
    }

    try {
      // Batch theme operations to avoid multiple redraws
      const themeOperations = () => {
        monaco.editor.setTheme(themeName);

        // Cache successful theme application
        this.themeCache.set(themeName, {
          status: 'ready',
          appliedAt: Date.now()
        });
      };

      // Use requestAnimationFrame for smooth theme transitions
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          try {
            themeOperations();
            resolve(true);
          } catch (error) {
            console.error(`Theme switching failed for ${themeName}:`, error);
            this.themeCache.set(themeName, {
              status: 'error',
              error: error.message,
              failedAt: Date.now()
            });
            resolve(false);
          }
        });
      });

    } catch (error) {
      console.error('Theme switching error:', error);
      return false;
    }
  }

  // Debounced content change handler for large files
  createOptimizedChangeHandler(originalHandler, contentSize = 0) {
    const debounceTime = contentSize > this.optimizationSettings.largeFileThreshold ? 500 : 100;

    let timeoutId = null;
    let lastChange = null;

    return (value, event) => {
      lastChange = { value, event };

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        if (originalHandler && lastChange) {
          originalHandler(lastChange.value, lastChange.event);
        }
        lastChange = null;
      }, debounceTime);
    };
  }

  // Memory-efficient model management
  createOptimizedModel(monaco, content, language, uri) {
    const options = {
      insertSpaces: true,
      tabSize: 2,
      trimAutoWhitespace: true
    };

    // For large files, disable certain features that consume memory
    if (content.length > this.optimizationSettings.largeFileThreshold) {
      options.largeFileOptimizations = true;
    }

    try {
      const model = uri
        ? monaco.editor.createModel(content, language, uri)
        : monaco.editor.createModel(content, language);

      // Set model options for optimization
      if (model.updateOptions) {
        model.updateOptions(options);
      }

      return model;
    } catch (error) {
      console.error('Model creation failed:', error);
      // Fallback to basic model
      return monaco.editor.createModel(content || '', language);
    }
  }

  // Optimized editor disposal and cleanup
  disposeOptimized(editor, model) {
    try {
      // Clear any pending timeouts or animations
      if (this.pendingOperations) {
        this.pendingOperations.forEach(op => {
          if (op.cancel) op.cancel();
        });
        this.pendingOperations.clear();
      }

      // Dispose model first to free memory
      if (model && model.dispose) {
        model.dispose();
      }

      // Then dispose editor
      if (editor && editor.dispose) {
        editor.dispose();
      }

    } catch (error) {
      console.error('Editor disposal error:', error);
    }
  }

  // Performance monitoring integration
  async enablePerformanceMonitoring(monaco, editor) {
    if (process.env.NODE_ENV === 'development') {
      try {
        // Dynamic import for development-only monitoring
        const { monacoPerformanceMonitor } = await import('./monacoPerformance.js');

        // Monitor theme switches
        const originalSetTheme = monaco.editor.setTheme;
        monaco.editor.setTheme = function(themeName) {
          const start = performance.now();
          const result = originalSetTheme.call(this, themeName);
          const duration = performance.now() - start;

          if (duration > 100) { // Log slow theme switches
            console.warn(`Slow theme switch to ${themeName}: ${duration.toFixed(2)}ms`);
          }

          return result;
        };

        // Monitor large content loads
        if (editor && editor.onDidChangeModelContent) {
          editor.onDidChangeModelContent((e) => {
            const model = editor.getModel();
            if (model) {
              const contentSize = model.getValueLength();
              if (contentSize > this.optimizationSettings.largeFileThreshold) {
                console.log(`Large content detected: ${contentSize} bytes`);
              }
            }
          });
        }
      } catch (error) {
        console.warn('Performance monitoring could not be enabled:', error);
      }
    }
  }

  // Cleanup theme cache periodically
  cleanupThemeCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [themeName, cacheEntry] of this.themeCache.entries()) {
      const age = now - (cacheEntry.appliedAt || cacheEntry.failedAt || now);
      if (age > maxAge) {
        this.themeCache.delete(themeName);
      }
    }
  }

  // Get optimization recommendations based on current state
  getOptimizationRecommendations(contentSize, currentOptions = {}) {
    const recommendations = [];

    if (contentSize > this.optimizationSettings.veryLargeFileThreshold) {
      recommendations.push({
        level: 'critical',
        message: 'Very large file detected. Consider splitting into smaller modules.',
        suggestion: 'Disable minimap, line highlighting, and folding for better performance.'
      });
    } else if (contentSize > this.optimizationSettings.largeFileThreshold) {
      recommendations.push({
        level: 'warning',
        message: 'Large file may impact editor performance.',
        suggestion: 'Consider disabling minimap and some visual features.'
      });
    }

    if (currentOptions.minimap?.enabled && contentSize > this.optimizationSettings.largeFileThreshold) {
      recommendations.push({
        level: 'info',
        message: 'Minimap is enabled for large file.',
        suggestion: 'Disable minimap to improve scrolling performance.'
      });
    }

    return recommendations;
  }

  // Apply runtime optimizations
  applyRuntimeOptimizations(editor, content) {
    if (!editor || !content) return;

    const contentSize = content.length;
    const recommendations = this.getOptimizationRecommendations(contentSize);

    // Apply automatic optimizations for very large files
    if (contentSize > this.optimizationSettings.veryLargeFileThreshold) {
      try {
        editor.updateOptions({
          minimap: { enabled: false },
          folding: false,
          renderLineHighlight: 'none',
          occurrencesHighlight: false
        });
        console.log('Applied automatic optimizations for very large file');
      } catch (error) {
        console.error('Failed to apply runtime optimizations:', error);
      }
    }

    // Log recommendations for manual optimization
    if (recommendations.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('Performance recommendations:', recommendations);
    }
  }
}

// Export singleton instance
export const monacoOptimizationManager = new MonacoOptimizationManager();

// Utility function for React components
export const useMonacoOptimizations = (content = '', baseOptions = {}) => {
  return monacoOptimizationManager.getOptimizedEditorOptions(content, baseOptions);
};