# GoldSrc formats for a level editor

These are the notes XenHammer is built from. They cover what an editor has to read and write
to produce a map for GoldSrc (Half-Life 1): the map source (`.map`), textures (`.wad`) and entity
definitions (`.fgd`). Hammer's binary format (`.rmf`), J.A.C.K.'s `.jmf` and compiled `.bsp`
come at the end, because they are only needed later.

All binary formats are **little-endian**. Strings in fixed-size fields are NUL-padded ASCII.
"Units" are map units. One unit is roughly one inch and the player is 72 units tall. Z is up.

Status labels:

- **Implement**: needed for the "box" milestone.
- **Later**: documented now, built after the box.
- _Verify_: comes from community documentation and has not been checked against real files yet.

---

## 1. `.map`: Valve 220 (Implement: read and write)

This is the text format Hammer exports and the compilers (`hlcsg` in ZHLT/VHLT) read. TrenchBroom,
J.A.C.K. and Sledge all use the same dialect, which makes it the safe interchange format and
XenHammer's primary save format.

### 1.1 Structure

```
// comments run to the end of the line
{                                   ← entity
"classname" "worldspawn"            ← key/value pairs, both quoted
"mapversion" "220"
"wad" "\half-life\valve\halflife.wad;\half-life\valve\liquids.wad"
{                                   ← brush (only inside brush entities)
( x1 y1 z1 ) ( x2 y2 z2 ) ( x3 y3 z3 ) TEXNAME [ Ux Uy Uz Uoff ] [ Vx Vy Vz Voff ] rot sx sy
...                                 ← one line per face, at least 4 per brush
}
}
{
"classname" "info_player_start"     ← point entity: key/values only
"origin" "0 0 -220"
}
```

- The first entity must be `worldspawn`. It owns all world brushes.
- Brush entities (`func_wall`, `func_door`, `trigger_*`, …) contain brush blocks like worldspawn.
  Point entities (`light`, `info_player_start`, …) have an `origin` key and no brushes.
- Values are not escaped: a backslash is just a backslash, and values can't contain `"`.
- `mapversion 220` marks the Valve format. Without it, faces use the Quake "standard" format (§1.4).
- `wad` lists the WAD files to use, separated by `;`. The compilers usually match them by file name
  (`-wadautodetect`, `-nowadtextures`). The paths are from the mapper's machine and mean nothing in a
  browser. XenHammer keeps the key, but resolves textures by WAD **basename** against WADs the user
  has loaded.

### 1.2 Face planes

The three points define the face's plane. They don't need to be vertices of the face, only points on
the plane. Following qbsp:

```
normal = normalize((p1 − p2) × (p3 − p2))
dist   = dot(p2, normal)
```

The normal points **out of** the brush. A brush is the intersection of the half-spaces
`dot(normal, p) ≤ dist` of its faces, so it is always convex. The editor gets the actual polygons
by clipping a huge square on each plane with every other plane (`BaseWindingForPlane` +
`ChopWinding`, see `src/geom/`).

For an axis-aligned box `(x0,y0,z0)–(x1,y1,z1)`, the point order XenHammer writes (checked by
`src/geom/plane.test.ts`) is:

| Face | p1         | p2         | p3         |
| ---- | ---------- | ---------- | ---------- |
| +Z   | (x0 y0 z1) | (x0 y1 z1) | (x1 y0 z1) |
| −Z   | (x0 y0 z0) | (x1 y0 z0) | (x0 y1 z0) |
| +X   | (x1 y0 z0) | (x1 y0 z1) | (x1 y1 z0) |
| −X   | (x0 y0 z0) | (x0 y1 z0) | (x0 y0 z1) |
| +Y   | (x0 y1 z0) | (x1 y1 z0) | (x0 y1 z1) |
| −Y   | (x0 y0 z0) | (x0 y0 z1) | (x1 y0 z0) |

For general brushes the writer takes three vertices of the face polygon. They need to be spread out,
not nearly collinear, and in the order that gives the outward normal. Vertices that sit on the grid
are written as integers. The compilers re-derive planes from these points, so rounding noise in them
turns into tiny plane errors and, at worst, gaps between brushes.

### 1.3 Texture mapping (Valve 220)

`[ Ux Uy Uz Uoff ] [ Vx Vy Vz Voff ] rot sx sy`

- `U` and `V` are the world-space texture axes, which are not necessarily on the face plane or
  orthogonal. `Uoff` and `Voff` are offsets in texels.
