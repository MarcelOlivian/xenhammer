/**
 * Minimal float64 3-vector math for the geometry kernel.
 *
 * Vectors are plain readonly tuples so they are cheap to create, easy to
 * compare in tests and independent of the GPU-side float32 math.
 */
export type Vec3 = readonly [number, number, number];

export const vec3 = (x: number, y: number, z: number): Vec3 => [x, y, z];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const length = (a: Vec3): number => Math.sqrt(dot(a, a));

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len === 0 ? [0, 0, 0] : scale(a, 1 / len);
}

/** Linear interpolation a + (b - a) * t. */
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Snap components that are within `epsilon` of an integer to that integer.
 * Clipping axis-aligned brushes produces values like 63.99999999; this keeps
 * vertices (and later the plane points written to .map files) clean.
 */
export function snapNearInteger(a: Vec3, epsilon = 1e-4): Vec3 {
  const snap = (v: number) => {
    const r = Math.round(v);
    return Math.abs(v - r) < epsilon ? r : v;
  };
  return [snap(a[0]), snap(a[1]), snap(a[2])];
}
