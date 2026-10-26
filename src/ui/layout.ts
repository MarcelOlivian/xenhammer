import type { EditorState, ToolId } from '../app/editorState';
import { el, icon } from './dom';
import { createMenuBar, type Menu } from './menubar';

export type PaneId = 'camera' | 'top' | 'front' | 'side';

/** Hammer's default arrangement: camera top-left, top view top-right, front and side below. */
const PANES: { id: PaneId; label: string }[] = [
  { id: 'camera', label: 'camera' },
  { id: 'top', label: 'top (x/y)' },
  { id: 'front', label: 'front (y/z)' },
  { id: 'side', label: 'side (x/z)' },
];

const TOOLS: { id: ToolId; title: string; key: string; svg: string }[] = [
  {
    id: 'select',
    title: 'Selection Tool',
    key: 'Shift+S',
    svg: '<path d="M4 2v11l3-3 2 4 2-1-2-4h4z" fill="currentColor"/>',
  },
  {
    id: 'camera',
    title: 'Camera',
    key: 'Shift+C',
    svg: '<rect x="2" y="5" width="9" height="7" fill="currentColor"/><path d="M11 7l3-2v7l-3-2z" fill="currentColor"/>',
  },
  {
    id: 'entity',
    title: 'Entity Tool',
    key: 'Shift+E',
    svg: '<path d="M8 2l5 3v6l-5 3-5-3V5z" fill="none" stroke="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/>',
  },
  {
    id: 'block',
    title: 'Block Tool',
    key: 'Shift+B',
    svg: '<path d="M3 5l5-2 5 2v6l-5 2-5-2z M3 5l5 2 5-2 M8 7v6" fill="none" stroke="currentColor"/>',
  },
  {
    id: 'texture',
    title: 'Toggle Texture Application',
    key: 'Shift+A',
    svg: '<path d="M2 2h6v6H2zM8 8h6v6H8z" fill="currentColor"/><path d="M2 2h12v12H2z" fill="none" stroke="currentColor"/>',
  },
  {
    id: 'clip',
    title: 'Clipping Tool',
    key: 'Shift+X',
    svg: '<path d="M3 3h10v10H3z" fill="none" stroke="currentColor"/><path d="M1 14L15 2" stroke="currentColor" stroke-width="1.5"/>',
  },
  {
    id: 'vertex',
    title: 'Vertex Tool',
    key: 'Shift+V',
    svg: '<path d="M4 4h8v8H4z" fill="none" stroke="currentColor"/><path d="M3 3h2v2H3zM11 3h2v2h-2zM3 11h2v2H3zM11 11h2v2h-2z" fill="currentColor"/>',
  },
];

export interface StatusBar {
  setMessage(text: string): void;
  setCoords(text: string): void;
  setGrid(size: number): void;
  setZoom(zoom: number): void;
}

export interface Shell {
  readonly canvases: Record<PaneId, HTMLCanvasElement>;
  readonly status: StatusBar;
  /** Covers the viewport area with a message (e.g. WebGPU unavailable). */
  showViewportNotice(title: string, lines: (string | Node)[]): void;
}

