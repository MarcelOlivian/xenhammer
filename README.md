# X E N - H A M M E R

A web-based alternative to the classic Hammer editor for GoldSrc, rendered with WebGPU.

## Motivation

Making tools is much simpler these days, so I wonder if I can streamline some old hobbies that needed
complex setups on a personal PC. One of them was Half-Life mapping, and I'd like to be able to open the
editor from whatever device I have at hand.

## Status

Early scaffold (milestone M0). The editor shell runs: classic Hammer layout, four resizable viewports
with a WebGPU-rendered grid, pan/zoom in the 2D views, and a fly camera in the 3D view. It shows a
hard-coded test scene. There is no editing, loading or saving yet. See the [roadmap](docs/roadmap.md);
the first target is building and saving "the box".

This is a hobby project and time for it is limited. Expect it to change a lot.

## Running it

Requires Node 20.19+ and **npm 11+** (npm 10.9 crashes resolving this dependency tree), plus a
browser with WebGPU (current Chrome/Edge, Safari 26+, Firefox 141+ on Windows).

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (geometry, state)
npm run lint
npm run build      # typecheck + static build in dist/
```

### Controls so far

| Where         | Input                                  | Action                                 |
| ------------- | -------------------------------------- | -------------------------------------- |
| 2D views      | Mouse wheel                            | Zoom to cursor                         |
| 2D views      | Space + drag, middle drag              | Pan                                    |
| Anywhere      | `[` / `]`                              | Smaller / bigger grid (1–512)          |
| 3D view       | Right drag, or `Z` to toggle mouselook | Look                                   |
| 3D view       | `W` `A` `S` `D` / arrows, `Q` `E`      | Fly, down / up (hold Shift for faster) |
| 3D view       | Mouse wheel                            | Move forward / back                    |
| Between views | Drag the splitters                     | Resize the panes                       |

## Docs

- [Architecture](docs/architecture.md): technology choices, code layout, rendering design.
- [GoldSrc formats](docs/goldsrc-formats.md): `.map` (Valve 220), WAD3 textures, FGD, plus RMF/JMF/BSP notes.
- [Roadmap](docs/roadmap.md): milestones up to the box and beyond.

Valve's game files (e.g. `halflife.wad`) are not included. You load them from your own Half-Life
install.
