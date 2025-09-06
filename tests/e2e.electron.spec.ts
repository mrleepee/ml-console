import { _electron as electron, test, expect } from '@playwright/test';

test.describe('Offline LLM', () => {
  test('classification, generation, suggestions', async () => {
    const electronApp = await electron.launch({ args: ['.'] });
    const page = await electronApp.firstWindow();

    // Expose helper to evaluate in renderer
    const classify = async (txt: string) => page.evaluate(async (t) => {
      const mod = await import('../src/renderer/llm/classifier');
      return mod.classifyQuery(t);
    }, txt);

    const { label: l1, score: s1 } = await classify("for $p in /protein return $p/name");
    expect(['xquery']).toContain(l1);
    expect(s1).toBeGreaterThanOrEqual(0.6);

    const { label: l2, score: s2 } = await classify("SELECT ?p WHERE { ?p a :Protein } LIMIT 10");
    expect(['sparql']).toContain(l2);
    expect(s2).toBeGreaterThanOrEqual(0.6);

    const { label: l3, score: s3 } = await classify("xdmp.documentGet('/foo.xml')");
    expect(['javascript']).toContain(l3);
    expect(s3).toBeGreaterThanOrEqual(0.6);

    const { label: l4, score: s4 } = await classify("op.fromView('main','proteins').select(['name']).limit(5)");
    expect(['optic']).toContain(l4);
    expect(s4).toBeGreaterThanOrEqual(0.6);

    // Generation test
    const genOk = await page.evaluate(async () => {
      const { generateCode } = await import('../src/renderer/llm/generator');
      const controller = new AbortController();
      const it = generateCode({ instruction: 'Get top 10 proteins by name', language: 'xquery', maxTokens: 64, temperature: 0.2, signal: controller.signal });
      let out = '';
      for await (const chunk of it) {
        out += chunk;
        if (out.length > 100) break;
      }
      controller.abort();
      return out;
    });
    expect(genOk.length).toBeGreaterThan(0);

    // Suggestions test
    const sugg = await page.evaluate(async () => {
      const { suggestNext } = await import('../src/renderer/llm/generator');
      const controller = new AbortController();
      const it = suggestNext({ buffer: "for $p in /protein return $p/", cursor: 29, language: 'xquery', maxTokens: 16, signal: controller.signal });
      let out = '';
      for await (const chunk of it) {
        out += chunk;
        if (out.includes('\n') || out.includes(';')) break;
      }
      controller.abort();
      return out;
    });
    expect(sugg.length).toBeGreaterThan(0);

    await electronApp.close();
  });
});


