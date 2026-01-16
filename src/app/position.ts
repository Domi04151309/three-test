import * as THREE from 'three';

export class PositionDisplay {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'coords';
    this.el.textContent = 'x:0.00 y:0.00 z:0.00';
    document.body.appendChild(this.el);
  }

  update(pos: THREE.Vector3): void {
    this.el.textContent = `x:${pos.x.toFixed(2)} y:${pos.y.toFixed(2)} z:${pos.z.toFixed(2)}`;
  }
}

export default PositionDisplay;
