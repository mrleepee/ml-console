import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import StreamedResultViewer from './StreamedResultViewer';

describe('StreamedResultViewer', () => {
  it('displays total bytes and part sizes', () => {
    const index = { parts: [ { bytes: 10 }, { bytes: 20 } ] };
    render(<StreamedResultViewer index={index} />);
    expect(screen.getByTestId('total-bytes').textContent).toContain('30');
    expect(screen.getByTestId('part-0-bytes').textContent).toContain('10');
    expect(screen.getByTestId('part-1-bytes').textContent).toContain('20');
  });

  it('updates progress from electronAPI event', async () => {
    const handlers = [];
    // mock electronAPI
    global.window = global.window || {};
    window.electronAPI = {
      onEvalStreamProgress: (handler) => { handlers.push(handler); return () => {}; }
    };
    render(<StreamedResultViewer index={{ parts: [] }} />);
    await act(async () => {});
    act(() => { handlers[0](123); });
    expect(screen.getByTestId('byte-progress').textContent).toContain('123');
  });
});
