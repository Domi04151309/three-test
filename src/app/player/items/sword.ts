import * as THREE from 'three';
import { Item, ItemOptions } from './item';

export class Sword extends Item {
  constructor() {
    const options: ItemOptions = {
      basePath: 'models/sword/',
      objectFile: 'sword.obj',
      mtlFile: 'sword.mtl',
      scale: 0.4,
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      position: new THREE.Vector3(0, -0.5, 0),
    };
    super(options);
  }

  static async create(): Promise<Sword> {
    const sword = new Sword();
    await sword.load();
    return sword;
  }
}
