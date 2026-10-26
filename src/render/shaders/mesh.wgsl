// Solid brush faces in the 3D camera view. Until textures are wired up, faces
// get a procedural "dev" checker projected along the dominant axis (the same
// axis choice qbsp uses for default texture axes), plus Hammer-style fake
// lighting: a fixed brightness per face orientation, no light entities.

struct Camera {
  viewProj: mat4x4f,
};

@group(0) @binding(0) var<uniform> cam: Camera;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
};

@vertex
fn vs(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VsOut {
  var out: VsOut;
  out.pos = cam.viewProj * vec4f(pos, 1.0);
  out.world = pos;
  out.normal = normal;
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let a = abs(n);
  var uv: vec2f;
  if (a.z >= a.x && a.z >= a.y) {
    uv = in.world.xy;
  } else if (a.x >= a.y) {
    uv = in.world.yz;
  } else {
    uv = in.world.xz;
  }

  let cell = floor(uv / 32.0);
  let checker = (i32(cell.x) + i32(cell.y)) & 1;
  var base = select(vec3f(0.62, 0.42, 0.24), vec3f(0.52, 0.34, 0.19), checker == 1);

  // Thin lines every 128 units, like a dev texture's border.
  let f = abs(fract(uv / 128.0 + 0.5) - 0.5) * 128.0;
  if (min(f.x, f.y) < 0.75) {
    base = base * 0.6;
  }

  let shade = 0.65 + 0.25 * n.z + 0.1 * abs(n.x);
  return vec4f(base * shade, 1.0);
}
