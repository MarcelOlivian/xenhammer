// Flat-colored line lists (brush wireframes in the 2D views).

struct Wire {
  viewProj: mat4x4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> u: Wire;

@vertex
fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f {
  return u.viewProj * vec4f(pos, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return u.color;
}
