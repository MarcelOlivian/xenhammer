import { describe, expect, it } from 'vitest';
import { boxPlanes, brushPolygons, polygonsBounds } from './brush';
import type { Plane } from './plane';
import { dot, normalize, type Vec3 } from './vec3';
import { windingNormal } from './winding';

describe('brushPolygons', () => {
  const min: Vec3 = [-64, -64, -64];
  const max: Vec3 = [64, 64, 64];

  it('clips a 6-plane box into 6 quads on the box corners', () => {
    const polys = brushPolygons(boxPlanes(min, max));
    expect(polys).toHaveLength(6);
    for (const poly of polys) {
      expect(poly).not.toBeNull();
      expect(poly!.vertices).toHaveLength(4);
      for (const v of poly!.vertices) {
        for (const c of v) expect(Math.abs(c)).toBe(64);
      }
    }
    expect(polygonsBounds(polys)).toEqual({ min, max });
  });

  it('orders vertices counter-clockwise seen from outside', () => {
    for (const poly of brushPolygons(boxPlanes(min, max))) {
      const n = normalize(windingNormal(poly!.vertices));
      expect(dot(n, poly!.plane.normal)).toBeCloseTo(1);
    }
  });

  it('drops a redundant plane that lies outside the brush', () => {
    const outside: Plane = { normal: [1, 0, 0], dist: 128 };
    const polys = brushPolygons([...boxPlanes(min, max), outside]);
    expect(polys[6]).toBeNull();
    expect(polys.slice(0, 6).every((p) => p?.vertices.length === 4)).toBe(true);
  });

  it('cuts a corner with a diagonal plane', () => {
    const d = 1 / Math.SQRT2;
    const bevel: Plane = { normal: [d, d, 0], dist: 64 * d }; // through (64,0) and (0,64)
    const polys = brushPolygons([...boxPlanes(min, max), bevel]);
    expect(polys[6]?.vertices).toHaveLength(4);
    // +x face is narrowed to y ∈ [-64, 0]
    expect(polys[0]?.vertices).toHaveLength(4);
    expect(Math.max(...polys[0]!.vertices.map((v) => v[1]))).toBe(0);
    expect(polys[4]?.vertices).toHaveLength(5); // +z face becomes a pentagon
  });
});
