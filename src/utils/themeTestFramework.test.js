import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeTestFramework, createThemeTestSuite } from './themeTestFramework';

const createMockMonaco = () => {
  const mockModel = {
    getLineCount: () => 10,
    getValueInRange: (range) => `mock-text-${range.startLineNumber}`,
    tokenization: {
      getLineTokens: (lineNumber) => ({
        getCount: () => 3,
        getStartOffset: (index) => index * 10,
        getEndOffset: (index) => (index + 1) * 10,
        getClassName: (index) => `token-type-${index}`
      })
    }
  };

  const mockEditor = {
    getModel: () => mockModel,
    setModel: vi.fn(),
    dispose: vi.fn()
  };

  return {
    editor: {
      create: vi.fn(() => mockEditor),
      setTheme: vi.fn()
    }
  };
};

vi.mock('./themeLoader', () => ({
  getAllAvailableThemes: () => [
    { name: 'vs', displayName: 'Visual Studio' },
    { name: 'vs-dark', displayName: 'Visual Studio Dark' },
    { name: 'hc-black', displayName: 'High Contrast Black' }
  ]
}));

vi.mock('../services/monaco/monacoXquery', () => ({
  registerXQueryLanguage: vi.fn(),
  XQUERY_LANGUAGE: 'xquery-ml'
}));

describe('ThemeTestFramework', () => {
  let framework;
  let mockMonaco;

  beforeEach(() => {
    mockMonaco = createMockMonaco();
    framework = new ThemeTestFramework(mockMonaco);

    global.document = {
      createElement: vi.fn(() => ({
        style: {},
        remove: vi.fn()
      })),
      body: {
        appendChild: vi.fn()
      }
    };
  });

  it('should initialize with available themes', async () => {
    await framework.initialize();
    expect(framework.themes).toHaveLength(3);
    expect(framework.themes[0]).toEqual({ name: 'vs', displayName: 'Visual Studio' });
  });

  it('should create test editor with XQuery language', () => {
    const { editor, container } = framework.createTestEditor();

    expect(mockMonaco.editor.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        language: 'xquery-ml',
        theme: 'vs'
      })
    );
    expect(editor).toBeDefined();
    expect(container).toBeDefined();
  });

  it('should capture token snapshot', () => {
    const { editor } = framework.createTestEditor();
    const snapshot = framework.captureTokenSnapshot(editor, 'vs');

    expect(snapshot).toMatchObject({
      theme: 'vs',
      totalLines: 10,
      tokens: expect.any(Array)
    });

    expect(snapshot.tokens).toHaveLength(10);
    expect(snapshot.tokens[0]).toMatchObject({
      line: 1,
      tokens: expect.arrayContaining([
        expect.objectContaining({
          text: expect.any(String),
          type: expect.any(String),
          start: expect.any(Number),
          end: expect.any(Number)
        })
      ])
    });
  });

  it('should test individual theme successfully', async () => {
    await framework.initialize();
    await framework.testTheme('vs');

    expect(framework.snapshots.has('vs')).toBe(true);
    const snapshot = framework.snapshots.get('vs');
    expect(snapshot).toMatchObject({
      theme: 'vs',
      timestamp: expect.any(String)
    });
    expect(snapshot.error).toBeUndefined();
  });

  it('should handle theme test failures gracefully', async () => {
    mockMonaco.editor.setTheme = vi.fn(() => {
      throw new Error('Theme not found');
    });

    await framework.testTheme('invalid-theme');

    expect(framework.snapshots.has('invalid-theme')).toBe(true);
    const snapshot = framework.snapshots.get('invalid-theme');
    expect(snapshot).toMatchObject({
      theme: 'invalid-theme',
      error: 'Theme not found',
      timestamp: expect.any(String)
    });
  });

  it('should run all theme tests and generate report', async () => {
    await framework.initialize();
    const report = await framework.runAllThemeTests();

    expect(report.summary).toMatchObject({
      totalThemes: 3,
      successful: 3,
      failed: 0,
      timestamp: expect.any(String)
    });

    expect(report.successful).toHaveLength(3);
    expect(report.tokenStats).toHaveProperty('vs');
    expect(report.tokenStats).toHaveProperty('vs-dark');
    expect(report.tokenStats).toHaveProperty('hc-black');
  });

  it('should validate token consistency across themes', async () => {
    await framework.initialize();
    await framework.runAllThemeTests();

    const validation = framework.validateTokenConsistency();

    expect(validation).toMatchObject({
      consistent: true,
      message: 'All themes show consistent token structure'
    });
    expect(validation.inconsistencies).toHaveLength(0);
  });

  it('should detect token inconsistencies', async () => {
    await framework.initialize();

    // Create inconsistent snapshots
    framework.snapshots.set('theme1', {
      theme: 'theme1',
      tokens: [{ line: 1, tokens: [{ text: 'a' }, { text: 'b' }] }]
    });

    framework.snapshots.set('theme2', {
      theme: 'theme2',
      tokens: [{ line: 1, tokens: [{ text: 'a' }] }] // Different token count
    });

    const validation = framework.validateTokenConsistency();

    expect(validation.consistent).toBe(false);
    expect(validation.inconsistencies).toHaveLength(1);
    expect(validation.inconsistencies[0]).toMatchObject({
      theme: 'theme2',
      issue: 'Token count mismatch on line 1',
      expected: 2,
      actual: 1
    });
  });
});

describe('createThemeTestSuite', () => {
  it('should create framework instance', () => {
    const mockMonaco = createMockMonaco();
    const suite = createThemeTestSuite(mockMonaco);
    expect(suite).toBeInstanceOf(ThemeTestFramework);
  });
});