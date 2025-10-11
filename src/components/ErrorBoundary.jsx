import React from 'react';

/**
 * ErrorBoundary - Catches JavaScript errors in child component tree and displays fallback UI
 *
 * Phase 3: Set up Error Boundaries
 * Prevents component crashes from breaking the entire app
 *
 * Usage:
 * <ErrorBoundary fallback={<CustomError />}>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store error details in state
    this.setState({
      error,
      errorInfo
    });

    // Optional: Send error to logging service
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="alert alert-error">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="font-bold">{this.props.title || 'Something went wrong'}</h3>
                <div className="text-sm mt-1">
                  {this.props.message || 'An error occurred while rendering this component.'}
                </div>
              </div>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
                <div className="mt-2 p-3 bg-base-100 rounded text-xs font-mono overflow-auto max-h-48">
                  <div className="font-bold text-error">Error:</div>
                  <pre className="whitespace-pre-wrap">{this.state.error.toString()}</pre>

                  {this.state.errorInfo && (
                    <>
                      <div className="font-bold text-error mt-3">Component Stack:</div>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}

            {/* Reset button */}
            {this.props.showReset !== false && (
              <div className="flex gap-2">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={this.handleReset}
                >
                  Try Again
                </button>
                {this.props.onReset && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      this.handleReset();
                      this.props.onReset();
                    }}
                  >
                    Reload Component
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
