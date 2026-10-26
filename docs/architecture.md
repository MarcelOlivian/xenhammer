# XenHammer architecture

XenHammer is a browser-based level editor for GoldSrc (Half-Life 1), modelled on Valve Hammer Editor
3.x. It keeps Hammer's layout and workflow and renders with WebGPU. This document covers the
technology choices and how the code is organized. The file formats are in
[goldsrc-formats.md](goldsrc-formats.md) and the plan is in [roadmap.md](roadmap.md).

## Technology choices

| Concern          | Choice                                                                                                                     | Why                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Language / build | TypeScript (strict) + Vite                                                                                                 | Fast dev server, ES modules, WGSL imported as text with `?raw`                                                                       |
| GPU              | WebGPU + WGSL                                                                                                              | It's the point of the project. With no adapter, the viewports show a "WebGPU unavailable" notice. There is no WebGL fallback for now |
| Render math      | [`wgpu-matrix`](https://github.com/greggman/wgpu-matrix)                                                                   | Small, follows WebGPU conventions (clip-space depth 0..1)                                                                            |
| Geometry kernel  | Hand-written float64 code in `src/geom/`                                                                                   | Brush/plane math needs double precision and must not depend on the renderer                                                          |
| UI               | Vanilla TypeScript + DOM, small helpers in `src/ui/`                                                                       | No framework or runtime dependencies. Win2000-era Hammer look via CSS tokens                                                         |
| Tests            | Vitest                                                                                                                     | Parsers and geometry are pure functions                                                                                              |
| File I/O         | File System Access API with `<input type=file>` and download as fallback. IndexedDB for remembered WADs, FGDs and settings | Works on any device. Chromium can save in place                                                                                      |
| Lint / format    | ESLint (typescript-eslint) + Prettier                                                                                      | Standard tooling                                                                                                                     |
| Hosting          | Static build (`base: './'`), GitHub Pages later                                                                            | No backend                                                                                                                           |

Tooling note: use **npm 11+**. npm 10.9 crashes with `Cannot read properties of null (reading
'edgesOut')` when resolving this dependency tree.

## Source layout

```
src/
  main.ts            bootstrap: build the UI, init WebGPU, create viewports, load the scene
  app/               editor-wide state and input
    editorState.ts     grid size, active tool (small observable store)
    input.ts           global keyboard state by KeyboardEvent.code, key handlers
    testScene.ts       hard-coded brushes until maps can be loaded
  geom/              pure float64 geometry (no DOM, no GPU)
    vec3.ts            tuple vectors
    plane.ts           Plane, qbsp planeFromPoints
    winding.ts         BaseWindingForPlane, clip (ChopWinding), Newell normal
    brush.ts           brush planes → face polygons, AABB
  render/            WebGPU
    gpu.ts             adapter/device request, never throws
    renderer.ts        shared pipelines + scene buffers, on-demand frame scheduling
    viewport.ts        canvas/context/resize base class
    viewport2d.ts      orthographic view: analytic grid + wireframe, pan/zoom
    viewport3d.ts      camera view: solid faces, fly controls
    camera2d.ts        2D pan/zoom math + world→clip matrix
    camera3d.ts        yaw/pitch fly camera
    meshBuilder.ts     face polygons → vertex arrays
    shaders/*.wgsl     grid, wire, mesh
  ui/                DOM chrome
    layout.ts          menu bar, toolbars, 2×2 viewport split, object bar, status bar
    menubar.ts         Win9x-style menus
    dialog.ts          modal message box
    dom.ts             el() helper, icons, mnemonics
    theme.css          the classic look

planned:
  doc/               MapDocument: entities, brushes, faces (the source of truth)
  formats/           map220 (read/write), mapQuake (read), wad3, fgd (pure, Node-testable)
  tools/             select, block, entity, texture application, clip, vertex
```

### Dependency rules

- `geom/` and (later) `formats/` and `doc/` must not import `render/` or `ui/`. They run in Node
  under Vitest and could later move to a Worker.
- `render/` reads document data. It never owns or changes it.
- `ui/` builds DOM and reports user intent to the app. It doesn't touch the GPU.

## Rendering

- **One `GPUDevice`, four `<canvas>` elements** (camera, top, front, side), each with its own
  `GPUCanvasContext`. Separate canvases keep layout, splitters, focus and pointer events simple.
  Pipelines, vertex buffers and textures are shared because they all live on the same device.
- A `ResizeObserver` per canvas (`device-pixel-content-box` where supported) keeps the backing size
  equal to CSS size × `devicePixelRatio`, so lines stay crisp on HiDPI displays.
- **Frames are drawn on demand.** `Renderer.invalidate(view)` queues one `requestAnimationFrame`.
  Only dirty views are encoded, and all of them go into a single command buffer. The loop keeps
  running only while a view's `tick()` reports motion (3D fly controls).
- **Ortho views follow Hammer:** top = X/Y, front = Y/Z, side = X/Z, with Z up. The default
  arrangement is camera top-left, top top-right, front bottom-left, side bottom-right.
- **The 2D grid** is one fullscreen triangle. The fragment shader rebuilds the world position from
  the pixel coordinate and computes line coverage analytically. Lines are therefore exactly 1px at
  any zoom and cost no geometry. It draws the step grid (default 16, `[`/`]` halves/doubles within
  1–512), brighter lines every 64 units, highlighted 1024-unit lines and the axes. Grid levels
  closer than 4 CSS px are hidden. `Camera2D` and `grid.wgsl` use the same pixel mapping
  (`fbX = floor(W/2) + 0.5 + (h − centerH)·ppu`), so wireframes and grid lines meet exactly.
- **3D view:** depth-tested triangles with Hammer-style fake lighting, i.e. a fixed brightness per
  face orientation and no light entities. Until WADs are wired in, faces get a procedural checker
  projected along the qbsp base axes.
- **Picking will be done on the CPU:** ray vs. brush planes in 3D, distance to edges/AABBs in 2D.
  At GoldSrc scale (thousands of faces) this is cheap, and it avoids a GPU ID-buffer readback.
- Each view draws into `colorTarget()`, which defaults to the canvas texture. Overriding it renders
  off-screen. That is how the views were checked in headless Chromium (where canvas presentation is
  not available), and it will later serve thumbnails and screenshots.

## Document model (planned, M2)

```ts
interface MapDocument {
  entities: Entity[];
} // entities[0] is worldspawn
interface Entity {
  classname: string;
  keys: Map<string, string>;
  brushes: Brush[];
}
interface Brush {
  faces: Face[];
} // stored as planes, like the file
interface Face {
  plane: Plane;
  texture: string;
  u: Vec4;
  v: Vec4;
  rotation: number;
  scale: [number, number];
}
```

- Brushes are stored as planes, as in the file. Polygons are derived (`brushPolygons`) and cached
  per brush, then recomputed when the brush changes.
- All edits are commands with `do`/`undo` that operate on the document. The renderer rebuilds GPU
  buffers only for brushes that changed.
- Editor-only state (selection, visgroups, cameras) is kept outside the entity key/values so `.map`
  export stays clean. RMF can store it later.

## UI conventions

- The look is Hammer 3.5 on Windows 2000: `#d4d0c8` face color, bevelled 3D borders, Tahoma 11px,
  navy menu highlight, black 2D views. Colors are CSS custom properties in `theme.css`, so other
  themes can be added later.
- Keyboard shortcuts match Hammer where possible: `[`/`]` grid, Shift+letter tools, Z mouselook,
  Ctrl+H make hollow. Keys are matched by `KeyboardEvent.code`, so they work on any keyboard layout.
- On narrow screens the object bar is hidden so the viewports keep their space.
