import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useStreamingResults, { STREAM_STATUS } from '../useStreamingResults';

const sampleRecord = (content) => ({
  content,
  contentType: 'text/plain',
  primitive: '',
  uri: '',
  path: '',
});

describe('useStreamingResults', () => {
  it('loads static records and exposes them via state', () => {
    const { result } = renderHook(() => useStreamingResults());

    act(() => {
      result.current.loadStaticRecords([sampleRecord('one'), sampleRecord('two')]);
    });

    expect(result.current.state.mode).toBe('static');
    expect(result.current.state.streamStatus).toBe(STREAM_STATUS.STATIC);
    expect(result.current.state.records).toHaveLength(2);
    expect(result.current.state.pagination.totalPages).toBe(1);
  });

  it('initializes streaming state and loads the first page', async () => {
    const readParts = vi.fn().mockResolvedValue({ success: true, records: [sampleRecord('first')] });
    const index = { dir: '/tmp', parts: new Array(3) };
    const { result } = renderHook(() => useStreamingResults({ readParts, pageSize: 1 }));

    await act(async () => {
      await result.current.initializeStream(index);
    });

    expect(readParts).toHaveBeenCalledWith('/tmp', 0, 1);
    expect(result.current.state.mode).toBe('stream');
    expect(result.current.state.streamStatus).toBe(STREAM_STATUS.READY);
    expect(result.current.state.records[0].content).toBe('first');
    expect(result.current.state.pagination.totalPages).toBe(3);
  });

  it('navigates pages forward and backward', async () => {
    const readParts = vi.fn((_, start) => {
      if (start === 0) return Promise.resolve({ success: true, records: [sampleRecord('page1')] });
      if (start === 1) return Promise.resolve({ success: true, records: [sampleRecord('page2')] });
      return Promise.resolve({ success: true, records: [] });
    });
    const index = { dir: '/tmp', parts: new Array(4) };
    const { result } = renderHook(() => useStreamingResults({ readParts, pageSize: 1 }));

    await act(async () => {
      await result.current.initializeStream(index);
    });

    await act(async () => {
      const pageIndex = await result.current.nextPage();
      expect(pageIndex).toBe(1);
    });

    expect(result.current.state.records[0].content).toBe('page2');

    await act(async () => {
      const prevIndex = await result.current.prevPage();
      expect(prevIndex).toBe(0);
    });

    expect(result.current.state.records[0].content).toBe('page1');
  });

  it('updates active record navigation state', () => {
    const { result } = renderHook(() => useStreamingResults());

    act(() => {
      result.current.loadStaticRecords([
        sampleRecord('first'),
        sampleRecord('second'),
        sampleRecord('third'),
      ]);
    });

    act(() => {
      const nextIndex = result.current.goToNextRecord();
      expect(nextIndex).toBe(1);
    });

    act(() => {
      const prevIndex = result.current.goToPrevRecord();
      expect(prevIndex).toBe(0);
    });

    act(() => {
      const clamped = result.current.setActiveRecordIndex(10);
      expect(clamped).toBe(2);
    });
  });
});
