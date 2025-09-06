/**
 * Simple LLM summarization function for testing
 */

import { getPipeline } from './transformers';

export interface SummarizationResult {
  summary: string;
  confidence: number;
  model: string;
}

/**
 * Summarize a query using the Qwen3 generator model
 * @param query - The query to summarize
 * @returns Promise<SummarizationResult> - Summary with metadata
 */
export async function summarizeQuery(query: string): Promise<SummarizationResult> {
  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }

  try {
    // Get the text generation pipeline
    const generator = await getPipeline('text-generation', 'onnx-community/Qwen3-0.6B-ONNX');
    
    // Create a simple summarization prompt
    const prompt = `Summarize this query in one sentence: "${query}"`;
    
    // Generate summary
    const result = await generator(prompt, {
      max_new_tokens: 50,
      temperature: 0.7,
      do_sample: true,
    });

    // Extract the generated text
    const generatedText = result[0]?.generated_text || '';
    
    // Clean up the response (remove the prompt)
    const summary = generatedText.replace(prompt, '').trim();
    
    return {
      summary: summary || 'Unable to generate summary',
      confidence: 0.8, // Mock confidence score
      model: 'Qwen3-0.6B-ONNX'
    };
  } catch (error) {
    console.error('Summarization error:', error);
    throw new Error(`Failed to summarize query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test function to verify LLM integration works
 * @returns Promise<boolean> - True if test passes
 */
export async function testLLMIntegration(): Promise<boolean> {
  try {
    const testQuery = 'xquery version "1.0-ml"; (//*[not(*)])[1 to 3]';
    const result = await summarizeQuery(testQuery);
    
    console.log('LLM Test Result:', result);
    
    // Basic validation
    return !!(
      result.summary && 
      result.summary.length > 0 && 
      result.model && 
      typeof result.confidence === 'number'
    );
  } catch (error) {
    console.error('LLM Test Failed:', error);
    return false;
  }
}
