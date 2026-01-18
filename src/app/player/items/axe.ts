import * as THREE from 'three';
import { Item, ItemOptions } from './item';

export class Axe extends Item {
  constructor() {
    const options: ItemOptions = {
      basePath: 'models/axe/',
      file: '12351_Axe_v3_l3.obj',
      scale: 0.1,
      rotation: new THREE.Euler(-Math.PI / 4, 0, -Math.PI / 2),
      position: new THREE.Vector3(0, 0, -0.5),
    };
    super(options);
  }

  static async create(): Promise<Axe> {
    const axe = new Axe();
    await axe.load();
    return axe;
  }
}
