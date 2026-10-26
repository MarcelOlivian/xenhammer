import type { FacePolygon } from '../geom/brush';

export interface SceneGeometry {
  /** Triangle list, interleaved position (xyz) + normal (xyz). */
  readonly triangles: Float32Array;
  readonly triangleVertexCount: number;
  /** Line list of brush edges, positions only (xyz). */
  readonly lines: Float32Array;
  readonly lineVertexCount: number;
}

/**
 * Flattens brush face polygons into GPU-ready vertex data: fan-triangulated
 * faces for the 3D view, and every polygon edge for the 2D wireframes.
 * Shared edges are emitted once per face; at this scale that is cheaper than
 * deduplicating.
 */
export function buildSceneGeometry(
  brushes: readonly (readonly (FacePolygon | null)[])[],
): SceneGeometry {
  const tris: number[] = [];
  const lines: number[] = [];

  for (const faces of brushes) {
    for (const face of faces) {
      if (!face) continue;
      const v = face.vertices;
      const [nx, ny, nz] = face.plane.normal;
      for (let i = 1; i + 1 < v.length; i++) {
        for (const p of [v[0]!, v[i]!, v[i + 1]!]) tris.push(p[0], p[1], p[2], nx, ny, nz);
      }
      for (let i = 0; i < v.length; i++) {
        const a = v[i]!;
        const b = v[(i + 1) % v.length]!;
        lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
  }

  return {
    triangles: new Float32Array(tris),
    triangleVertexCount: tris.length / 6,
    lines: new Float32Array(lines),
    lineVertexCount: lines.length / 3,
  };
}
