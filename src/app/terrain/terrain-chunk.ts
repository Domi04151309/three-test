import * as THREE from 'three';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
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
}

const modifier = new SimplifyModifier();

export class TerrainChunk {
  public mesh: THREE.Mesh;
  public lod: THREE.LOD;
  public heightData: Float32Array;
  public width: number;
  public depth: number;
  public offsetX: number;
  public offsetZ: number;
  public grass: Grass;
  public objects: THREE.Object3D[];

  constructor(entry: ChunkEntry) {
    this.mesh = entry.mesh;

    // Wrap the existing mesh in a THREE.LOD. Do not modify the mesh itself.
    this.lod = new THREE.LOD();
    this.lod.addLevel(this.mesh, 0);
    // Position the LOD at the chunk center and make the mesh local to it
    const meshWorldPos = this.mesh.position.clone();
    this.lod.position.copy(meshWorldPos);
    this.mesh.position.set(0, 0, 0);
    // Create additional simplified LOD levels from the original mesh using
    // SimplifyModifier. Keep the original mesh untouched.
    const posAttribute = this.mesh.geometry.attributes
      .position as THREE.BufferAttribute;
    const vertexCount = posAttribute.count;
    const lodRatios = [0.8, 0.6, 0.4, 0.2];
    const lodDistances = [160, 320, 480, 640];
    for (let li = 0; li < lodRatios.length; li += 1) {
      const ratio = lodRatios[li];
      const target = Math.floor(vertexCount * (1 - ratio));
      const simpleMesh = new THREE.Mesh(
        modifier.modify(this.mesh.geometry.clone(), target),
        this.mesh.material,
      );
      this.lod.addLevel(simpleMesh, lodDistances[li]);
    }

    this.heightData = entry.heightData;
    this.width = entry.width;
    this.depth = entry.depth;
    this.offsetX = entry.offsetX;
    this.offsetZ = entry.offsetZ;
    this.grass = entry.grass;
    this.objects = entry.objects;
  }

  addTo(parent: THREE.Group) {
    parent.add(this.grass.mesh);
    parent.add(this.lod);
    for (const object of this.objects) parent.add(object);
  }

  sampleCellHeight(ix: number, iz: number) {
    const lx = ix - this.offsetX;
    const lz = iz - this.offsetZ;
    if (lx < 0 || lz < 0 || lx >= this.width || lz >= this.depth) return 0;
    const index = lx + lz * this.width;
    return this.heightData[index] || 0;
  }

  update(camera: THREE.Camera) {
    // Update grass and other per-chunk items. Water is managed globally by SkyController.
    // Use camera world position for LOD checks — camera.position may be local.
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    this.grass.update(camPos);
    // Ensure this chunk's LOD updates itself.
    this.lod.update(camera);
    // Update any LOD objects in this chunk (including nested LODs)
    for (const object of this.objects)
      object.traverse((child) => {
        if (child instanceof THREE.LOD) child.update(camera);
      });
  }

  dispose(parent: THREE.Group) {
    parent.remove(this.lod);
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

    // Dispose any simplified LOD geometries (but not the original mesh geometry yet)
    const { levels } = this.lod;
    for (const lvl of levels) {
      const { object } = lvl;
      if (object === this.mesh) continue;
      if (object instanceof THREE.Mesh) {
        const maybeGeom = object.geometry;
        maybeGeom.dispose?.();
      }
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
