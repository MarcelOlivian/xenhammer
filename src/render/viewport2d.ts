import { input } from '../app/input';
import { Camera2D, ORTHO_AXES, type OrthoKind } from './camera2d';
import type { Renderer } from './renderer';
import { Viewport } from './viewport';

/** Hammer-like 2D view colors (linear 0..1 RGBA). */
export const GRID_COLORS = {
  background: [0, 0, 0, 1],
  minor: [0.22, 0.22, 0.22, 1],
  major: [0.36, 0.36, 0.36, 1],
  huge: [0.44, 0.27, 0.12, 1],
  axis: [0.1, 0.42, 0.42, 1],
  brush: [1, 1, 1, 1],
} as const;

/** Grid lines closer together than this (CSS px) are hidden. */
const MIN_LINE_SPACING = 4;
const ZOOM_STEP = 1.2;

export interface Viewport2DOptions {
  kind: OrthoKind;
  getGridSize: () => number;
  /** Cursor moved: world coordinates on the view's horizontal and vertical axes. */
  onCursor?: (h: number, v: number) => void;
  onZoom?: (zoom: number) => void;
}

export class Viewport2D extends Viewport {
  readonly camera: Camera2D;
  private readonly gridUniform: GPUBuffer;
  private readonly wireUniform: GPUBuffer;
  private readonly gridBindGroup: GPUBindGroup;
  private readonly wireBindGroup: GPUBindGroup;
  private readonly gridData = new Float32Array(28);
  private readonly wireData = new Float32Array(20);
  private pan: { x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    private readonly options: Viewport2DOptions,
  ) {
    super(canvas, renderer);
    this.camera = new Camera2D(ORTHO_AXES[options.kind]);

    const d = renderer.device;
    const usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
    this.gridUniform = d.createBuffer({
      label: `${options.kind} grid`,
      size: this.gridData.byteLength,
      usage,
    });
    this.wireUniform = d.createBuffer({
      label: `${options.kind} wire`,
      size: this.wireData.byteLength,
      usage,
    });
    this.gridBindGroup = d.createBindGroup({
      layout: renderer.gridPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.gridUniform } }],
    });
    this.wireBindGroup = d.createBindGroup({
      layout: renderer.wirePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.wireUniform } }],
    });

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  protected draw(encoder: GPUCommandEncoder): void {
    const { device } = this.renderer;
    const step = this.options.getGridSize();
    const ppu = this.camera.zoom * this.dpr;

    const g = this.gridData;
    g.set([this.width, this.height, this.camera.centerH, this.camera.centerV, ppu, step]);
    g[6] = step * this.camera.zoom >= MIN_LINE_SPACING ? 1 : 0;
    g[7] = 64 * this.camera.zoom >= MIN_LINE_SPACING ? 1 : 0;
    g.set(GRID_COLORS.background, 8);
    g.set(GRID_COLORS.minor, 12);
    g.set(GRID_COLORS.major, 16);
    g.set(GRID_COLORS.huge, 20);
    g.set(GRID_COLORS.axis, 24);
    device.queue.writeBuffer(this.gridUniform, 0, g);

    this.camera.viewProj(this.width, this.height, this.dpr, this.wireData);
    this.wireData.set(GRID_COLORS.brush, 16);
    device.queue.writeBuffer(this.wireUniform, 0, this.wireData);

    const pass = encoder.beginRenderPass({
      label: `${this.options.kind} view`,
      colorAttachments: [
        {
          view: this.colorTarget(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.renderer.gridPipeline);
    pass.setBindGroup(0, this.gridBindGroup);
    pass.draw(3);

    const lines = this.renderer.lines;
    if (lines) {
      pass.setPipeline(this.renderer.wirePipeline);
      pass.setBindGroup(0, this.wireBindGroup);
      pass.setVertexBuffer(0, lines.buffer);
      pass.draw(lines.count);
    }
    pass.end();
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const panButton = e.button === 1 || (e.button === 0 && input.isDown('Space'));
    if (!panButton) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pan = { x: e.clientX, y: e.clientY };
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.pan) {
      this.camera.panByPixels(e.clientX - this.pan.x, e.clientY - this.pan.y);
      this.pan = { x: e.clientX, y: e.clientY };
      this.invalidate();
    }
    const [fx, fy] = this.eventToFramebuffer(e);
    const [h, v] = this.camera.worldAt(fx, fy, this.width, this.height, this.dpr);
    this.options.onCursor?.(h, v);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.pan) return;
    this.pan = null;
    this.canvas.releasePointerCapture(e.pointerId);
    this.canvas.style.cursor = '';
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.deltaY === 0) return;
    const [fx, fy] = this.eventToFramebuffer(e);
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.camera.zoomAt(fx, fy, this.width, this.height, this.dpr, factor);
    this.options.onZoom?.(this.camera.zoom);
    this.invalidate();
  };
}