export function buildShell(root: HTMLElement, editor: EditorState, menus: Menu[]): Shell {
  // --- status bar -----------------------------------------------------------
  const message = el('div.status-cell.status-message', {}, 'Ready');
  const coords = el('div.status-cell.status-coords', {}, '');
  const grid = el('div.status-cell.status-grid', {}, '');
  const zoom = el('div.status-cell.status-zoom', {}, '');
  const status: StatusBar = {
    setMessage: (t) => (message.textContent = t),
    setCoords: (t) => (coords.textContent = t),
    setGrid: (n) => (grid.textContent = `Grid: ${n}`),
    setZoom: (z) => (zoom.textContent = `Zoom: ${z >= 1 ? z.toFixed(2) : z.toPrecision(2)}`),
  };
  status.setGrid(editor.gridSize);
  status.setZoom(1);

  // --- top toolbar ------------------------------------------------------------
  const tbButton = (label: string, title: string, action?: () => void) => {
    const b = el('button.tb-button', { type: 'button', title, disabled: !action }, label);
    if (action) b.addEventListener('click', action);
    return b;
  };
  const gridLabel = el('span.tb-label', {}, '');
  const toolbar = el(
    'div.toolbar',
    { role: 'toolbar' },
    tbButton('New', 'New map (Ctrl+N)'),
    tbButton('Open', 'Open map (Ctrl+O)'),
    tbButton('Save', 'Save map (Ctrl+S)'),
    el('span.tb-separator'),
    tbButton('Undo', 'Undo (Ctrl+Z)'),
    tbButton('Redo', 'Redo (Ctrl+Y)'),
    el('span.tb-separator'),
    tbButton('−', 'Smaller grid ([)', () => editor.stepGrid(-1)),
    gridLabel,
    tbButton('+', 'Bigger grid (])', () => editor.stepGrid(1)),
  );

  // --- left tool strip --------------------------------------------------------
  const toolButtons = new Map<ToolId, HTMLButtonElement>();
  const toolstrip = el('div.toolstrip', { role: 'toolbar', 'aria-orientation': 'vertical' });
  for (const tool of TOOLS) {
    const b = el(
      'button.tool-button',
      { type: 'button', title: `${tool.title} (${tool.key})` },
      icon(tool.svg),
    );
    b.addEventListener('click', () => editor.setTool(tool.id));
    toolButtons.set(tool.id, b);
    toolstrip.append(b);
  }

  // --- right object bar -------------------------------------------------------
  const objectbar = el(
    'aside.objectbar',
    {},
    el(
      'fieldset.groupbox',
      {},
      el('legend', {}, 'Texture'),
      el('div.texture-preview', { title: 'No WAD loaded' }),
      el('div.texture-name', {}, '<none>'),
      el(
        'div.button-row',
        {},
        el('button.button', { type: 'button', disabled: true }, 'Browse...'),
        el('button.button', { type: 'button', disabled: true }, 'Replace...'),
      ),
    ),
    el(
      'fieldset.groupbox',
      {},
      el('legend', {}, 'Objects'),
      el(
        'label',
        {},
        'Categories:',
        el('select', { disabled: true }, el('option', {}, 'Primitives')),
      ),
      el('label', {}, 'Objects:', el('select', { disabled: true }, el('option', {}, 'block'))),
    ),
  );

  // --- 2×2 viewports with splitters -------------------------------------------
  const views = el('div.views');
  const canvases = {} as Record<PaneId, HTMLCanvasElement>;
  for (const pane of PANES) {
    const canvas = el('canvas.viewport-canvas', { 'aria-label': `${pane.label} view` });
    const node = el(
      'div.pane',
      { 'data-pane': pane.id },
      canvas,
      el('div.pane-label', {}, pane.label),
    );
    node.addEventListener('pointerenter', () => node.classList.add('active'));
    node.addEventListener('pointerleave', () => node.classList.remove('active'));
    canvases[pane.id] = canvas;
    views.append(node);
  }
  const splitV = el('div.splitter.splitter-v');
  const splitH = el('div.splitter.splitter-h');
  const splitC = el('div.splitter.splitter-c');
  views.append(splitV, splitH, splitC);
  setupSplitters(views, splitV, splitH, splitC);

  const main = el('div.main', {}, toolstrip, views, objectbar);
  const statusbar = el('footer.statusbar', {}, message, coords, grid, zoom);
  root.append(el('div.app', {}, createMenuBar(menus), toolbar, main, statusbar));

  const sync = () => {
    gridLabel.textContent = `Grid: ${editor.gridSize}`;
    status.setGrid(editor.gridSize);
    for (const [id, b] of toolButtons) b.classList.toggle('pressed', id === editor.activeTool);
  };
  editor.subscribe(sync);
  sync();

  return {
    canvases,
    status,
    showViewportNotice(title, lines) {
      views.append(
        el(
          'div.viewport-notice',
          {},
          el(
            'div.window.dialog',
            { role: 'alert' },
            el('div.titlebar', {}, el('span', {}, title)),
            el(
              'div.dialog-body',
              {},
              ...lines.map((l) => (typeof l === 'string' ? el('p', {}, l) : l)),
            ),
          ),
        ),
      );
    },
  };
}

const SPLIT_KEY = 'xenhammer.split';

/** Drag the bars (or their crossing) to resize the panes; the split is remembered per browser. */
function setupSplitters(views: HTMLElement, v: HTMLElement, h: HTMLElement, c: HTMLElement): void {
  let split = { x: 0.5, y: 0.5 };
  try {
    const saved = JSON.parse(localStorage.getItem(SPLIT_KEY) ?? 'null') as typeof split | null;
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') split = saved;
  } catch {
    // storage unavailable or corrupt: use the default
  }
  const apply = () => {
    views.style.setProperty('--split-x', `${split.x * 100}%`);
    views.style.setProperty('--split-y', `${split.y * 100}%`);
  };
  apply();

  const drag = (bar: HTMLElement, axes: { x: boolean; y: boolean }) => {
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const r = views.getBoundingClientRect();
        const clamp = (t: number) => Math.min(0.9, Math.max(0.1, t));
        if (axes.x) split.x = clamp((ev.clientX - r.left) / r.width);
        if (axes.y) split.y = clamp((ev.clientY - r.top) / r.height);
        apply();
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
        try {
          localStorage.setItem(SPLIT_KEY, JSON.stringify(split));
        } catch {
          // ignore: persistence is a convenience
        }
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
  };
  drag(v, { x: true, y: false });
  drag(h, { x: false, y: true });
  drag(c, { x: true, y: true });
}
