import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { lazy, Suspense } from 'react';
import LoadingBoundary, { EditorFallback } from './LoadingBoundary';

// Simulate a lazy-loaded component
const LazyComponent = lazy(() =>
  new Promise((resolve) =>
    setTimeout(() => resolve({ default: () => <div>Lazy loaded content</div> }), 100)
  )
);

// Simulate a component that loads immediately
const InstantComponent = lazy(() =>
  Promise.resolve({ default: () => <div>Instant content</div> })
);

describe('LoadingBoundary', () => {
  describe('Default Behavior', () => {
    it('should render children immediately when not lazy', () => {
      render(
        <LoadingBoundary>
          <div>Normal content</div>
        </LoadingBoundary>
      );

      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should show default loading spinner while lazy component loads', () => {
      render(
        <LoadingBoundary>
          <LazyComponent />
        </LoadingBoundary>
      );

      // Should show loading spinner
      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('should render lazy component after loading', async () => {
      render(
        <LoadingBoundary>
          <LazyComponent />
        </LoadingBoundary>
      );

      // Wait for lazy component to load
      await waitFor(
        () => {
          expect(screen.getByText('Lazy loaded content')).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('should not show loading spinner after component loads', async () => {
      render(
        <LoadingBoundary>
          <LazyComponent />
        </LoadingBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Lazy loaded content')).toBeInTheDocument();
      });

      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-loading">Custom loading...</div>;

      render(
        <LoadingBoundary fallback={customFallback}>
          <LazyComponent />
        </LoadingBoundary>
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
      expect(screen.getByText('Custom loading...')).toBeInTheDocument();
    });

    it('should not show default spinner when custom fallback provided', () => {
      const customFallback = <div>Custom loading</div>;

      render(
        <LoadingBoundary fallback={customFallback}>
          <LazyComponent />
        </LoadingBoundary>
      );

      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).not.toBeInTheDocument();
    });

    it('should replace custom fallback with content after loading', async () => {
      const customFallback = <div>Loading custom content...</div>;

      render(
        <LoadingBoundary fallback={customFallback}>
          <LazyComponent />
        </LoadingBoundary>
      );

      expect(screen.getByText('Loading custom content...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Lazy loaded content')).toBeInTheDocument();
        expect(screen.queryByText('Loading custom content...')).not.toBeInTheDocument();
      });
    });
  });

  describe('EditorFallback', () => {
    it('should render EditorFallback with default height', () => {
      const { container } = render(<EditorFallback />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveStyle({ height: '400px' });
    });

    it('should render EditorFallback with custom height', () => {
      const { container } = render(<EditorFallback height="600px" />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveStyle({ height: '600px' });
    });

    it('should have skeleton animation classes', () => {
      const { container } = render(<EditorFallback />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('should render skeleton placeholder lines', () => {
      const { container } = render(<EditorFallback />);

      // Should have 4 placeholder lines
      const lines = container.querySelectorAll('.h-4');
      expect(lines.length).toBe(4);
    });

    it('should match editor styling', () => {
      const { container } = render(<EditorFallback />);

      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('rounded');
      expect(skeleton).toHaveClass('border');
    });
  });

  describe('Phase 2 Integration (Lazy Loading)', () => {
    it('should work with React.lazy and Suspense pattern', async () => {
      render(
        <LoadingBoundary>
          <InstantComponent />
        </LoadingBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Instant content')).toBeInTheDocument();
      });
    });

    it('should show EditorFallback for Monaco lazy loading', async () => {
      const { container } = render(
        <LoadingBoundary fallback={<EditorFallback height="500px" />}>
          <LazyComponent />
        </LoadingBoundary>
      );

      // Should show editor skeleton
      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText('Lazy loaded content')).toBeInTheDocument();
      });
    });

    it('should prevent layout shift with consistent height', () => {
      const { container } = render(
        <LoadingBoundary fallback={<EditorFallback height="450px" />}>
          <LazyComponent />
        </LoadingBoundary>
      );

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeTruthy();
      expect(skeleton).toHaveStyle({ height: '450px' });
    });
  });

  describe('Multiple Children', () => {
    it('should handle multiple lazy components', async () => {
      render(
        <LoadingBoundary>
          <div>
            <InstantComponent />
            <InstantComponent />
          </div>
        </LoadingBoundary>
      );

      await waitFor(() => {
        const content = screen.getAllByText('Instant content');
        expect(content).toHaveLength(2);
      });
    });
  });

  describe('Suspense Behavior', () => {
    it('should be compatible with nested Suspense boundaries', async () => {
      render(
        <LoadingBoundary fallback={<div>Outer loading</div>}>
          <Suspense fallback={<div>Inner loading</div>}>
            <InstantComponent />
          </Suspense>
        </LoadingBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Instant content')).toBeInTheDocument();
      });
    });

    it('should work with standard Suspense component', async () => {
      render(
        <Suspense fallback={<div>Standard Suspense loading</div>}>
          <InstantComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByText('Instant content')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should work with error boundaries for lazy loading failures', () => {
      // Lazy loading errors should be caught by error boundaries (Phase 3)
      // This test verifies LoadingBoundary doesn't interfere with error propagation
      const FailingComponent = lazy(() =>
        Promise.reject(new Error('Failed to load'))
      );

      // Suppress error output in test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw during render (errors are async)
      expect(() => {
        render(
          <LoadingBoundary>
            <FailingComponent />
          </LoadingBoundary>
        );
      }).not.toThrow();

      consoleError.mockRestore();
    });
  });
});
