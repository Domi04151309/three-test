import * as THREE from 'three';
import { Item, ItemOptions } from './item';

export class Pickaxe extends Item {
  constructor() {
    const options: ItemOptions = {
      basePath: 'models/pickaxe/',
      objectFile: 'pickaxe.obj',
      mtlFile: 'pickaxe.mtl',
      scale: 0.2,
      rotation: new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0),
      previewRotation: new THREE.Euler(0, 0, -Math.PI / 2),
      previewOffset: new THREE.Vector3(-0.2, 0, 0),
      position: new THREE.Vector3(0, 1, 0.6),
    };
    super(options);
  }

  static async create(): Promise<Pickaxe> {
    const pickaxe = new Pickaxe();
    await pickaxe.load();
    return pickaxe;
  }
}
