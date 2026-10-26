// Analytic 2D grid for the orthographic views, drawn as one fullscreen triangle.
// All distances are in device pixels. World position is reconstructed from the
// fragment position so lines stay exactly 1px wide at any zoom.

struct Grid {
  size: vec2f,        // framebuffer size in device px
  center: vec2f,      // world coords (horizontal, vertical axis) at the view center
  ppu: f32,           // device px per world unit
  step: f32,          // current grid step in world units
  minorAlpha: f32,    // 0 when the step grid would be too dense
  majorAlpha: f32,    // same, for the 64-unit lines
  background: vec4f,
  minorColor: vec4f,
  majorColor: vec4f,
  hugeColor: vec4f,   // every 1024 units
  axisColor: vec4f,
};

@group(0) @binding(0) var<uniform> g: Grid;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

// 1 on a line, fading to 0 one pixel away.
fn coverage(w: f32, spacing: f32) -> f32 {
  let d = abs(w - round(w / spacing) * spacing) * g.ppu;
  return clamp(1.0 - d, 0.0, 1.0);
}

fn coverage2(w: vec2f, spacing: f32) -> f32 {
  return max(coverage(w.x, spacing), coverage(w.y, spacing));
}

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  // Pixel i maps to offset (i - floor(size / 2)), matching Camera2D.
  let px = pos.xy - floor(g.size * 0.5) - 0.5;
  let w = g.center + vec2f(px.x, -px.y) / g.ppu;

  var c = g.background.rgb;
  c = mix(c, g.minorColor.rgb, coverage2(w, g.step) * g.minorAlpha);
  c = mix(c, g.majorColor.rgb, coverage2(w, 64.0) * g.majorAlpha);
  c = mix(c, g.hugeColor.rgb, coverage2(w, 1024.0));
  let axis = max(clamp(1.0 - abs(w.x) * g.ppu, 0.0, 1.0), clamp(1.0 - abs(w.y) * g.ppu, 0.0, 1.0));
  c = mix(c, g.axisColor.rgb, axis);
  return vec4f(c, 1.0);
}
