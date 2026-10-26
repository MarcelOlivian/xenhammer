# Roadmap

The first goal is **"the box"**. A user should be able to build a sealed room with a player start
and a light, texture it from their own WAD, save it as a Valve 220 `.map`, and compile that file
with VHLT without errors. The reference file is in
[goldsrc-formats.md §1.5](goldsrc-formats.md#15-reference-the-box).

## M0: Foundations ✅

- Design docs: [architecture](architecture.md), [formats](goldsrc-formats.md), this roadmap.
- Vite + TypeScript scaffold, lint/format/test tooling.
- WebGPU device setup with an "unavailable" notice. Classic Hammer chrome: menus, toolbars,
  tool strip, object bar, status bar.
- Four resizable viewports. 2D views have an analytic grid, pan (Space/middle drag) and
  zoom-to-cursor. The 3D view has fly controls (right-drag or Z mouselook, WASD/QE, Shift to go
  faster).
- Geometry kernel: planes, winding clipping, brush → polygons, with unit tests.

## M1: Formats

- `formats/wad3.ts`: directory parsing, lazy miptex decode to RGBA (with `{` transparency).
  Tests use synthetic WADs.
- `formats/map220.ts`: tokenizer, parser and writer. Round-trip tests (parse → write → parse gives
  the same document). Quake standard-format faces are converted on load.
- `formats/fgd.ts`: tokenizer, parser, `base()` resolution, `@include`.
- A built-in minimal FGD (worldspawn, info_player_start, info_player_deathmatch, light,
  light_environment, func_wall, func_door).

## M2: Document and rendering

- `doc/`: MapDocument, Entity, Brush, Face. Derived polygons cached per brush.
- Render the document instead of the test scene: wireframes in 2D (selected objects in red),
  textured faces in 3D using Valve 220 UVs.
- Texture cache: WAD lookup by name, mipmapped `rgba8unorm` upload, missing-texture checker,
  alpha test for `{` textures.
- Point entities drawn as colored boxes from the FGD `size()`/`color()`.

## M3: Editing tools

- Command-based undo/redo.
- Selection tool: click and box-select in 2D, click in 3D (CPU ray picking), move by dragging,
  resize handles, all snapped to the grid.
- Block tool: drag a box in a 2D view, then Enter creates a brush with the current texture.
- Delete, copy/paste, nudge with the arrow keys.
- **Make Hollow** (Ctrl+H): turn a brush into walls of a given thickness.
- Entity tool: place point entities. Object Properties dialog driven by the FGD.

## M4: Textures

- Texture browser: loaded WADs, filter by name, size display, pick the current texture.
- Apply the current texture to the selection. Texture application mode for single faces.
- Face edit basics: align to world/face, fit, shift, scale, rotate.

## M5: Files

- New / Open / Save / Save As for `.map`: File System Access API (save in place) with a
  download fallback.
- WAD management: load WADs from a folder or files, persist them in IndexedDB, keep the
  worldspawn `wad` key in sync.
- Recent files, settings persistence.
- **Done when:** the box can be built from scratch, saved, reopened unchanged, and compiles with
  VHLT (`hlcsg`, `hlbsp`, `hlvis`, `hlrad`) with no errors or leaks.

## Later

- RMF read/write, JMF import.
- Clipping tool, vertex manipulation, carve, texture lock, groups, visgroups.
- Check for problems (invalid solids, missing textures).
- Sprite and model previews for entities (`.spr`, `.mdl`).
- Compile pipeline (VHLT in WebAssembly, or a companion service). BSP preview with lightmaps.
- PWA / offline support, touch-friendly controls, alternative themes.
