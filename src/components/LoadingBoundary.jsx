import React, { Suspense } from 'react';

/**
 * DefaultFallback - Shows a centered loading spinner
 */
const DefaultFallback = () => (
  <div className="flex items-center justify-center p-4">
    <span className="loading loading-spinner loading-lg"></span>
  </div>
);

/**
 * EditorFallback - Skeleton loader that matches Monaco editor dimensions
 * Prevents layout shift during lazy load
 *
 * @param {string} height - Editor height (default: '400px')
 */
export const EditorFallback = ({ height = '400px' }) => (
  <div
    className="animate-pulse bg-base-300 rounded border border-base-content/10"
    style={{ height }}
  >
    <div className="p-4 space-y-3">
      <div className="h-4 bg-base-content/20 rounded w-3/4"></div>
      <div className="h-4 bg-base-content/20 rounded w-full"></div>
      <div className="h-4 bg-base-content/20 rounded w-5/6"></div>
      <div className="h-4 bg-base-content/20 rounded w-2/3"></div>
    </div>
  </div>
);

/**
 * LoadingBoundary - Wraps components in React Suspense with customizable fallback
 *
 * @param {React.ReactNode} children - Components to lazy-load
 * @param {React.ReactNode} fallback - Loading UI (defaults to spinner)
 */
export function LoadingBoundary({ children, fallback = <DefaultFallback /> }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

export default LoadingBoundary;
