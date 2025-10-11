export class MonacoPerformanceMonitor {
  constructor() {
    this.benchmarks = new Map();
    this.memoryBaseline = null;
    this.performanceThresholds = {
      tokenizationTime: 2000, // 2 seconds for 10MB files
      memoryOverhead: 0.2,    // 20% above baseline
      themeSwitchTime: 500    // 500ms for theme switching
    };
  }

  // Establish memory baseline before Monaco operations
  establishMemoryBaseline() {
    if (performance.memory) {
      this.memoryBaseline = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        timestamp: Date.now()
      };
      console.log('Performance baseline established:', this.memoryBaseline);
    }
  }

  // Measure tokenization performance for large files
  async measureTokenizationPerformance(monaco, content, language = 'xquery-ml') {
    const startTime = performance.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

    try {
      // Create a temporary model for testing
      const model = monaco.editor.createModel(content, language);

      // Force tokenization by requesting all tokens
      const lineCount = model.getLineCount();
      for (let i = 1; i <= lineCount; i++) {
        model.tokenization?.getLineTokens?.(i);
      }

      const endTime = performance.now();
      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      const results = {
        duration: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        lineCount: lineCount,
        contentSize: content.length,
        timestamp: Date.now()
      };

      // Clean up
      model.dispose();

      this.benchmarks.set('tokenization', results);
      return results;

    } catch (error) {
      console.error('Tokenization performance test failed:', error);
      return { error: error.message, timestamp: Date.now() };
    }
  }

  // Measure theme switching performance across all available themes
  async measureThemeSwitchingPerformance(monaco, editor, themes) {
    const results = [];
    const originalTheme = editor._themeService?._theme?.themeName || 'vs';

    for (const theme of themes) {
      const startTime = performance.now();

      try {
        monaco.editor.setTheme(theme.name);
        // Wait for theme to apply
        await new Promise(resolve => setTimeout(resolve, 10));

        const endTime = performance.now();
        results.push({
          theme: theme.name,
          duration: endTime - startTime,
          success: true
        });
      } catch (error) {
        results.push({
          theme: theme.name,
          duration: -1,
          success: false,
          error: error.message
        });
      }
    }

    // Restore original theme
    monaco.editor.setTheme(originalTheme);

    const aggregateResults = {
      totalThemes: themes.length,
      successfulSwitches: results.filter(r => r.success).length,
      averageDuration: results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.success).length,
      maxDuration: Math.max(...results.filter(r => r.success).map(r => r.duration)),
      results: results,
      timestamp: Date.now()
    };

    this.benchmarks.set('themeSwitching', aggregateResults);
    return aggregateResults;
  }

  // Memory usage profiling during different operations
  async profileMemoryUsage(monaco, operations) {
    const memorySnapshots = [];

    const takeSnapshot = (label) => {
      if (performance.memory) {
        memorySnapshots.push({
          label,
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          timestamp: Date.now()
        });
      }
    };

    takeSnapshot('start');

    for (const operation of operations) {
      try {
        await operation.fn();
        takeSnapshot(operation.label);
      } catch (error) {
        takeSnapshot(`${operation.label}_error`);
        console.error(`Memory profiling operation '${operation.label}' failed:`, error);
      }
    }

    const results = {
      snapshots: memorySnapshots,
      peakUsage: Math.max(...memorySnapshots.map(s => s.used)),
      totalDelta: memorySnapshots[memorySnapshots.length - 1]?.used - memorySnapshots[0]?.used,
      leakDetection: this.detectMemoryLeaks(memorySnapshots),
      timestamp: Date.now()
    };

    this.benchmarks.set('memoryUsage', results);
    return results;
  }

  // Detect potential memory leaks
  detectMemoryLeaks(snapshots) {
    if (snapshots.length < 3) return { hasLeak: false };

    const growth = [];
    for (let i = 1; i < snapshots.length; i++) {
      growth.push(snapshots[i].used - snapshots[i-1].used);
    }

    const averageGrowth = growth.reduce((sum, g) => sum + g, 0) / growth.length;
    const consecutiveGrowth = growth.filter(g => g > 0).length;
    const consecutiveGrowthRatio = consecutiveGrowth / growth.length;

    // Detect leak: average growth >= 1MB AND more than 70% consecutive growth
    const hasLeak = averageGrowth >= 1000000 && consecutiveGrowthRatio > 0.7;

    return {
      hasLeak,
      averageGrowth,
      consecutiveGrowthRatio,
      recommendation: averageGrowth > 1000000 ? 'Investigate potential memory leak' : 'Memory usage appears stable'
    };
  }

  // Generate large XQuery content for testing
  generateLargeXQueryContent(targetSizeBytes) {
    const baseQuery = `
(: Large XQuery test file for performance testing :)
xquery version "3.0-ml";

declare namespace local = "http://example.com/local";

declare function local:process-items($items as element()*) as element()* {
  for $item in $items
  let $id := $item/@id
  let $value := $item/value
  where fn:exists($value) and fn:string-length($value) > 0
  order by $value descending
  return
    <processed-item id="{$id}">
      <original-value>{$value}</original-value>
      <processed-value>{fn:upper-case($value)}</processed-value>
      <timestamp>{fn:current-dateTime()}</timestamp>
      <nested>
        {
          for $j in 1 to 10
          return
            <sub-item index="{$j}">
              <computed>{$j * fn:number($value)}</computed>
            </sub-item>
        }
      </nested>
    </processed-item>
};

declare variable $large-collection :=
  for $i in 1 to 1000
  return
    <item id="{$i}">
      <value>{$i * 2}</value>
      <metadata category="test" group="{$i mod 10}">
        <description>Test item number {$i} with various content</description>
        <tags>
          {
            for $tag in ("performance", "test", "large", "xquery")
            return <tag>{$tag}-{$i}</tag>
          }
        </tags>
      </metadata>
    </item>;

(: Main processing logic :)
let $results := local:process-items($large-collection)
let $filtered := $results[fn:number(./original-value) > 500]
return
  <report>
    <summary>
      <total-items>{fn:count($large-collection)}</total-items>
      <processed-items>{fn:count($results)}</processed-items>
      <filtered-items>{fn:count($filtered)}</filtered-items>
      <generated-at>{fn:current-dateTime()}</generated-at>
    </summary>
    <items>
      {$filtered}
    </items>
  </report>
`;

    let content = '';
    const baseSize = baseQuery.length;
    const repetitions = Math.ceil(targetSizeBytes / baseSize);

    for (let i = 0; i < repetitions; i++) {
      content += baseQuery.replace(/1000/g, `${1000 + i * 1000}`);
      content += '\n\n';
    }

    return content.slice(0, targetSizeBytes);
  }

  // Comprehensive performance test suite
  async runPerformanceTestSuite(monaco, editor) {
    console.log('Starting Monaco performance test suite...');

    this.establishMemoryBaseline();

    const testSizes = [100000, 1000000, 5000000]; // 100KB, 1MB, 5MB
    const results = {
      baseline: this.memoryBaseline,
      tokenization: {},
      themeSwitching: null,
      memoryProfile: null,
      summary: {},
      timestamp: Date.now()
    };

    // Test tokenization performance at different file sizes
    for (const size of testSizes) {
      const content = this.generateLargeXQueryContent(size);
      const tokenResults = await this.measureTokenizationPerformance(monaco, content);
      results.tokenization[`${size}_bytes`] = tokenResults;

      console.log(`Tokenization test (${size} bytes): ${tokenResults.duration?.toFixed(2)}ms`);
    }

    // Test theme switching performance
    const themes = monaco.editor.getThemes?.() || [
      { name: 'vs' }, { name: 'vs-dark' }, { name: 'hc-black' }
    ];
    results.themeSwitching = await this.measureThemeSwitchingPerformance(monaco, editor, themes);
    console.log(`Theme switching average: ${results.themeSwitching.averageDuration?.toFixed(2)}ms`);

    // Memory profiling
    const memoryOperations = [
      {
        label: 'create_large_model',
        fn: async () => {
          const content = this.generateLargeXQueryContent(1000000);
          const model = monaco.editor.createModel(content, 'xquery-ml');
          setTimeout(() => model.dispose(), 100);
        }
      },
      {
        label: 'theme_switching',
        fn: async () => {
          for (const theme of themes.slice(0, 5)) {
            monaco.editor.setTheme(theme.name);
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }
    ];

    results.memoryProfile = await this.profileMemoryUsage(monaco, memoryOperations);

    // Generate summary with pass/fail status
    results.summary = this.generatePerformanceSummary(results);

    console.log('Performance test suite completed:', results.summary);
    return results;
  }

  // Generate performance summary with pass/fail indicators
  generatePerformanceSummary(results) {
    const summary = {
      overall: 'PASS',
      tests: {},
      recommendations: []
    };

    // Check tokenization performance
    Object.entries(results.tokenization).forEach(([size, data]) => {
      if (data.duration) {
        const sizeBytes = parseInt(size.split('_')[0]);
        // Scale threshold: 2000ms for 10MB = 200ms per MB
        const scaledThreshold = Math.max(100, this.performanceThresholds.tokenizationTime * (sizeBytes / 10000000));
        const passed = data.duration <= scaledThreshold;

        summary.tests[`tokenization_${size}`] = {
          status: passed ? 'PASS' : 'FAIL',
          duration: data.duration,
          threshold: scaledThreshold,
          memoryDelta: data.memoryDelta
        };

        if (!passed) {
          summary.overall = 'FAIL';
          summary.recommendations.push(`Optimize tokenization for ${size} files (${data.duration}ms > ${scaledThreshold}ms)`);
        }
      }
    });

    // Check theme switching performance
    if (results.themeSwitching?.averageDuration) {
      const passed = results.themeSwitching.averageDuration <= this.performanceThresholds.themeSwitchTime;
      summary.tests.theme_switching = {
        status: passed ? 'PASS' : 'FAIL',
        averageDuration: results.themeSwitching.averageDuration,
        threshold: this.performanceThresholds.themeSwitchTime
      };

      if (!passed) {
        summary.overall = 'FAIL';
        summary.recommendations.push(`Optimize theme switching (${results.themeSwitching.averageDuration}ms > ${this.performanceThresholds.themeSwitchTime}ms)`);
      }
    }

    // Check memory usage
    if (results.memoryProfile?.leakDetection?.hasLeak) {
      summary.tests.memory_leak = {
        status: 'FAIL',
        details: results.memoryProfile.leakDetection
      };
      summary.overall = 'FAIL';
      summary.recommendations.push('Investigate potential memory leak detected');
    } else {
      summary.tests.memory_leak = { status: 'PASS' };
    }

    return summary;
  }

  // Get benchmark results
  getBenchmarkResults() {
    return Object.fromEntries(this.benchmarks);
  }

  // Clear all benchmark data
  clearBenchmarks() {
    this.benchmarks.clear();
    this.memoryBaseline = null;
  }
}

// Export singleton instance for easy use
export const monacoPerformanceMonitor = new MonacoPerformanceMonitor();