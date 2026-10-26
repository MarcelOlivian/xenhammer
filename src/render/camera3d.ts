import { mat4 } from 'wgpu-matrix';

const UP = [0, 0, 1] as const;
const MAX_PITCH = Math.PI / 2 - 0.01;

/** Free-fly camera for the 3D view. Z is up; yaw 0 looks down +X. */
export class Camera3D {
  position: [number, number, number] = [-360, -300, 220];
  yaw = Math.atan2(300, 360);
  pitch = -0.44;
  /** Vertical field of view in radians. */
  fovY = (60 * Math.PI) / 180;

  forward(): [number, number, number] {
    const cp = Math.cos(this.pitch);
    return [cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), Math.sin(this.pitch)];
  }

  right(): [number, number, number] {
    return [Math.sin(this.yaw), -Math.cos(this.yaw), 0];
  }

  /** Mouselook by a delta in radians. */
  look(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, this.pitch + dPitch));
  }

  /** Moves along forward / right / world-up by the given world-unit amounts. */
  move(forward: number, right: number, up: number): void {
    const f = this.forward();
    const r = this.right();
    const p = this.position;
    this.position = [
      p[0] + f[0] * forward + r[0] * right,
      p[1] + f[1] * forward + r[1] * right,
      p[2] + f[2] * forward + r[2] * right + up,
    ];
  }

  viewProj(aspect: number, out = new Float32Array(16)): Float32Array {
    const f = this.forward();
    const p = this.position;
    const view = mat4.lookAt(p, [p[0] + f[0], p[1] + f[1], p[2] + f[2]], UP);
    const proj = mat4.perspective(this.fovY, aspect, 4, 32768);
    return mat4.multiply(proj, view, out);
  }
}
