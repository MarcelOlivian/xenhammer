import { ON_EPSILON, planeDistance, type Plane } from './plane';
import { add, cross, dot, lerp, normalize, scale, sub, type Vec3 } from './vec3';

/** A convex polygon, as an ordered list of vertices. */
export type Winding = Vec3[];

/** Larger than any legal GoldSrc map coordinate (±4096), with headroom. */
export const MAX_WORLD_EXTENT = 65536;

/**
 * Returns a huge square lying on `plane` (the qbsp `BaseWindingForPlane`).
 * Vertices are counter-clockwise when viewed from the front of the plane.
 */
export function baseWindingForPlane(plane: Plane, extent = MAX_WORLD_EXTENT): Winding {
  const n = plane.normal;
  // Pick the world axis most perpendicular to the normal as a starting "up".
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  let up: Vec3 = az >= ax && az >= ay ? [1, 0, 0] : [0, 0, 1];

  // Project "up" onto the plane and build an orthonormal basis.
  up = normalize(sub(up, scale(n, dot(up, n))));
  const right = cross(up, n);
  const origin = scale(n, plane.dist);
  const u = scale(up, extent);
  const r = scale(right, extent);

  return [
    sub(add(origin, u), r),
    sub(sub(origin, u), r),
    add(sub(origin, u), r),
    add(add(origin, u), r),
  ];
}

/**
 * Clips `winding` by `plane`, keeping the back side (the qbsp `ChopWinding`).
 * Returns null when nothing is left.
 */
export function clipWindingBack(
  winding: Winding,
  plane: Plane,
  epsilon = ON_EPSILON,
): Winding | null {
  const dists = winding.map((p) => planeDistance(plane, p));
  const sides = dists.map((d) => (d > epsilon ? 1 : d < -epsilon ? -1 : 0));

  if (!sides.some((s) => s > 0)) return winding; // entirely behind / on: keep all
  if (!sides.some((s) => s < 0)) return null; // entirely in front: clipped away

  const out: Winding = [];
  for (let i = 0; i < winding.length; i++) {
    const p = winding[i]!;
    const side = sides[i]!;
    if (side <= 0) out.push(p);
    if (side === 0) continue;

    const j = (i + 1) % winding.length;
    const nextSide = sides[j]!;
    if (nextSide === 0 || nextSide === side) continue;

    // The edge crosses the plane: emit the intersection point.
    const t = dists[i]! / (dists[i]! - dists[j]!);
    out.push(lerp(p, winding[j]!, t));
  }
  return out.length >= 3 ? out : null;
}

/** Newell's method: un-normalized polygon normal following the vertex order. */
export function windingNormal(winding: Winding): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < winding.length; i++) {
    const a = winding[i]!;
    const b = winding[(i + 1) % winding.length]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}
