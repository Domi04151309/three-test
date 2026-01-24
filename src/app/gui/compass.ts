import * as THREE from 'three';

function degToCardinal(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const id = Math.floor(((deg + 22.5) % 360) / 45);
  return directions[id];
}

export class Compass {
  private element: HTMLDivElement;
  private previousText: string = '';
  private direction: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'compass';
    this.element.classList.add('card');
    this.element.textContent = 'N 0°';
    document.body.append(this.element);
  }

  update(camera: THREE.Camera): void {
    const { direction, element, previousText } = this;
    camera.getWorldDirection(direction);
    // Heading relative to world Z axis: atan2(x, z)
    const rad = Math.atan2(direction.x, direction.z);
    const deg = (rad * (180 / Math.PI) + 360) % 360;
    const card = degToCardinal(deg);

    const text = `${card} ${Math.round(deg).toString()}°`;
    if (text !== previousText) {
      this.previousText = text;
      element.textContent = text;
    }
  }
}
