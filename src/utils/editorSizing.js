/**
 * Utility functions for calculating dynamic editor heights based on content
 */

// Default configuration constants
export const MIN_RESULT_HEIGHT = 60; // px - minimum height (approximately 3 lines)
export const MAX_RESULT_HEIGHT = 600; // px - maximum height (approximately 31 lines)
export const DEFAULT_LINE_HEIGHT = 19; // px - typical Monaco editor line height

/**
 * Calculate dynamic height for a Monaco editor based on content line count
 *
 * @param {string} content - The text content to be displayed in the editor
 * @param {number} lineHeight - Height per line in pixels (default: 19)
 * @returns {string} Height value as CSS string (e.g., "228px")
 *
 * @example
 * calculateResultEditorHeight("line1\nline2\nline3") // Returns "60px" (min height)
 * calculateResultEditorHeight("x".repeat(1000).match(/.{1,50}/g).join("\n")) // Returns "600px" (max height)
 */
export function calculateResultEditorHeight(content, lineHeight = DEFAULT_LINE_HEIGHT) {
  // Use countLines for consistent normalization and counting logic
  const lineCount = countLines(content);

  // Handle empty content
  if (lineCount === 0) {
    return `${MIN_RESULT_HEIGHT}px`;
  }

  // Calculate height: lines * line height, plus padding/chrome (add 20px for editor padding)
  const calculatedHeight = (lineCount * lineHeight) + 20;

  // Clamp to min/max bounds
  const clampedHeight = Math.max(MIN_RESULT_HEIGHT, Math.min(MAX_RESULT_HEIGHT, calculatedHeight));

  return `${clampedHeight}px`;
}

/**
 * Count lines in content (useful for display/debugging)
 *
 * @param {string} content - The text content
 * @returns {number} Number of lines
 */
export function countLines(content) {
  if (!content || !content.trim()) {
    return 0;
  }

  const normalizedContent = content.replace(/\r\n/g, '\n');

  return normalizedContent.split('\n').length;
}
