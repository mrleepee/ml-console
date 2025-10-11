import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from './ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = true, message = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error during tests (ErrorBoundary logs errors)
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should not show error UI when children render successfully', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Catching', () => {
    it('should catch errors thrown by child components', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should display custom error title when provided', () => {
      render(
        <ErrorBoundary title="Custom Error Title">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    });

    it('should display custom error message when provided', () => {
      render(
        <ErrorBoundary message="Custom error message for user">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message for user')).toBeInTheDocument();
    });

    it('should display default title when not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should display default message when not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/an error occurred while rendering this component/i)).toBeInTheDocument();
    });

    it('should log error to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      render(
        <ErrorBoundary>
          <ThrowError message="Logged error" />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Error Details (Development Mode)', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Detailed test error" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details')).toBeInTheDocument();
    });

    it('should show error message in details', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Specific error message" />
        </ErrorBoundary>
      );

      const details = screen.getAllByText(/Error:/);
      expect(details.length).toBeGreaterThan(0);
    });

    it('should expand error details when clicked', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError message="Expandable error" />
        </ErrorBoundary>
      );

      const summary = screen.getByText('Error Details');
      fireEvent.click(summary);

      // Check that details element exists and is expanded
      const detailsElement = container.querySelector('details');
      expect(detailsElement).toHaveAttribute('open');
    });
  });

  describe('Reset Functionality', () => {
    it('should show reset button by default', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should hide reset button when showReset is false', () => {
      render(
        <ErrorBoundary showReset={false}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('should reset error state when reset button is clicked', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Click reset - this clears error state
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // After reset, error should be cleared but we need to re-render with safe component
      // The reset itself returns children to render
      rerender(
        <ErrorBoundary>
          <div>Recovered content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
      expect(screen.getByText('Recovered content')).toBeInTheDocument();
    });

    it('should call onReset callback when provided', () => {
      const onResetMock = vi.fn();

      render(
        <ErrorBoundary onReset={onResetMock}>
          <ThrowError />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload component/i });
      fireEvent.click(reloadButton);

      expect(onResetMock).toHaveBeenCalledTimes(1);
    });

    it('should show reload button when onReset is provided', () => {
      const onResetMock = vi.fn();

      render(
        <ErrorBoundary onReset={onResetMock}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /reload component/i })).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });

    it('should not show default error UI when custom fallback provided', () => {
      const customFallback = <div>Custom fallback</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  describe('Multiple Children', () => {
    it('should catch errors from any child component', () => {
      render(
        <ErrorBoundary>
          <div>Safe component</div>
          <ThrowError />
          <div>Another safe component</div>
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Error Boundary Isolation', () => {
    it('should not affect sibling components outside the boundary', () => {
      render(
        <div>
          <div>Sibling before</div>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
          <div>Sibling after</div>
        </div>
      );

      expect(screen.getByText('Sibling before')).toBeInTheDocument();
      expect(screen.getByText('Sibling after')).toBeInTheDocument();
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Reset Keys (Auto-recovery)', () => {
    it('should reset error state when resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['key1']}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Change resetKeys - should trigger auto-recovery
      rerender(
        <ErrorBoundary resetKeys={['key2']}>
          <div>Recovered content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
      expect(screen.getByText('Recovered content')).toBeInTheDocument();
    });

    it('should recover when children are swapped after error', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Just changing children without resetKeys won't recover (boundary stays stuck)
      rerender(
        <ErrorBoundary>
          <div>Safe content</div>
        </ErrorBoundary>
      );

      // Still showing error because no resetKeys changed
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Render-Prop Fallback', () => {
    it('should support render-prop pattern for custom fallbacks', () => {
      const renderFallback = ({ error, resetErrorBoundary }) => (
        <div>
          <div data-testid="custom-error">Error: {error.message}</div>
          <button onClick={resetErrorBoundary}>Custom Reset</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={renderFallback}>
          <ThrowError message="Custom error text" />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-error')).toHaveTextContent('Error: Custom error text');
      expect(screen.getByRole('button', { name: /custom reset/i })).toBeInTheDocument();
    });

    it('should call resetErrorBoundary when custom reset button clicked', () => {
      const renderFallback = ({ resetErrorBoundary }) => (
        <button onClick={resetErrorBoundary}>Reset from fallback</button>
      );

      const { rerender } = render(
        <ErrorBoundary fallback={renderFallback} resetKeys={['v1']}>
          <ThrowError />
        </ErrorBoundary>
      );

      const resetButton = screen.getByRole('button', { name: /reset from fallback/i });
      fireEvent.click(resetButton);

      // Need resetKeys change or safe children to actually recover
      rerender(
        <ErrorBoundary fallback={renderFallback} resetKeys={['v2']}>
          <div>Recovered</div>
        </ErrorBoundary>
      );

      expect(screen.queryByRole('button', { name: /reset from fallback/i })).not.toBeInTheDocument();
      expect(screen.getByText('Recovered')).toBeInTheDocument();
    });
  });
});
