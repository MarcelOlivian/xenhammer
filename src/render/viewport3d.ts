import { input } from '../app/input';
import { Camera3D } from './camera3d';
import { DEPTH_FORMAT, type Renderer } from './renderer';
import { Viewport } from './viewport';

const MOVE_SPEED = 640; // units per second
const FAST_MULTIPLIER = 3;
const WHEEL_STEP = 64; // units per wheel notch
const LOOK_SENSITIVITY = 0.004; // radians per CSS pixel

/** The 3D camera view: solid brushes with fake lighting, free-fly controls. */
export class Viewport3D extends Viewport {
  readonly camera = new Camera3D();
  private readonly cameraUniform: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly cameraData = new Float32Array(16);
  private depth: GPUTexture | null = null;
  private hovered = false;
  private dragLook: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, renderer: Renderer) {
    super(canvas, renderer);
    const d = renderer.device;
    this.cameraUniform = d.createBuffer({
      label: 'camera',
      size: this.cameraData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = d.createBindGroup({
      layout: renderer.meshPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraUniform } }],
    });

    canvas.addEventListener('pointerenter', () => (this.hovered = true));
    canvas.addEventListener('pointerleave', () => (this.hovered = false));
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', this.onLockedMouseMove);
    document.addEventListener('pointerlockchange', () => this.invalidate());

    // Hammer toggles mouselook with Z; movement keys kick the animation loop.
    input.onKeyDown((code) => {
      if (!this.hovered && !this.isLocked) return false;
      if (code === 'KeyZ') {
        if (this.isLocked) document.exitPointerLock();
        else void this.canvas.requestPointerLock();
        return true;
      }
      if (MOVE_KEYS.has(code)) {
        this.invalidate();
        return true;
      }
      return false;
    });
  }

  private get isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  override tick(dt: number): boolean {
    if (!this.hovered && !this.isLocked) return false;
    const axis = (pos: string[], neg: string[]) =>
      (pos.some((k) => input.isDown(k)) ? 1 : 0) - (neg.some((k) => input.isDown(k)) ? 1 : 0);
    const fwd = axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const right = axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    const up = axis(['KeyE'], ['KeyQ']);
    if (!fwd && !right && !up) return false;

    const speed =
      MOVE_SPEED *
      (input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? FAST_MULTIPLIER : 1) *
      dt;
    this.camera.move(fwd * speed, right * speed, up * speed);
    return true;
  }

  protected override onResize(): void {
    this.depth?.destroy();
    this.depth = this.renderer.device.createTexture({
      label: 'camera depth',
      size: [this.width, this.height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  protected draw(encoder: GPUCommandEncoder): void {
    if (!this.depth) return;
    this.camera.viewProj(this.width / this.height, this.cameraData);
    this.renderer.device.queue.writeBuffer(this.cameraUniform, 0, this.cameraData);

    const pass = encoder.beginRenderPass({
      label: 'camera view',
      colorAttachments: [
        {
          view: this.colorTarget(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depth.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });
    const tris = this.renderer.triangles;
    if (tris) {
      pass.setPipeline(this.renderer.meshPipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.setVertexBuffer(0, tris.buffer);
      pass.draw(tris.count);
    }
    pass.end();
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 2 || this.isLocked) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.dragLook = { x: e.clientX, y: e.clientY };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragLook) return;
    this.lookBy(e.clientX - this.dragLook.x, e.clientY - this.dragLook.y);
    this.dragLook = { x: e.clientX, y: e.clientY };
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.dragLook) return;
    this.dragLook = null;
    this.canvas.releasePointerCapture(e.pointerId);
  };

  private readonly onLockedMouseMove = (e: MouseEvent): void => {
    if (this.isLocked) this.lookBy(e.movementX, e.movementY);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.deltaY === 0) return;
    this.camera.move(e.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP, 0, 0);
    this.invalidate();
  };

  private lookBy(dx: number, dy: number): void {
    this.camera.look(-dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
    this.invalidate();
  }
}

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
