import type { Gpu } from './gpu';
import type { SceneGeometry } from './meshBuilder';
import gridWgsl from './shaders/grid.wgsl?raw';
import meshWgsl from './shaders/mesh.wgsl?raw';
import wireWgsl from './shaders/wire.wgsl?raw';

export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** Something the renderer draws into: one per viewport canvas. */
export interface RenderView {
  /** Records this view's frame. Called only for views marked dirty. */
  encode(encoder: GPUCommandEncoder): void;
  /** Per-frame update (e.g. camera fly). Return true to keep animating. */
  tick?(dtSeconds: number): boolean;
}

interface VertexBuffer {
  buffer: GPUBuffer;
  count: number;
}

/**
 * Owns the shared pipelines and scene buffers, and schedules frames. Views
 * are redrawn on demand: nothing renders until something calls invalidate().
 */
export class Renderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly gridPipeline: GPURenderPipeline;
  readonly wirePipeline: GPURenderPipeline;
  readonly meshPipeline: GPURenderPipeline;

  triangles: VertexBuffer | null = null;
  lines: VertexBuffer | null = null;

  private readonly views = new Set<RenderView>();
  private readonly dirty = new Set<RenderView>();
  private frameHandle = 0;
  private lastFrameTime: number | null = null;

  constructor(gpu: Gpu) {
    this.device = gpu.device;
    this.format = gpu.format;
    const d = this.device;
    const target: GPUColorTargetState = { format: this.format };

    const grid = d.createShaderModule({ label: 'grid', code: gridWgsl });
    this.gridPipeline = d.createRenderPipeline({
      label: 'grid',
      layout: 'auto',
      vertex: { module: grid, entryPoint: 'vs' },
      fragment: { module: grid, entryPoint: 'fs', targets: [target] },
      primitive: { topology: 'triangle-list' },
    });

    const wire = d.createShaderModule({ label: 'wire', code: wireWgsl });
    this.wirePipeline = d.createRenderPipeline({
      label: 'wire',
      layout: 'auto',
      vertex: {
        module: wire,
        entryPoint: 'vs',
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        ],
      },
      fragment: { module: wire, entryPoint: 'fs', targets: [target] },
      primitive: { topology: 'line-list' },
    });

    const mesh = d.createShaderModule({ label: 'mesh', code: meshWgsl });
    this.meshPipeline = d.createRenderPipeline({
      label: 'mesh',
      layout: 'auto',
      vertex: {
        module: mesh,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
            ],
          },
        ],
      },
      fragment: { module: mesh, entryPoint: 'fs', targets: [target] },
      // Brushes are closed and depth-tested, so culling is an optimization we
      // can turn on once face winding is covered by tests end to end.
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
  }

  setScene(geometry: SceneGeometry): void {
    this.triangles?.buffer.destroy();
    this.lines?.buffer.destroy();
    this.triangles = this.upload(
      'scene triangles',
      geometry.triangles,
      geometry.triangleVertexCount,
    );
    this.lines = this.upload('scene lines', geometry.lines, geometry.lineVertexCount);
    this.invalidate();
  }

  addView(view: RenderView): void {
    this.views.add(view);
    this.invalidate(view);
  }

  removeView(view: RenderView): void {
    this.views.delete(view);
    this.dirty.delete(view);
  }

  /** Marks one view (or all of them) for redraw on the next animation frame. */
  invalidate(view?: RenderView): void {
    if (view) this.dirty.add(view);
    else for (const v of this.views) this.dirty.add(v);
    if (!this.frameHandle) this.frameHandle = requestAnimationFrame(this.frame);
  }

  private upload(label: string, data: Float32Array, count: number): VertexBuffer | null {
    if (count === 0) return null;
    const buffer = this.device.createBuffer({
      label,
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buffer, 0, data);
    return { buffer, count };
  }

  private readonly frame = (time: number): void => {
    this.frameHandle = 0;
    const dt =
      this.lastFrameTime === null ? 1 / 60 : Math.min(0.1, (time - this.lastFrameTime) / 1000);

    let animating = false;
    for (const view of this.views) {
      if (view.tick?.(dt)) {
        animating = true;
        this.dirty.add(view);
      }
    }

    if (this.dirty.size > 0) {
      const encoder = this.device.createCommandEncoder({ label: 'frame' });
      for (const view of this.dirty) view.encode(encoder);
      this.dirty.clear();
      this.device.queue.submit([encoder.finish()]);
    }

    if (animating) {
      this.lastFrameTime = time;
      this.frameHandle = requestAnimationFrame(this.frame);
    } else {
      this.lastFrameTime = null;
    }
  };
}
