import type { Plane } from './plane';
import { dot, snapNearInteger, type Vec3 } from './vec3';
import { baseWindingForPlane, clipWindingBack, windingNormal, type Winding } from './winding';

/** The polygon a brush face ends up as after clipping, or null if it vanished. */
export interface FacePolygon {
  readonly plane: Plane;
  /** Counter-clockwise when viewed from outside the brush. */
  readonly vertices: Winding;
}

export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

/**
 * Turns a convex brush, given as the planes of its faces, into one polygon per
 * face. Each face's base winding is clipped by every other plane. Faces that
 * contribute nothing (redundant planes) map to null.
 */
export function brushPolygons(planes: readonly Plane[]): (FacePolygon | null)[] {
  return planes.map((plane, i) => {
    let w: Winding | null = baseWindingForPlane(plane);
    for (let j = 0; j < planes.length && w; j++) {
      if (j !== i) w = clipWindingBack(w, planes[j]!);
    }
    if (!w) return null;

    let vertices = w.map((v) => snapNearInteger(v));
    if (dot(windingNormal(vertices), plane.normal) < 0) vertices = vertices.reverse();
    return { plane, vertices };
  });
}

/** The 6 outward-facing planes of an axis-aligned box. */
export function boxPlanes(min: Vec3, max: Vec3): Plane[] {
  return [
    { normal: [1, 0, 0], dist: max[0] },
    { normal: [-1, 0, 0], dist: -min[0] },
    { normal: [0, 1, 0], dist: max[1] },
    { normal: [0, -1, 0], dist: -min[1] },
    { normal: [0, 0, 1], dist: max[2] },
    { normal: [0, 0, -1], dist: -min[2] },
  ];
}

export function polygonsBounds(polygons: readonly (FacePolygon | null)[]): Aabb | null {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (const poly of polygons) {
    for (const v of poly?.vertices ?? []) {
      any = true;
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, v[k]!);
        max[k] = Math.max(max[k]!, v[k]!);
      }
    }
  }
  if (!any) return null;
  return { min: [min[0]!, min[1]!, min[2]!], max: [max[0]!, max[1]!, max[2]!] };
}
