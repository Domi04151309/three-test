import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export interface ItemOptions {
  basePath: string;
  file: string;
  scale?: number;
  rotation?: THREE.Euler;
  position?: THREE.Vector3;
  material?: THREE.Material;
}

export class Item {
  protected group: THREE.Group | null = null;
  protected readonly options: ItemOptions;

  constructor(options: ItemOptions) {
    this.options = options;
  }

  static async createForHand(
    hand: THREE.Mesh,
    options: ItemOptions,
  ): Promise<Item> {
    const item = new Item(options);
    await item.load(hand);
    return item;
  }

  get object(): THREE.Object3D | null {
    return this.group;
  }

  protected async load(hand: THREE.Mesh): Promise<void> {
    const { basePath, file, material, rotation, position } = this.options;

    const group = await new Promise<THREE.Group>((resolve, reject) => {
      const loader = new OBJLoader();
      loader.setPath(basePath);
      loader.load(
        file,
        (object) => {
          const mat =
            material ??
            new THREE.MeshPhongMaterial({
              color: new THREE.Color('#c3c7c7'),
              specular: new THREE.Color('#ffffff'),
              shininess: 200,
            });

          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.computeVertexNormals();
              child.material = mat;
            }
          });

          resolve(object);
        },
        (event_) => event_,
        (error) => {
          reject(new Error(String(error)));
        },
      );
    });

    const scale = this.options.scale ?? 1;
    group.scale.setScalar(scale);

    if (rotation) group.rotation.copy(rotation);
    if (position) group.position.copy(position);

    hand.add(group);
    this.group = group;
  }
}
