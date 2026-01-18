import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/Addons.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export interface ItemOptions {
  basePath: string;
  objectFile: string;
  mtlFile: string;
  scale?: number;
  rotation?: THREE.Euler;
  previewRotation?: THREE.Euler;
  previewOffset?: THREE.Vector3;
  position?: THREE.Vector3;
  material?: THREE.Material;
}

export class Item {
  protected group: THREE.Group | null = null;
  protected readonly options: ItemOptions;

  constructor(options: ItemOptions) {
    this.options = options;
  }

  get object(): THREE.Object3D | null {
    return this.group;
  }

  get previewRotation(): THREE.Euler | undefined {
    return this.options.previewRotation;
  }

  get previewOffset(): THREE.Vector3 | undefined {
    return this.options.previewOffset;
  }

  protected async load(): Promise<void> {
    const { basePath, objectFile, mtlFile, rotation, position } = this.options;

    const group = await new Promise<THREE.Group>((resolve, reject) => {
      const mtlLoader = new MTLLoader();
      mtlLoader.setPath(basePath);
      mtlLoader.load(
        mtlFile,
        (materials) => {
          materials.preload();
          const objectLoader = new OBJLoader();
          objectLoader.setMaterials(materials);
          objectLoader.setPath(basePath);
          objectLoader.load(
            objectFile,
            (object) => {
              resolve(object);
            },
            (event_) => event_,
            (error) => {
              reject(new Error(String(error)));
            },
          );
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

    this.group = group;
  }
}
