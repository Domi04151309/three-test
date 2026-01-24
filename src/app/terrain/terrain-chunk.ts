import * as THREE from 'three';
import { Grass } from './grass/grass';

export interface ChunkEntry {
  mesh: THREE.Mesh;
  heightData: Float32Array;
  width: number;
  depth: number;
  offsetX: number;
  offsetZ: number;
  grass: Grass;
  objects: THREE.Object3D[];
  lods?: THREE.LOD[];
}

export class TerrainChunk {
  public mesh: THREE.Mesh;
  public heightData: Float32Array;
  public width: number;
  public depth: number;
  public offsetX: number;
  public offsetZ: number;
  public grass: Grass;
  public objects: THREE.Object3D[];
  public lods: THREE.LOD[];
  public materialUniforms: Record<string, { value: unknown }> | null = null;

  constructor(entry: ChunkEntry) {
    this.mesh = entry.mesh;
    const matAny = this.mesh.material as unknown as {
      uniforms?: Record<string, { value: unknown }>;
    } | null;
    this.materialUniforms = matAny?.uniforms ?? null;
    this.heightData = entry.heightData;
    this.width = entry.width;
    this.depth = entry.depth;
    this.offsetX = entry.offsetX;
    this.offsetZ = entry.offsetZ;
    this.grass = entry.grass;
    this.objects = entry.objects;
    this.lods = entry.lods || [];
  }

  addTo(parent: THREE.Group) {
    parent.add(this.grass.mesh);
    parent.add(this.mesh);
    for (const object of this.objects) parent.add(object);
  }

  sampleCellHeight(ix: number, iz: number) {
    const lx = ix - this.offsetX;
    const lz = iz - this.offsetZ;
    if (lx < 0 || lz < 0 || lx >= this.width || lz >= this.depth) return 0;
    const index = lx + lz * this.width;
    return this.heightData[index] || 0;
  }

  update(cameraPos: THREE.Vector3, camera: THREE.Camera) {
    // Update grass and other per-chunk items. Water is managed globally by SkyController.
    // `cameraPos` is provided by the caller to avoid allocating per-chunk vectors.
    this.grass.update(cameraPos);
    // Update LODs directly (collected at creation) to avoid traversing all
    // Object hierarchies each frame.
    for (let index = 0; index < this.lods.length; index += 1) {
      this.lods[index].update(camera);
    }
  }

  dispose(parent: THREE.Group) {
    parent.remove(this.mesh);
    this.grass.dispose(parent);

    const disposeMaterial = (
      materialParameter: THREE.Material | THREE.Material[] | null | undefined,
    ) => {
      if (!materialParameter) return;
      if (Array.isArray(materialParameter)) {
        for (const item of materialParameter) {
          const maybeMap = (
            item as unknown as {
              map?: { dispose: () => void };
            }
          ).map;
          if (maybeMap && typeof maybeMap.dispose === 'function')
            maybeMap.dispose();
          item.dispose();
        }
        return;
      }
      const maybeMap = (
        materialParameter as unknown as {
          map?: { dispose: () => void };
        }
      ).map;
      if (maybeMap && typeof maybeMap.dispose === 'function')
        maybeMap.dispose();
      (materialParameter as unknown as { dispose?: () => void }).dispose?.();
    };

    for (const object of this.objects) {
      parent.remove(object);
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        // Skip disposing shared model resources (e.g., flower prototype assets)
        const { userData } = child as { userData?: Record<string, unknown> };
        const isShared = userData?.sharedModel === true;
        if (isShared) return;
        const meshObject = child as THREE.Mesh;
        meshObject.geometry.dispose();
        disposeMaterial(meshObject.material);
      });
    }

    const geom = this.mesh.geometry;
    const mat = this.mesh.material;
    if (Array.isArray(mat)) {
      for (let mi = 0; mi < mat.length; mi += 1) {
        const matItem = mat[mi];
        const maybeMap = (
          matItem as unknown as { map?: { dispose: () => void } }
        ).map;
        if (maybeMap && typeof maybeMap.dispose === 'function')
          maybeMap.dispose();
        matItem.dispose();
      }
    } else {
      const maybeMap = (mat as unknown as { map?: { dispose: () => void } })
        .map;
      if (maybeMap && typeof maybeMap.dispose === 'function')
        maybeMap.dispose();
      mat.dispose();
    }
    geom.dispose();
  }
}
