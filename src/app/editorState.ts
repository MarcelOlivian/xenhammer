export const MIN_GRID = 1;
export const MAX_GRID = 512;

export type ToolId = 'select' | 'camera' | 'entity' | 'block' | 'texture' | 'clip' | 'vertex';

interface EditorStateFields {
  gridSize: number;
  activeTool: ToolId;
}

type Listener = (state: Readonly<EditorStateFields>) => void;

/**
 * Editor-wide UI state (not the map document). Small observable store: views
 * and UI subscribe and re-read what they need on every change.
 */
export class EditorState {
  private fields: EditorStateFields = { gridSize: 16, activeTool: 'select' };
  private readonly listeners = new Set<Listener>();

  get gridSize(): number {
    return this.fields.gridSize;
  }

  get activeTool(): ToolId {
    return this.fields.activeTool;
  }

  /** Hammer's `[` / `]`: halve or double the grid within [1, 512]. */
  stepGrid(direction: -1 | 1): void {
    const next = direction > 0 ? this.gridSize * 2 : this.gridSize / 2;
    this.update({ gridSize: Math.min(MAX_GRID, Math.max(MIN_GRID, next)) });
  }

  setTool(tool: ToolId): void {
    this.update({ activeTool: tool });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<EditorStateFields>): void {
    const next = { ...this.fields, ...patch };
    if (next.gridSize === this.fields.gridSize && next.activeTool === this.fields.activeTool)
      return;
    this.fields = next;
    for (const l of this.listeners) l(this.fields);
  }
}
