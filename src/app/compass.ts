import * as THREE from 'three';

function degToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.floor(((deg + 22.5) % 360) / 45);
  return dirs[idx];
}

export class Compass {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'compass';
    this.element.textContent = 'N 0°';
    document.body.appendChild(this.element);
  }

  update(camera: THREE.Camera): void {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // Heading relative to world Z axis: atan2(x, z)
    const rad = Math.atan2(dir.x, dir.z);
    const deg = (rad * (180 / Math.PI) + 360) % 360;
    const card = degToCardinal(deg);
    this.element.textContent = `${card} ${Math.round(deg)}°`;
  }
}

export default Compass;
