import { describe, expect, it, vi } from 'vitest';
import { EditorState } from './editorState';

describe('EditorState grid', () => {
  it('halves and doubles within [1, 512]', () => {
    const s = new EditorState();
    expect(s.gridSize).toBe(16);
    for (let i = 0; i < 10; i++) s.stepGrid(1);
    expect(s.gridSize).toBe(512);
    for (let i = 0; i < 20; i++) s.stepGrid(-1);
    expect(s.gridSize).toBe(1);
  });

  it('notifies only on actual changes', () => {
    const s = new EditorState();
    const listener = vi.fn();
    s.subscribe(listener);
    s.setTool('select'); // already active
    s.setTool('block');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
