import type { Renderer, RenderView } from './renderer';

/**
 * Base class for a viewport canvas: configures its WebGPU context and keeps
 * the backing store sized to CSS size × devicePixelRatio.
 */
export abstract class Viewport implements RenderView {
  readonly context: GPUCanvasContext;
  /** Backing store size in device pixels. */
  width = 0;
  height = 0;
  dpr = 1;

  private readonly resizeObserver: ResizeObserver;

  constructor(
    readonly canvas: HTMLCanvasElement,
    protected readonly renderer: Renderer,
  ) {
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('Could not get a WebGPU canvas context');
    this.context = context;
    context.configure({ device: renderer.device, format: renderer.format, alphaMode: 'opaque' });

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      this.dpr = window.devicePixelRatio || 1;
      const box = entry.devicePixelContentBoxSize?.[0];
      const w = box ? box.inlineSize : Math.round(entry.contentRect.width * this.dpr);
      const h = box ? box.blockSize : Math.round(entry.contentRect.height * this.dpr);
      if (w === this.width && h === this.height) return;
      this.width = canvas.width = Math.max(1, w);
      this.height = canvas.height = Math.max(1, h);
      this.onResize();
      this.invalidate();
    });
    try {
      this.resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
      this.resizeObserver.observe(canvas); // Safari: no device-pixel-content-box
    }
  }

  invalidate(): void {
    this.renderer.invalidate(this);
  }

  /** Framebuffer coordinates of a pointer event. */
  protected eventToFramebuffer(e: MouseEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * this.dpr, (e.clientY - rect.top) * this.dpr];
  }

  protected onResize(): void {}

  /** Where this view's frame is drawn. Override to render off-screen (tests, thumbnails). */
  protected colorTarget(): GPUTextureView {
    return this.context.getCurrentTexture().createView();
  }

  encode(encoder: GPUCommandEncoder): void {
    // Skip until the first ResizeObserver callback has sized the canvas.
    if (this.width > 0 && this.height > 0) this.draw(encoder);
  }

  /** Records this view's render pass; the canvas is known to be sized. */
  protected abstract draw(encoder: GPUCommandEncoder): void;

  tick?(dtSeconds: number): boolean;

  destroy(): void {
    this.resizeObserver.disconnect();
    this.renderer.removeView(this);
    this.context.unconfigure();
  }
}
