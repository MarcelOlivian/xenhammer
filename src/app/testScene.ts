import { boxPlanes, brushPolygons, type FacePolygon } from '../geom/brush';

/**
 * Hard-coded brushes that exercise the render path until maps can be loaded:
 * a floor slab, a 128-unit cube, and a block with one edge bevelled into a ramp
 * (an arbitrary, non-axis-aligned plane).
 */
export function testScene(): (FacePolygon | null)[][] {
  const r = Math.SQRT1_2;
  return [
    brushPolygons(boxPlanes([-384, -256, -80], [384, 256, -64])),
    brushPolygons(boxPlanes([-64, -64, -64], [64, 64, 64])),
    brushPolygons([
      ...boxPlanes([128, -64, -64], [320, 64, 64]),
      { normal: [r, 0, r], dist: 256 * r }, // cuts away x + z > 256
    ]),
  ];
}
