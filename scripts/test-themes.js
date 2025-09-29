#!/usr/bin/env node

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const OUTPUT_DIR = join(__dirname, '../coverage/theme-tests');
const SNAPSHOT_FILE = join(OUTPUT_DIR, 'theme-snapshots.json');
const REPORT_FILE = join(OUTPUT_DIR, 'theme-test-report.json');

class ThemeTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: { total: 0, passed: 0, failed: 0 },
      themes: [],
      errors: []
    };
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
      throw error;
    }
  }

  async loadPreviousSnapshot() {
    try {
      const data = await fs.readFile(SNAPSHOT_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log('No previous snapshot found, creating new baseline');
      return null;
    }
  }

  async saveSnapshot(data) {
    await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(data, null, 2));
    console.log(`Theme snapshot saved to ${SNAPSHOT_FILE}`);
  }

  async saveReport(report) {
    await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Theme test report saved to ${REPORT_FILE}`);
  }

  compareSnapshots(current, previous) {
    if (!previous) return { isMatch: true, differences: [] };

    const differences = [];

    // Compare theme counts
    if (current.summary.totalThemes !== previous.summary.totalThemes) {
      differences.push({
        type: 'theme_count_change',
        current: current.summary.totalThemes,
        previous: previous.summary.totalThemes
      });
    }

    // Compare individual theme results
    for (const [themeName, currentSnapshot] of Object.entries(current.snapshots)) {
      const previousSnapshot = previous.snapshots?.[themeName];

      if (!previousSnapshot) {
        differences.push({
          type: 'new_theme',
          theme: themeName
        });
        continue;
      }

      if (currentSnapshot.error && !previousSnapshot.error) {
        differences.push({
          type: 'theme_regression',
          theme: themeName,
          error: currentSnapshot.error
        });
      } else if (!currentSnapshot.error && previousSnapshot.error) {
        differences.push({
          type: 'theme_fixed',
          theme: themeName
        });
      }

      // Compare token structure
      if (!currentSnapshot.error && !previousSnapshot.error) {
        const currentTokenCount = currentSnapshot.tokens?.length || 0;
        const previousTokenCount = previousSnapshot.tokens?.length || 0;

        if (currentTokenCount !== previousTokenCount) {
          differences.push({
            type: 'token_structure_change',
            theme: themeName,
            currentTokens: currentTokenCount,
            previousTokens: previousTokenCount
          });
        }
      }
    }

    return {
      isMatch: differences.length === 0,
      differences
    };
  }

  async runPuppeteerTest() {
    console.log('Starting Puppeteer-based theme testing...');

    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.goto('http://localhost:3025', { waitUntil: 'networkidle2' });

      // Wait for Monaco to initialize
      await page.waitForFunction(() => window.monaco !== undefined, { timeout: 15000 });

      // Inject theme test framework
      const frameworkCode = await fs.readFile(
        join(__dirname, '../src/utils/themeTestFramework.js'),
        'utf8'
      );

      await page.evaluate(frameworkCode);

      // Run theme tests
      const testResults = await page.evaluate(async () => {
        const { createThemeTestSuite } = window;
        const suite = createThemeTestSuite(window.monaco);

        try {
          await suite.initialize();
          const report = await suite.runAllThemeTests();
          const consistency = suite.validateTokenConsistency();

          return {
            success: true,
            report,
            consistency
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      await browser.close();

      if (!testResults.success) {
        throw new Error(`Theme testing failed: ${testResults.error}`);
      }

      return testResults;

    } catch (error) {
      console.error('Puppeteer test failed:', error);
      throw error;
    }
  }

  async run() {
    console.log('🎨 Starting automated theme testing...\n');

    try {
      await this.ensureOutputDirectory();

      // Load previous snapshot for comparison
      const previousSnapshot = await this.loadPreviousSnapshot();

      // Run the actual tests
      const testResults = await this.runPuppeteerTest();

      // Save current snapshot
      await this.saveSnapshot(testResults.report);

      // Compare with previous snapshot
      const comparison = this.compareSnapshots(testResults.report, previousSnapshot);

      // Generate comprehensive report
      const finalReport = {
        timestamp: new Date().toISOString(),
        summary: testResults.report.summary,
        consistency: testResults.consistency,
        comparison: comparison,
        themes: testResults.report.successful,
        failures: testResults.report.failed,
        tokenStats: testResults.report.tokenStats
      };

      await this.saveReport(finalReport);

      // Print summary
      console.log('\n📊 Theme Test Results:');
      console.log(`   Total themes: ${finalReport.summary.totalThemes}`);
      console.log(`   Successful: ${finalReport.summary.successful}`);
      console.log(`   Failed: ${finalReport.summary.failed}`);
      console.log(`   Consistency: ${finalReport.consistency.consistent ? '✅' : '❌'}`);

      if (finalReport.failures.length > 0) {
        console.log('\n❌ Failed themes:');
        finalReport.failures.forEach(failure => {
          console.log(`   - ${failure.theme}: ${failure.error}`);
        });
      }

      if (comparison.differences.length > 0) {
        console.log('\n🔄 Changes from previous run:');
        comparison.differences.forEach(diff => {
          switch (diff.type) {
            case 'new_theme':
              console.log(`   + New theme: ${diff.theme}`);
              break;
            case 'theme_regression':
              console.log(`   ❌ Theme regression: ${diff.theme} (${diff.error})`);
              break;
            case 'theme_fixed':
              console.log(`   ✅ Theme fixed: ${diff.theme}`);
              break;
            case 'token_structure_change':
              console.log(`   📝 Token structure changed: ${diff.theme} (${diff.previousTokens} → ${diff.currentTokens})`);
              break;
          }
        });
      }

      console.log(`\n📁 Reports saved to: ${OUTPUT_DIR}`);

      // Exit with appropriate code
      const hasFailures = finalReport.summary.failed > 0;
      const hasRegressions = comparison.differences.some(d => d.type === 'theme_regression');

      if (hasFailures || hasRegressions) {
        process.exit(1);
      } else {
        console.log('\n✅ All theme tests passed!');
        process.exit(0);
      }

    } catch (error) {
      console.error('\n❌ Theme testing failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ThemeTestRunner();
  runner.run();
}