import * as THREE from 'three';

export class PositionDisplay {
  private element: HTMLDivElement;
  private previousText: string = '';

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'coords';
    this.element.classList.add('card');
    this.element.textContent = 'x:0 y:0 z:0';
    document.body.append(this.element);
  }

  update(pos: THREE.Vector3): void {
    const text = `x: ${pos.x.toFixed(0)} y: ${pos.y.toFixed(0)} z: ${pos.z.toFixed(0)}`;
    if (text !== this.previousText) {
      this.previousText = text;
      this.element.textContent = text;
    }
  }
}
