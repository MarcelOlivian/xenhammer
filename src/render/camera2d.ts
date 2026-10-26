/** World axis indices for an orthographic view: horizontal, vertical and depth. */
export interface ViewAxes {
  readonly h: 0 | 1 | 2;
  readonly v: 0 | 1 | 2;
  readonly depth: 0 | 1 | 2;
}

export type OrthoKind = 'top' | 'front' | 'side';

/** Hammer's layout: top = X/Y, front = Y/Z, side = X/Z (Z is up). */
export const ORTHO_AXES: Record<OrthoKind, ViewAxes> = {
  top: { h: 0, v: 1, depth: 2 },
  front: { h: 1, v: 2, depth: 0 },
  side: { h: 0, v: 2, depth: 1 },
};

export const MIN_ZOOM = 1 / 64;
export const MAX_ZOOM = 256;

/**
 * Pan/zoom state of a 2D view. `zoom` is CSS pixels per world unit; methods
 * take framebuffer (device pixel) coordinates plus the device pixel ratio.
 *
 * Pixel mapping, shared with grid.wgsl so lines land on pixel centers:
 *   fbX = floor(W / 2) + 0.5 + (h - centerH) * ppu
 *   fbY = floor(H / 2) + 0.5 - (v - centerV) * ppu
 */
export class Camera2D {
  centerH = 0;
  centerV = 0;
  zoom = 1;

  constructor(readonly axes: ViewAxes) {}

  /** World (h, v) under a framebuffer coordinate. */
  worldAt(fbX: number, fbY: number, width: number, height: number, dpr: number): [number, number] {
    const ppu = this.zoom * dpr;
    return [
      this.centerH + (fbX - Math.floor(width / 2) - 0.5) / ppu,
      this.centerV - (fbY - Math.floor(height / 2) - 0.5) / ppu,
    ];
  }

  /** Multiplies the zoom by `factor`, keeping the world point under the cursor fixed. */
  zoomAt(
    fbX: number,
    fbY: number,
    width: number,
    height: number,
    dpr: number,
    factor: number,
  ): void {
    const [h, v] = this.worldAt(fbX, fbY, width, height, dpr);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const ppu = this.zoom * dpr;
    this.centerH = h - (fbX - Math.floor(width / 2) - 0.5) / ppu;
    this.centerV = v + (fbY - Math.floor(height / 2) - 0.5) / ppu;
  }

  /** Pans by a drag delta in CSS pixels (content follows the pointer). */
  panByPixels(dx: number, dy: number): void {
    this.centerH -= dx / this.zoom;
    this.centerV += dy / this.zoom;
  }

  /** Column-major world → clip matrix for this view's axes. */
  viewProj(width: number, height: number, dpr: number, out = new Float32Array(16)): Float32Array {
    const ppu = this.zoom * dpr;
    const sx = (2 * ppu) / width;
    const sy = (2 * ppu) / height;
    out.fill(0);
    out[this.axes.h * 4 + 0] = sx;
    out[this.axes.v * 4 + 1] = sy;
    out[12] = (2 * (Math.floor(width / 2) + 0.5 - this.centerH * ppu)) / width - 1;
    out[13] = 1 - (2 * (Math.floor(height / 2) + 0.5 + this.centerV * ppu)) / height;
    out[14] = 0.5;
    out[15] = 1;
    return out;
  }
}
