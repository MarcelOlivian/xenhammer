import { cross, dot, normalize, sub, type Vec3 } from './vec3';

/**
 * A plane `dot(normal, p) = dist`. For brush faces the normal points out of
 * the brush, so the brush interior is the back side (`dot(normal, p) < dist`).
 */
export interface Plane {
  readonly normal: Vec3;
  readonly dist: number;
}

/** Distance tolerance for "on plane" classification, in map units. */
export const ON_EPSILON = 0.01;

/**
 * Builds a plane from the three points of a .map face, using the qbsp
 * convention: `normal = normalize((p1 - p2) × (p3 - p2))`, `dist = dot(p2, normal)`.
 * Points written in that order produce an outward-facing normal.
 */
export function planeFromPoints(p1: Vec3, p2: Vec3, p3: Vec3): Plane {
  const normal = normalize(cross(sub(p1, p2), sub(p3, p2)));
  return { normal, dist: dot(p2, normal) };
}

/** Signed distance from `p` to the plane (positive = front / outside). */
export const planeDistance = (plane: Plane, p: Vec3): number => dot(plane.normal, p) - plane.dist;
