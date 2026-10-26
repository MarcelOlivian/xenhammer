export interface Gpu {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  /** Swap-chain format for every canvas (usually bgra8unorm). */
  readonly format: GPUTextureFormat;
}

export type GpuInitResult = { ok: true; gpu: Gpu } | { ok: false; reason: string };

/** Requests the WebGPU adapter and device. Never throws; failures come back as a reason. */
export async function initGpu(): Promise<GpuInitResult> {
  if (!('gpu' in navigator) || !navigator.gpu) {
    return { ok: false, reason: 'This browser does not expose navigator.gpu.' };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return {
        ok: false,
        reason: 'No suitable GPU adapter was found (it may be blocklisted or disabled).',
      };
    }
    const device = await adapter.requestDevice();
    device.addEventListener('uncapturederror', (e) => {
      console.error('[XenHammer] WebGPU error:', (e as GPUUncapturedErrorEvent).error.message);
    });
    return { ok: true, gpu: { adapter, device, format: navigator.gpu.getPreferredCanvasFormat() } };
  } catch (err) {
    return { ok: false, reason: `Requesting the GPU device failed: ${String(err)}` };
  }
}
