import './ui/theme.css';
import { EditorState, type ToolId } from './app/editorState';
import { input } from './app/input';
import { testScene } from './app/testScene';
import type { OrthoKind } from './render/camera2d';
import { initGpu } from './render/gpu';
import { buildSceneGeometry } from './render/meshBuilder';
import { Renderer } from './render/renderer';
import { Viewport2D } from './render/viewport2d';
import { Viewport3D } from './render/viewport3d';
import { el } from './ui/dom';
import { showMessageBox } from './ui/dialog';
import { buildShell } from './ui/layout';
import type { Menu } from './ui/menubar';

const TOOL_NAMES: Record<ToolId, string> = {
  select: 'Selection Tool',
  camera: 'Camera',
  entity: 'Entity Tool',
  block: 'Block Tool',
  texture: 'Texture Application',
  clip: 'Clipping Tool',
  vertex: 'Vertex Tool',
};

function menus(editor: EditorState): Menu[] {
  const about = () =>
    showMessageBox('About XenHammer', [
      'XenHammer — a web-based, WebGPU-accelerated level editor for GoldSrc.',
      'Early scaffold: viewports and navigation only. See docs/roadmap.md.',
    ]);
  return [
    {
      label: '&File',
      items: [
        { label: '&New', shortcut: 'Ctrl+N' },
        { label: '&Open...', shortcut: 'Ctrl+O' },
        { label: '&Close' },
        { label: '&Save', shortcut: 'Ctrl+S' },
        { label: 'Save &As...' },
        'separator',
        { label: '&Export...' },
        { label: '&Run Map...', shortcut: 'F9' },
      ],
    },
    {
      label: '&Edit',
      items: [
        { label: '&Undo', shortcut: 'Ctrl+Z' },
        { label: '&Redo', shortcut: 'Ctrl+Y' },
        'separator',
        { label: 'Cu&t', shortcut: 'Ctrl+X' },
        { label: '&Copy', shortcut: 'Ctrl+C' },
        { label: '&Paste', shortcut: 'Ctrl+V' },
        { label: '&Delete', shortcut: 'Del' },
        'separator',
        { label: 'Select &All', shortcut: 'Ctrl+A' },
        { label: 'P&roperties', shortcut: 'Alt+Enter' },
      ],
    },
    {
      label: '&Map',
      items: [
        { label: '&Snap to Grid', shortcut: 'Shift+W' },
        { label: 'Show &Grid', shortcut: 'Shift+R' },
        'separator',
        { label: 'Map &Information...' },
        { label: '&Entity Report...' },
      ],
    },
    {
      label: '&View',
      items: [
        { label: '&Smaller Grid', shortcut: '[', action: () => editor.stepGrid(-1) },
        { label: '&Bigger Grid', shortcut: ']', action: () => editor.stepGrid(1) },
        'separator',
        { label: '3D &Wireframe' },
        { label: '3D &Textured' },
      ],
    },
    {
      label: '&Tools',
      items: [
        { label: '&Group', shortcut: 'Ctrl+G' },
        { label: '&Ungroup', shortcut: 'Ctrl+U' },
        { label: '&Tie to Entity', shortcut: 'Ctrl+T' },
        { label: '&Move to World', shortcut: 'Ctrl+W' },
        'separator',
        { label: '&Carve', shortcut: 'Ctrl+Shift+C' },
        { label: 'Make &Hollow', shortcut: 'Ctrl+H' },
        'separator',
        { label: '&Options...' },
      ],
    },
    { label: '&Help', items: [{ label: '&About XenHammer...', action: about }] },
  ];
}

async function main(): Promise<void> {
  const editor = new EditorState();
  const shell = buildShell(document.body, editor, menus(editor));

  input.onKeyDown((code) => {
    if (code === 'BracketLeft') editor.stepGrid(-1);
    else if (code === 'BracketRight') editor.stepGrid(1);
    else return false;
    return true;
  });
  editor.subscribe((s) =>
    shell.status.setMessage(`${TOOL_NAMES[s.activeTool]} — not implemented yet`),
  );

  const result = await initGpu();
  if (!result.ok) {
    shell.showViewportNotice('WebGPU unavailable', [
      'XenHammer renders its viewports with WebGPU, which this browser could not provide.',
      result.reason,
      'Try a current Chrome or Edge (113+), Safari 26+, or Firefox 141+ on Windows, with hardware acceleration enabled.',
    ]);
    shell.status.setMessage('WebGPU unavailable');
    return;
  }

  const { gpu } = result;
  gpu.device.lost.then((info) => {
    if (info.reason === 'destroyed') return;
    shell.showViewportNotice('GPU device lost', [
      `The GPU device was lost (${info.message || 'no details'}). Reload the page to continue.`,
    ]);
  });

  const renderer = new Renderer(gpu);
  renderer.setScene(buildSceneGeometry(testScene()));
  renderer.addView(new Viewport3D(shell.canvases.camera, renderer));

  const axisNames = ['x', 'y', 'z'] as const;
  for (const kind of ['top', 'front', 'side'] as OrthoKind[]) {
    const view: Viewport2D = new Viewport2D(shell.canvases[kind], renderer, {
      kind,
      getGridSize: () => editor.gridSize,
      onCursor: (h, v) => {
        const { axes } = view.camera;
        shell.status.setCoords(
          `${axisNames[axes.h]} ${Math.round(h)}, ${axisNames[axes.v]} ${Math.round(v)}`,
        );
      },
      onZoom: (z) => shell.status.setZoom(z),
    });
    renderer.addView(view);
  }
  editor.subscribe(() => renderer.invalidate());
  shell.status.setMessage(
    'Ready — Space/middle-drag pans 2D views, wheel zooms; in the camera view hold right mouse or press Z to look, WASD to fly.',
  );
}

main().catch((err: unknown) => {
  console.error(err);
  document.body.append(el('pre', {}, `XenHammer failed to start: ${String(err)}`));
});
