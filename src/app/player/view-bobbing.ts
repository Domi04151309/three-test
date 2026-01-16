import * as THREE from 'three';
import { PlayerOptions } from './types';

export class ViewBobbing {
  private viewModel: THREE.Group;
  private basePos: THREE.Vector3;
  private baseRot: THREE.Euler;
  private options: PlayerOptions;
  private bobTime = 0;

  constructor(
    viewModel: THREE.Group,
    basePos: THREE.Vector3,
    baseRot: THREE.Euler,
    options: PlayerOptions,
  ) {
    this.viewModel = viewModel;
    this.basePos = basePos.clone();
    this.baseRot = baseRot.clone();
    this.options = options;
  }

  update(delta: number, isMoving: boolean): void {
    if (isMoving) {
      this.bobTime += delta * this.options.bobFreq;
      const bobY = Math.abs(Math.sin(this.bobTime)) * this.options.bobAmpY;
      const bobX = Math.sin(this.bobTime * 2) * this.options.bobAmpX;
      const rotZ = Math.sin(this.bobTime) * this.options.bobRotZ;

      this.viewModel.position.set(
        this.basePos.x + bobX,
        this.basePos.y - bobY,
        this.basePos.z,
      );
      this.viewModel.rotation.set(
        this.baseRot.x,
        this.baseRot.y,
        this.baseRot.z + rotZ,
      );
      return;
    }

    this.bobTime = 0;
    this.viewModel.position.lerp(this.basePos, Math.min(1, delta * 10));
    this.viewModel.rotation.x +=
      (this.baseRot.x - this.viewModel.rotation.x) * Math.min(1, delta * 10);
    this.viewModel.rotation.y +=
      (this.baseRot.y - this.viewModel.rotation.y) * Math.min(1, delta * 10);
    this.viewModel.rotation.z +=
      (this.baseRot.z - this.viewModel.rotation.z) * Math.min(1, delta * 10);
  }
}
