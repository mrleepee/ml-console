import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonacoPerformanceMonitor } from './monacoPerformance';

// Mock performance.memory for testing
const mockPerformanceMemory = {
  usedJSHeapSize: 10000000,
  totalJSHeapSize: 50000000
};

Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: mockPerformanceMemory
  },
  writable: true
});

describe('MonacoPerformanceMonitor', () => {
  let monitor;
  let mockMonaco;
  let mockEditor;

  beforeEach(() => {
    monitor = new MonacoPerformanceMonitor();

    const mockModel = {
      getLineCount: () => 100,
      tokenization: {
        getLineTokens: vi.fn(() => ({}))
      },
      dispose: vi.fn()
    };

    mockMonaco = {
      editor: {
        createModel: vi.fn(() => mockModel),
        setTheme: vi.fn(),
        getThemes: vi.fn(() => [
          { name: 'vs' },
          { name: 'vs-dark' },
          { name: 'hc-black' }
        ])
      }
    };

    mockEditor = {
      _themeService: {
        _theme: {
          themeName: 'vs'
        }
      }
    };

    vi.clearAllMocks();
  });

  describe('Memory Baseline', () => {
    it('should establish memory baseline', () => {
      monitor.establishMemoryBaseline();

      expect(monitor.memoryBaseline).toMatchObject({
        usedJSHeapSize: expect.any(Number),
        totalJSHeapSize: expect.any(Number),
        timestamp: expect.any(Number)
      });
    });

    it('should handle missing performance.memory', () => {
      const originalMemory = global.performance.memory;
      delete global.performance.memory;

      monitor.establishMemoryBaseline();
      expect(monitor.memoryBaseline).toBeNull();

      global.performance.memory = originalMemory;
    });
  });

  describe('Tokenization Performance', () => {
    it('should measure tokenization performance', async () => {
      const testContent = 'let $x := 1\nreturn $x';

      const results = await monitor.measureTokenizationPerformance(mockMonaco, testContent);

      expect(results).toMatchObject({
        duration: expect.any(Number),
        memoryDelta: expect.any(Number),
        lineCount: 100,
        contentSize: testContent.length,
        timestamp: expect.any(Number)
      });

      expect(mockMonaco.editor.createModel).toHaveBeenCalledWith(testContent, 'xquery-ml');
    });

    it('should handle tokenization errors gracefully', async () => {
      mockMonaco.editor.createModel.mockImplementation(() => {
        throw new Error('Monaco error');
      });

      const results = await monitor.measureTokenizationPerformance(mockMonaco, 'test content');

      expect(results).toMatchObject({
        error: 'Monaco error',
        timestamp: expect.any(Number)
      });
    });

    it('should test different content sizes', async () => {
      const smallContent = 'let $x := 1';
      const largeContent = 'let $x := 1\n'.repeat(1000);

      const smallResults = await monitor.measureTokenizationPerformance(mockMonaco, smallContent);
      const largeResults = await monitor.measureTokenizationPerformance(mockMonaco, largeContent);

      expect(smallResults.contentSize).toBe(smallContent.length);
      expect(largeResults.contentSize).toBe(largeContent.length);
      expect(largeResults.contentSize).toBeGreaterThan(smallResults.contentSize);
    });
  });

  describe('Theme Switching Performance', () => {
    it('should measure theme switching performance', async () => {
      const themes = [
        { name: 'vs' },
        { name: 'vs-dark' },
        { name: 'hc-black' }
      ];

      const results = await monitor.measureThemeSwitchingPerformance(mockMonaco, mockEditor, themes);

      expect(results).toMatchObject({
        totalThemes: 3,
        successfulSwitches: 3,
        averageDuration: expect.any(Number),
        maxDuration: expect.any(Number),
        results: expect.arrayContaining([
          expect.objectContaining({
            theme: 'vs',
            duration: expect.any(Number),
            success: true
          })
        ]),
        timestamp: expect.any(Number)
      });

      expect(mockMonaco.editor.setTheme).toHaveBeenCalledTimes(4); // 3 themes + restore
    });

    it('should handle theme switching errors', async () => {
      mockMonaco.editor.setTheme.mockImplementation((theme) => {
        if (theme === 'broken-theme') {
          throw new Error('Theme not found');
        }
      });

      const themes = [
        { name: 'vs' },
        { name: 'broken-theme' }
      ];

      const results = await monitor.measureThemeSwitchingPerformance(mockMonaco, mockEditor, themes);

      expect(results.totalThemes).toBe(2);
      expect(results.successfulSwitches).toBe(1);
      expect(results.results).toContainEqual(
        expect.objectContaining({
          theme: 'broken-theme',
          success: false,
          error: 'Theme not found'
        })
      );
    });
  });

  describe('Memory Profiling', () => {
    it('should profile memory usage during operations', async () => {
      const operations = [
        {
          label: 'test_operation_1',
          fn: async () => { /* mock operation */ }
        },
        {
          label: 'test_operation_2',
          fn: async () => { /* mock operation */ }
        }
      ];

      const results = await monitor.profileMemoryUsage(mockMonaco, operations);

      expect(results).toMatchObject({
        snapshots: expect.arrayContaining([
          expect.objectContaining({
            label: 'start',
            used: expect.any(Number),
            total: expect.any(Number),
            timestamp: expect.any(Number)
          })
        ]),
        peakUsage: expect.any(Number),
        totalDelta: expect.any(Number),
        leakDetection: expect.objectContaining({
          hasLeak: expect.any(Boolean)
        }),
        timestamp: expect.any(Number)
      });
    });

    it('should handle operation errors during profiling', async () => {
      const operations = [
        {
          label: 'failing_operation',
          fn: async () => { throw new Error('Operation failed'); }
        }
      ];

      const results = await monitor.profileMemoryUsage(mockMonaco, operations);

      expect(results.snapshots).toContainEqual(
        expect.objectContaining({
          label: 'failing_operation_error'
        })
      );
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect potential memory leaks', () => {
      const leakySnapshots = [
        { used: 1000000, label: 'start' },
        { used: 2000000, label: 'op1' },
        { used: 3000000, label: 'op2' },
        { used: 4000000, label: 'op3' }
      ];

      const result = monitor.detectMemoryLeaks(leakySnapshots);

      expect(result.hasLeak).toBe(true);
      expect(result.averageGrowth).toBeGreaterThanOrEqual(1000000);
      expect(result.consecutiveGrowthRatio).toBe(1);
    });

    it('should not flag stable memory usage as leak', () => {
      const stableSnapshots = [
        { used: 1000000, label: 'start' },
        { used: 1000100, label: 'op1' },
        { used: 999900, label: 'op2' },
        { used: 1000050, label: 'op3' }
      ];

      const result = monitor.detectMemoryLeaks(stableSnapshots);

      expect(result.hasLeak).toBe(false);
      expect(result.averageGrowth).toBeLessThan(1000000);
    });

    it('should handle insufficient data points', () => {
      const result = monitor.detectMemoryLeaks([{ used: 1000000 }]);
      expect(result.hasLeak).toBe(false);
    });
  });

  describe('Large Content Generation', () => {
    it('should generate XQuery content of specified size', () => {
      const targetSize = 1000;
      const content = monitor.generateLargeXQueryContent(targetSize);

      expect(content.length).toBeLessThanOrEqual(targetSize);
      expect(content).toContain('xquery version');
      expect(content).toContain('declare function');
      expect(content).toContain('for $item in');
    });

    it('should generate larger content with repetitions', () => {
      const smallTarget = 100;
      const largeTarget = 10000;

      const smallContent = monitor.generateLargeXQueryContent(smallTarget);
      const largeContent = monitor.generateLargeXQueryContent(largeTarget);

      expect(largeContent.length).toBeGreaterThan(smallContent.length);
      expect(largeContent.split('xquery version').length).toBeGreaterThan(
        smallContent.split('xquery version').length
      );
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance summary with pass/fail status', () => {
      const mockResults = {
        tokenization: {
          '1000000_bytes': {
            duration: 150, // Well within 200ms threshold for 1MB
            memoryDelta: 1000000
          }
        },
        themeSwitching: {
          averageDuration: 200
        },
        memoryProfile: {
          leakDetection: {
            hasLeak: false
          }
        }
      };

      const summary = monitor.generatePerformanceSummary(mockResults);

      expect(summary.overall).toBe('PASS');
      expect(summary.tests.tokenization_1000000_bytes.status).toBe('PASS');
      expect(summary.tests.theme_switching.status).toBe('PASS');
      expect(summary.tests.memory_leak.status).toBe('PASS');
    });

    it('should fail summary when thresholds are exceeded', () => {
      const mockResults = {
        tokenization: {
          '10000000_bytes': {
            duration: 5000 // Exceeds 2000ms threshold
          }
        },
        themeSwitching: {
          averageDuration: 1000 // Exceeds 500ms threshold
        },
        memoryProfile: {
          leakDetection: {
            hasLeak: true
          }
        }
      };

      const summary = monitor.generatePerformanceSummary(mockResults);

      expect(summary.overall).toBe('FAIL');
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Benchmark Management', () => {
    it('should store and retrieve benchmark results', async () => {
      await monitor.measureTokenizationPerformance(mockMonaco, 'test content');

      const results = monitor.getBenchmarkResults();
      expect(results).toHaveProperty('tokenization');
    });

    it('should clear benchmarks', async () => {
      await monitor.measureTokenizationPerformance(mockMonaco, 'test content');
      monitor.establishMemoryBaseline();

      monitor.clearBenchmarks();

      expect(monitor.getBenchmarkResults()).toEqual({});
      expect(monitor.memoryBaseline).toBeNull();
    });
  });
});