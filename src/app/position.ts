import * as THREE from 'three';

export class PositionDisplay {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'coords';
    this.element.classList.add('card');
    this.element.textContent = 'x:0 y:0 z:0';
    document.body.append(this.element);
  }

  update(pos: THREE.Vector3): void {
    this.element.textContent = `x: ${pos.x.toFixed(0)} y: ${pos.y.toFixed(0)} z: ${pos.z.toFixed(0)}`;
  }
}