- `sx` and `sy` are world units per texel. 1 means one texel per unit; negative values mirror the texture.
- For a world-space point `P` on the face:

  ```
  s = (dot(P, U) / sx + Uoff) / textureWidth
  t = (dot(P, V) / sy + Voff) / textureHeight
  ```

- `rot` is informational only. The rotation is already part of `U` and `V`. Hammer shows it in the
  Face Edit dialog, so it is kept round-trip.
- Default ("aligned to world") axes come from the qbsp `baseaxis` table, picked by the face normal's
  dominant direction:

  | Dominant normal    | U         | V          |
  | ------------------ | --------- | ---------- |
  | ±Z (floor/ceiling) | ( 1 0 0 ) | ( 0 −1 0 ) |
  | ±X (wall)          | ( 0 1 0 ) | ( 0 0 −1 ) |
  | ±Y (wall)          | ( 1 0 0 ) | ( 0 0 −1 ) |

  Ties go to the first entry in qbsp's order (floor, ceiling, west, east, south, north). With these
  axes, textures tile seamlessly across touching faces. That's what Hammer's "World" alignment and
  the 3D shader's procedural checker use.

### 1.4 Quake "standard" format (Implement: read only)

Older or non-Valve maps (no `mapversion 220`) write faces as:

```
( p1 ) ( p2 ) ( p3 ) TEXNAME xoff yoff rot sx sy
```

When loading, convert to 220: take the `baseaxis` U/V for the face normal, rotate them by `rot` degrees
around the axis they share (qbsp `TextureAxisFromPlane` and the rotation in `ParseBrush`), then put
`xoff`, `yoff`, `sx`, `sy` into the 220 fields. Saving always writes 220.

### 1.5 Reference: "the box"

A sealed 512×512×512 room (inside) with 16-unit walls, a player start and a light. This is the
target file for the first milestone. Texture names are placeholders; use any names from your WAD
(15 characters max).

```
// Game: Half-Life
// Format: Valve220 (written by hand as a reference)
{
"classname" "worldspawn"
"mapversion" "220"
"wad" "\half-life\valve\halflife.wad"
"MaxRange" "4096"
{
( -272 -272 -256 ) ( -272 272 -256 ) ( 272 -272 -256 ) FLOOR_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( -272 -272 -272 ) ( 272 -272 -272 ) ( -272 272 -272 ) FLOOR_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( 272 -272 -272 ) ( 272 -272 -256 ) ( 272 272 -272 ) FLOOR_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 -272 -272 ) ( -272 272 -272 ) ( -272 -272 -256 ) FLOOR_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 272 -272 ) ( 272 272 -272 ) ( -272 272 -256 ) FLOOR_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 -272 -272 ) ( -272 -272 -256 ) ( 272 -272 -272 ) FLOOR_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
}
{
( -272 -272 272 ) ( -272 272 272 ) ( 272 -272 272 ) CEIL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( -272 -272 256 ) ( 272 -272 256 ) ( -272 272 256 ) CEIL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( 272 -272 256 ) ( 272 -272 272 ) ( 272 272 256 ) CEIL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 -272 256 ) ( -272 272 256 ) ( -272 -272 272 ) CEIL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 272 256 ) ( 272 272 256 ) ( -272 272 272 ) CEIL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 -272 256 ) ( -272 -272 272 ) ( 272 -272 256 ) CEIL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
}
{
( -272 -272 256 ) ( -272 272 256 ) ( -256 -272 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( -272 -272 -256 ) ( -256 -272 -256 ) ( -272 272 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( -256 -272 -256 ) ( -256 -272 256 ) ( -256 272 -256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 -272 -256 ) ( -272 272 -256 ) ( -272 -272 256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 272 -256 ) ( -256 272 -256 ) ( -272 272 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -272 -272 -256 ) ( -272 -272 256 ) ( -256 -272 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
}
{
( 256 -272 256 ) ( 256 272 256 ) ( 272 -272 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( 256 -272 -256 ) ( 272 -272 -256 ) ( 256 272 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( 272 -272 -256 ) ( 272 -272 256 ) ( 272 272 -256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( 256 -272 -256 ) ( 256 272 -256 ) ( 256 -272 256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( 256 272 -256 ) ( 272 272 -256 ) ( 256 272 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
( 256 -272 -256 ) ( 256 -272 256 ) ( 272 -272 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
}
{
( -256 -272 256 ) ( -256 -256 256 ) ( 256 -272 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( -256 -272 -256 ) ( 256 -272 -256 ) ( -256 -256 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( 256 -272 -256 ) ( 256 -272 256 ) ( 256 -256 -256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -256 -272 -256 ) ( -256 -256 -256 ) ( -256 -272 256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -256 -256 -256 ) ( 256 -256 -256 ) ( -256 -256 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -256 -272 -256 ) ( -256 -272 256 ) ( 256 -272 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
}
{
( -256 256 256 ) ( -256 272 256 ) ( 256 256 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( -256 256 -256 ) ( 256 256 -256 ) ( -256 272 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
( 256 256 -256 ) ( 256 256 256 ) ( 256 272 -256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -256 256 -256 ) ( -256 272 -256 ) ( -256 256 256 ) WALL_TEX [ 0 1 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -256 272 -256 ) ( 256 272 -256 ) ( -256 272 256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
( -256 256 -256 ) ( -256 256 256 ) ( 256 256 -256 ) WALL_TEX [ 1 0 0 0 ] [ 0 0 -1 0 ] 0 1 1
}
}
{
"classname" "info_player_start"
"origin" "0 0 -220"
"angles" "0 0 0"
}
{
"classname" "light"
"origin" "0 0 192"
"_light" "255 255 255 200"
}
```

