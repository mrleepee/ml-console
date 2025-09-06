/**
 * Unit tests for LLM summarizer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeQuery, testLLMIntegration } from './summarizer';

// Mock the transformers module
vi.mock('./transformers', () => ({
  getPipeline: vi.fn()
}));

describe('LLM Summarizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('summarizeQuery', () => {
    it('should throw error for empty query', async () => {
      await expect(summarizeQuery('')).rejects.toThrow('Query cannot be empty');
      await expect(summarizeQuery('   ')).rejects.toThrow('Query cannot be empty');
    });

    it('should throw error for null/undefined query', async () => {
      await expect(summarizeQuery(null as any)).rejects.toThrow('Query cannot be empty');
      await expect(summarizeQuery(undefined as any)).rejects.toThrow('Query cannot be empty');
    });

    it('should successfully summarize a valid query', async () => {
      // Mock the pipeline
      const mockGenerator = vi.fn().mockResolvedValue([
        { generated_text: 'Summarize this query in one sentence: "test query" This is a test XQuery that finds elements without children.' }
      ]);
      
      const { getPipeline } = await import('./transformers');
      vi.mocked(getPipeline).mockResolvedValue(mockGenerator);

      const result = await summarizeQuery('test query');

      expect(result).toEqual({
        summary: 'This is a test XQuery that finds elements without children.',
        confidence: 0.8,
        model: 'Qwen3-0.6B-ONNX'
      });

      expect(getPipeline).toHaveBeenCalledWith('text-generation', 'onnx-community/Qwen3-0.6B-ONNX');
      expect(mockGenerator).toHaveBeenCalledWith(
        'Summarize this query in one sentence: "test query"',
        expect.objectContaining({
          max_new_tokens: 50,
          temperature: 0.7,
          do_sample: true
        })
      );
    });

    it('should handle empty generated text', async () => {
      const mockGenerator = vi.fn().mockResolvedValue([
        { generated_text: 'Summarize this query in one sentence: "test query"' }
      ]);
      
      const { getPipeline } = await import('./transformers');
      vi.mocked(getPipeline).mockResolvedValue(mockGenerator);

      const result = await summarizeQuery('test query');

      expect(result.summary).toBe('Unable to generate summary');
    });

    it('should handle pipeline errors', async () => {
      const { getPipeline } = await import('./transformers');
      vi.mocked(getPipeline).mockRejectedValue(new Error('Model loading failed'));

      await expect(summarizeQuery('test query')).rejects.toThrow('Failed to summarize query: Model loading failed');
    });

    it('should handle unexpected response format', async () => {
      const mockGenerator = vi.fn().mockResolvedValue([]);
      
      const { getPipeline } = await import('./transformers');
      vi.mocked(getPipeline).mockResolvedValue(mockGenerator);

      const result = await summarizeQuery('test query');

      expect(result.summary).toBe('Unable to generate summary');
    });
  });

  describe('testLLMIntegration', () => {
    it('should return true for successful integration test', async () => {
      const mockGenerator = vi.fn().mockResolvedValue([
        { generated_text: 'Summarize this query in one sentence: "xquery version \\"1.0-ml\\"; (//*[not(*)])[1 to 3]" This XQuery finds the first three leaf elements.' }
      ]);
      
      const { getPipeline } = await import('./transformers');
      vi.mocked(getPipeline).mockResolvedValue(mockGenerator);

      const result = await testLLMIntegration();

      expect(result).toBe(true);
    });

    it('should return false for failed integration test', async () => {
      const { getPipeline } = await import('./transformers');
      vi.mocked(getPipeline).mockRejectedValue(new Error('Model not available'));

      const result = await testLLMIntegration();

      expect(result).toBe(false);
    });
  });
});
