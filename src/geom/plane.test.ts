import { describe, expect, it } from 'vitest';
import { planeFromPoints } from './plane';
import type { Vec3 } from './vec3';

// Face point triples for an axis-aligned box brush, in the order XenHammer
// writes them (and the order docs/goldsrc-formats.md documents). Each must
// produce an outward-facing normal under the qbsp convention.
const x0 = -64,
  y0 = -32,
  z0 = 0,
  x1 = 64,
  y1 = 32,
  z1 = 128;
const boxFaces: [string, Vec3, Vec3, Vec3, Vec3, number][] = [
  ['+z', [x0, y0, z1], [x0, y1, z1], [x1, y0, z1], [0, 0, 1], z1],
  ['-z', [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [0, 0, -1], -z0],
  ['+x', [x1, y0, z0], [x1, y0, z1], [x1, y1, z0], [1, 0, 0], x1],
  ['-x', [x0, y0, z0], [x0, y1, z0], [x0, y0, z1], [-1, 0, 0], -x0],
  ['+y', [x0, y1, z0], [x1, y1, z0], [x0, y1, z1], [0, 1, 0], y1],
  ['-y', [x0, y0, z0], [x0, y0, z1], [x1, y0, z0], [0, -1, 0], -y0],
];

describe('planeFromPoints', () => {
  it.each(boxFaces)('%s face points give an outward normal', (_name, p1, p2, p3, normal, dist) => {
    const plane = planeFromPoints(p1, p2, p3);
    expect(plane.normal.map((c) => c + 0)).toEqual(normal); // `+ 0` folds -0 into 0
    expect(plane.dist).toBeCloseTo(dist);
  });

  it('reversing the point order flips the normal', () => {
    const a = planeFromPoints([0, 0, 0], [0, 1, 0], [1, 0, 0]);
    const b = planeFromPoints([1, 0, 0], [0, 1, 0], [0, 0, 0]);
    expect(a.normal[2]).toBe(1);
    expect(b.normal[2]).toBe(-1);
  });
});