Things to notice: the floor and ceiling cover the whole outer footprint, the X walls run the full Y
length, and the Y walls fit between them. Nothing overlaps and the room is sealed, so `hlbsp` won't
report a leak. The player start's origin is 36 units above the floor because the standing hull is
`(-16 -16 -36)–(16 16 36)`. `_light` is `R G B brightness`.

---

## 2. WAD3 textures (Implement: read)

GoldSrc textures live in WAD3 files (`halflife.wad`, `liquids.wad`, `decals.wad`, `xeno.wad`, mod
WADs and community packs). Each texture is 8-bit indexed with its own 256-color palette, plus three
precomputed mip levels.

### 2.1 File layout

```
Header (12 bytes)
  char[4]  magic        "WAD3"   ("WAD2" is Quake's format and has a shared palette; reject it)
  int32    numLumps
  int32    dirOffset    → directory

Directory: numLumps × 32-byte entries at dirOffset
  int32    filePos      offset of the lump data
  int32    diskSize     bytes stored
  int32    size         uncompressed size (same as diskSize; compression is never used)
  uint8    type         0x43 'C' = miptex (textures)
                        0x42 'B' = qpic (UI images, e.g. in gfx.wad)
                        0x46 'F' = font
  uint8    compression  0
  uint16   padding
  char[16] name         NUL-terminated; case-insensitive (store upper-case)
```

### 2.2 Miptex lump (`type 0x43`)

```
char[16]  name
uint32    width, height           multiples of 16
uint32    offsets[4]              from the lump start: mip 0..3
uint8     mip0[width * height]    palette indices, row-major, top row first
uint8     mip1[(w/2) * (h/2)]
uint8     mip2[(w/4) * (h/4)]
uint8     mip3[(w/8) * (h/8)]
uint16    paletteSize             always 256
uint8     palette[256 * 3]        RGB
(2 bytes padding to a 4-byte boundary)
```

Read the palette at `offsets[3] + (w/8)*(h/8) + 2`. Don't assume the lump's exact size, because some
tools pad it differently. Inside a `.bsp`, a miptex can have all offsets 0. That means the texture is
not embedded and has to be loaded from a WAD by name.

Name limits: 15 characters plus NUL. Texture names longer than 15 characters can't be used in a map.

### 2.3 Special texture names

The first character(s) of the name control how the engine and compilers treat a texture. The editor
mostly renders them normally, but should know them:

| Prefix / name             | Meaning                                                                                                      | Editor handling                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `{name`                   | Alpha-tested ("masked"): palette **index 255** is transparent (it is usually pure blue in the palette)       | Decode index 255 to alpha 0; alpha-test in the 3D shader |
| `!name`                   | Liquid (water, slime, lava): warps, and the face becomes a water volume when on a `func_water` or worldspawn | Render normally (warp later)                             |
| `+0name` … `+9name`       | Animation frames, cycled at 10 fps                                                                           | Show frame 0; animate later                              |
| `+aname` … `+jname`       | Alternate set, toggled by triggering the entity                                                              | Show `+a`                                                |
| `-0name` …                | Random tiling variants                                                                                       | Show as-is                                               |
| `sky`                     | Sky: not drawn, shows the skybox (`skyname` on worldspawn)                                                   | Draw as-is                                               |
| `aaatrigger`              | Convention for trigger brushes, invisible in game                                                            | Draw as-is (optionally translucent)                      |
| `clip`                    | Invisible player/monster clip (compilers)                                                                    | Draw as-is                                               |
| `origin`                  | Marks a brush entity's rotation origin; the brush is removed at compile                                      | Draw as-is                                               |
| `null` / `skip` / `bevel` | ZHLT/VHLT tool textures: face removed / not drawn                                                            | Draw as-is                                               |

