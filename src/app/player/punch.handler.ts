import * as THREE from 'three';
import { PlayerOptions } from './player.types';

export class PunchHandler {
  private rightHand: THREE.Mesh;
  private basePos: THREE.Vector3;
  private baseRot: THREE.Euler;
  private options: PlayerOptions;
  private isPunching = false;
  private punchTime = 0;

  constructor(
    rightHand: THREE.Mesh,
    basePos: THREE.Vector3,
    baseRot: THREE.Euler,
    options: PlayerOptions,
  ) {
    this.rightHand = rightHand;
    this.basePos = basePos.clone();
    this.baseRot = baseRot.clone();
    this.options = options;
    this.rightHand.position.copy(this.basePos);
    this.rightHand.rotation.copy(this.baseRot);
  }

  startPunch(): void {
    if (this.isPunching) return;
    this.isPunching = true;
    this.punchTime = 0;
  }

  update(delta: number): void {
    if (this.isPunching) {
      this.punchTime += delta;
      const time = Math.min(1, this.punchTime / this.options.punchDuration);
      const swingProgress = Math.sin(time * Math.PI);

      this.rightHand.position.set(
        this.basePos.x + this.options.swingPosOffset.x * swingProgress,
        this.basePos.y + this.options.swingPosOffset.y * swingProgress,
        this.basePos.z + this.options.swingPosOffset.z * swingProgress,
      );

      this.rightHand.rotation.x =
        this.baseRot.x + this.options.swingRotOffset.x * swingProgress;
      this.rightHand.rotation.y =
        this.baseRot.y + this.options.swingRotOffset.y * swingProgress;
      this.rightHand.rotation.z =
        this.baseRot.z + this.options.swingRotOffset.z * swingProgress;

      if (time >= 1) {
        this.isPunching = false;
        this.rightHand.position.copy(this.basePos);
        this.rightHand.rotation.copy(this.baseRot);
      }
    } else {
      this.rightHand.position.lerp(this.basePos, Math.min(1, delta * 10));
      this.rightHand.rotation.x +=
        (this.baseRot.x - this.rightHand.rotation.x) * Math.min(1, delta * 10);
      this.rightHand.rotation.y +=
        (this.baseRot.y - this.rightHand.rotation.y) * Math.min(1, delta * 10);
      this.rightHand.rotation.z +=
        (this.baseRot.z - this.rightHand.rotation.z) * Math.min(1, delta * 10);
    }
  }
}