### 2.4 Decoding and GPU upload

1. Parse the header and directory eagerly. That's enough for the texture browser (names and sizes).
2. When a texture is first needed, decode each mip level to RGBA8 with the lump's palette.
   For `{` textures, index 255 becomes `(0,0,0,0)`. Zeroing the RGB as well prevents blue fringes
   when filtering.
3. Upload as one `rgba8unorm` texture with 4 mip levels (`writeTexture` per level). Use a sampler with
   `repeat` addressing, nearest filtering for the classic look and linear as an option.
4. Keep an LRU cache of GPU textures keyed by upper-case name. Lookup order follows the `wad` key, and
   then any other loaded WADs.
5. A texture the user's WADs don't have renders with a generated magenta/black checker, and the face
   keeps its name.

Texture arrays or atlases are an optimization for later. Separate textures grouped into one draw per
material are fine for the brush counts of a GoldSrc map (thousands of faces).

### 2.5 Getting textures into a browser

Valve's WADs are copyrighted and **cannot be shipped** with XenHammer. Options:

- **Directory picker** (File System Access API, Chromium): the user picks their `Half-Life/valve`
  folder once. The handle is kept in IndexedDB, so it can be re-opened after a permission prompt.
- **File picker / drag-and-drop**: works everywhere. The WAD's bytes are cached in IndexedDB so they
  don't have to be picked again.
- **Community WADs** that are freely licensed, loaded the same way.
- **Built-in procedural dev textures** (generated in code), so the box can be built and saved without
  any WAD. They only serve as placeholders, because the compilers need the real textures.

Tests build tiny synthetic WADs in code, so no game data is needed in the repository.

---

## 3. FGD entity definitions (Implement: parse)

FGD ("Forge Game Data") files describe entity classes: their keys, types, defaults and how the editor
draws them. Hammer ships `halflife.fgd`. ZHLT/VHLT ship an extended one.

### 3.1 Grammar

```
// comment
@include "base.fgd"

@BaseClass = Targetname [ targetname(target_source) : "Name" ]

@BaseClass base(Targetname) = Angles [ angles(string) : "Pitch Yaw Roll (Y Z X)" : "0 0 0" ]

@PointClass base(Targetname, Angles) size(-16 -16 -36, 16 16 36) color(0 255 0)
  studio("models/player.mdl") = info_player_start : "Player 1 start" []

@PointClass iconsprite("sprites/lightbulb.spr") base(Target, Targetname, Light) = light :
  "Invisible lightsource"
[
  spawnflags(flags) = [ 1 : "Initially dark" : 0 ]
  style(choices) : "Appearance" : 0 = [ 0 : "Normal"  10 : "Fluorescent flicker" ]
]

@SolidClass base(Targetname, RenderFields) = func_wall : "Wall" []
```

- **Class types:** `@BaseClass` (only for inheritance), `@PointClass` (point entities), `@SolidClass`
  (brush entities).
- **Helpers** (any order, before `=`): `base(A, B, …)`, `size(x y z, x y z)` or `size(x y z)`,
  `color(r g b)`, `iconsprite("…")`, `sprite()`, `studio("…")` or `studio()`, `decal()`, `flags(…)`.
  Unknown helpers should be skipped, not treated as errors, because other tools add their own.
- **Header:** `= classname : "Description"`. A description string can be split as
  `"part 1" + "part 2"`.
- **Property:** `name(type) : "Display name" : default : "Long description"`. Everything after the
  type is optional, and an empty default is written as `: :`.
- **Types:** `string`, `integer`, `float`, `choices`, `flags`, `color255`, `color1`, `studio`, `sprite`,
  `sound`, `decal`, `target_source`, `target_destination`, `angle`. Treat unknown types as `string`.
- **`choices`** ends with `= [ value : "Label" … ]`. **`flags`** ends with `= [ bit : "Label" : default … ]`
  and is stored in `spawnflags` as a bit mask.
- `base()` inheritance merges properties in order. A property defined later overrides an earlier one
  with the same name.

### 3.2 Parsing approach

A tokenizer (identifiers, numbers, quoted strings, punctuation `@ = : ( ) [ ] , +`, and `//`
comments), then a small recursive-descent parser. Resolve inheritance after the whole file (and
its `@include`s) is read. Keep unknown constructs as warnings. Real-world FGDs are messy.

### 3.3 What ships

XenHammer includes a **small FGD of its own** (written from scratch, MIT licensed) with
`worldspawn`, `info_player_start`, `info_player_deathmatch`, `light`, `light_environment`,
`func_wall` and a basic `func_door`. That is enough for the box. Users load the full
`halflife.fgd` / VHLT FGD to get every entity.

### 3.4 Editor use

- 2D/3D views draw point entities as boxes with the class's `size()` and `color()`. A missing
  `size` means a 16-unit cube. Sprite and model previews (`iconsprite`, `studio`) need `.spr` and
  `.mdl` loaders. Later.
- The Object Properties dialog builds its key/value grid from the class's properties. It offers
  choice dropdowns, a flags checklist, and a color picker for `color255`.

---

## 4. Formats for later

### 4.1 RMF: Hammer's native format (Later: read and write)

Binary. Version 2.2 is what Hammer 3.4/3.5 write. _Verify_ the layout below against real files
(the Sledge and TWHL references are the best sources) before implementing.

```
float32   version            2.2
char[3]   "RMF"
int32     visGroupCount
VisGroup  × count            name char[128], color uint8[3], pad uint8, id int32, visible uint8, pad uint8[3]
CMapWorld                    root object (see below)
char[8]   "DOCINFO"          then camera data: float32 version, int32 active camera,
                             int32 count, count × (eye vec3, lookat vec3)
```

Objects start with a length-prefixed type name: `uint8 len`, then `len` bytes including the NUL,
e.g. `"CMapSolid"`. The common header is `int32 visGroup`, `uint8[3] color`, `int32 childCount`
followed by the children. After that, depending on the type:

- **CMapSolid:** `int32 faceCount`, then per face: `char[256] texture`, `float32` (unused),
  `vec3 U, float32 Uoff, vec3 V, float32 Voff, float32 rotation, float32 sx, float32 sy`,
  `uint8[16]` (unused), `int32 vertexCount`, `vec3[vertexCount] vertices`, `vec3[3] planePoints`.
- **CMapEntity:** the children are its brushes, then `string classname`, `uint8[4]` (unused),
  `int32 spawnflags`, `int32 kvCount`, `kvCount × (string key, string value)`, `uint8[14]` (unused),
  `vec3 origin`, `uint8[4]` (unused).
- **CMapGroup:** only the common header and children.
- **CMapWorld:** the common header and children, then the worldspawn entity data as in CMapEntity,
  then `int32 pathCount` and the paths (`path_corner` / `path_track` chains).

RMF keeps editor-only state that `.map` loses: visgroups, groups, object colors, cameras, paths.
That is why it is worth supporting eventually.

### 4.2 JMF: J.A.C.K. (Later: read only)

J.A.C.K.'s native binary format (`"JHMF"` magic, versions 121/122). It holds the same data as RMF
plus J.A.C.K. extras. Supporting it would let users import J.A.C.K. projects without losing groups
and visgroups. _Verify_ against the community documentation before implementing.

### 4.3 BSP v30: compiled maps (Later: read, for previews)

The output of `hlcsg → hlbsp → hlvis → hlrad`. Header: `int32 version = 30`, then 15 lump entries
(`int32 offset, int32 length`) in this order: entities, planes, textures, vertices, visibility,
nodes, texinfo, faces, lighting, clipnodes, leaves, marksurfaces, edges, surfedges, models.
The textures lump holds miptex entries in the WAD layout (§2.2), with zero offsets for textures not
embedded. A BSP reader would allow an in-browser "preview compiled map" with lightmaps.

### 4.4 Compiling

Out of scope for now. Options to evaluate later:

- Build VHLT (`hlcsg`, `hlbsp`, `hlvis`, `hlrad`) to WebAssembly and run it in a Worker. These are
  CPU-heavy, single-file C++ tools, so this is plausible. `hlrad` would benefit from WASM threads
  (requires cross-origin isolation).
- A user-run local or remote compile service the editor talks to.
- Export only: save the `.map` and let the user compile with their usual tools.
  This works from day one.

---

## 5. Engine and compiler limits worth enforcing in the editor

- Coordinates: keep all geometry inside **±4096** on each axis (Hammer's default map size). Outside
  that, the engine and compilers misbehave.
- Texture names: at most 15 characters. Texture sizes: multiples of 16.
- Brushes must be convex, closed, and have at least 4 faces with non-degenerate planes. The editor
  should reject or repair invalid solids (Hammer's "Check for Problems", Alt+P, comes later).
- The map must be sealed (no leaks into the void) for `hlvis`/`hlrad`. Leak detection is a compile
  step. The editor can only help by loading the `.pts` pointfile later.
