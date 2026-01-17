import * as THREE from 'three';
import { TerrainChunk } from './terrain-chunk';
import { Grass } from './grass/grass';
import { NoiseGenerator } from './noise';
import { SkyController } from '../sky/sky';
import { createChunkEntry, NoiseRanges } from './terrain-chunk-factory';
import { computeNoiseRanges, makeKey } from './terrain-utilities';
import { terrainOptions, TerrainOptions } from './terrain-options';
import { Tree, TreePreset } from './tree';

export class Terrain extends THREE.Group {
  private options: TerrainOptions = terrainOptions;
  private lastChunkX?: number;
  private lastChunkZ?: number;
  private chunks: Map<string, TerrainChunk> = new Map();
  private noiseRanges: {
    hillMin: number;
    hillMax: number;
    detailMin: number;
    detailMax: number;
  };
  private noiseGenerator: NoiseGenerator;
  private skyController: SkyController;
  private baseOakTrees: THREE.LOD[] = [];
  private baseAspenTrees: THREE.LOD[] = [];
  private basePineTrees: THREE.LOD[] = [];

  constructor(skyController: SkyController) {
    super();
    this.skyController = skyController;
    this.noiseGenerator = new NoiseGenerator();
    // Pre-generate a small pool of tree prototypes to clone per-chunk
    for (let index = 0; index < this.options.treePoolSize / 2; index += 1) {
      for (const type of ['Oak Medium', 'Oak Large'] as TreePreset[]) {
        this.baseOakTrees.push(Tree.create(type));
      }
      for (const type of ['Aspen Medium', 'Aspen Large'] as TreePreset[]) {
        this.baseAspenTrees.push(Tree.create(type));
      }
      for (const type of ['Pine Medium', 'Pine Large'] as TreePreset[]) {
        this.basePineTrees.push(Tree.create(type));
      }
    }
    const sampleChunks = 4;
    this.noiseRanges = computeNoiseRanges(
      this.noiseGenerator,
      this.options.chunkSize * sampleChunks,
      this.options.chunkSize * sampleChunks,
      {
        lacunarity: this.options.lacunarity,
        hillOctaves: this.options.hillOctaves,
        detailOctaves: this.options.detailOctaves,
        seed: this.options.seed,
        hillPersistence: this.options.hillPersistence,
        detailPersistence: this.options.detailPersistence,
        hillNoiseScale: this.options.hillNoiseScale,
        detailNoiseScale: this.options.detailNoiseScale,
      },
    );

    // Load an initial area around origin (player at 0,0)
    this.updateChunks(0, 0);
  }

  private sampleCellHeight(ix: number, iz: number) {
    // Compute the chunk coordinates directly and perform a keyed lookup
    const cx = Math.floor(ix / this.options.chunkSize);
    const cz = Math.floor(iz / this.options.chunkSize);
    const key = makeKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;
    return chunk.sampleCellHeight(ix, iz);
  }

  private createChunk(cx: number, cz: number) {
    const parameters: TerrainOptions & {
      noiseGenerator: NoiseGenerator;
      noiseRanges: NoiseRanges;
      baseOakTrees: THREE.LOD[];
      baseAspenTrees: THREE.LOD[];
      basePineTrees: THREE.LOD[];
    } = {
      ...this.options,
      noiseGenerator: this.noiseGenerator,
      noiseRanges: this.noiseRanges as NoiseRanges,
      baseOakTrees: this.baseOakTrees,
      baseAspenTrees: this.baseAspenTrees,
      basePineTrees: this.basePineTrees,
    };

    const entry = createChunkEntry(cx, cz, parameters);
    const key = makeKey(cx, cz);
    const chunk = new TerrainChunk(entry);
    chunk.addTo(this);
    this.chunks.set(key, chunk);
  }

  private disposeChunk(cx: number, cz: number) {
    const key = makeKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    chunk.dispose(this);
    this.chunks.delete(key);
  }

  public updateChunks(playerX: number, playerZ: number) {
    // Map world coordinates to grid cell coordinates (cell size units)
    const gx = playerX / this.options.cellSize;
    const gz = playerZ / this.options.cellSize;
    const centerCX = Math.floor(gx / this.options.chunkSize);
    const centerCZ = Math.floor(gz / this.options.chunkSize);

    const wanted = new Set<string>();
    const side = this.options.chunkRadius * 2 + 1;
    const total = side * side;
    for (let index = 0; index < total; index += 1) {
      const dx = (index % side) - this.options.chunkRadius;
      const dz = Math.floor(index / side) - this.options.chunkRadius;
      const cx = centerCX + dx;
      const cz = centerCZ + dz;
      const key = makeKey(cx, cz);
      wanted.add(key);
      if (!this.chunks.has(key)) this.createChunk(cx, cz);
    }

    // Dispose chunks not wanted
    for (const key of this.chunks.keys())
      if (!wanted.has(key)) {
        const [sx, sz] = key.split(',').map(Number);
        this.disposeChunk(sx, sz);
      }
  }

  public updatePlayerPosition(position: THREE.Vector3) {
    const gx = position.x / this.options.cellSize;
    const gz = position.z / this.options.cellSize;
    const cx = Math.floor(gx / this.options.chunkSize);
    const cz = Math.floor(gz / this.options.chunkSize);
    if (this.lastChunkX !== cx || this.lastChunkZ !== cz) {
      this.lastChunkX = cx;
      this.lastChunkZ = cz;
      this.updateChunks(position.x, position.z);
    }
  }

  public getHeightAt(x: number, z: number) {
    // Map world coordinates to grid cell coordinates
    const fx = x / this.options.cellSize;
    const fz = z / this.options.cellSize;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    // Do not clamp indices; streaming supports chunks beyond original world bounds.
    const ix1 = ix;
    const iz1 = iz;
    const ix2 = ix + 1;
    const iz2 = iz + 1;

    const h11 = this.sampleCellHeight(ix1, iz1) * this.options.heightScale;
    const h21 = this.sampleCellHeight(ix2, iz1) * this.options.heightScale;
    const h12 = this.sampleCellHeight(ix1, iz2) * this.options.heightScale;
    const h22 = this.sampleCellHeight(ix2, iz2) * this.options.heightScale;

    const h1 = h11 * (1 - tx) + h21 * tx;
    const h2 = h12 * (1 - tx) + h22 * tx;
    return h1 * (1 - tz) + h2 * tz;
  }

  update(camera: THREE.Camera, delta: number): void {
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    Grass.updateGlobalUniforms(delta, camPos, this.skyController);
    // Propagate sun/ambient into terrain chunk materials
    const sunDirection = this.skyController.sun.clone().normalize();
    const sunIntensity = this.skyController.getSunIntensity();
    const ambientIntensity = this.skyController.getAmbientIntensity();
    for (const ch of this.chunks.values()) {
      // Update the chunk material uniforms if present
      const mat = ch.mesh.material as THREE.ShaderMaterial | THREE.Material;
      const uniforms = (mat as THREE.ShaderMaterial).uniforms as Record<
        string,
        { value: unknown }
      >;
      (uniforms.sunDirection.value as THREE.Vector3).copy(sunDirection);
      (uniforms.sunIntensity.value as number) = sunIntensity;
      (uniforms.ambientIntensity.value as number) = ambientIntensity * 0.1;

      ch.update(camera);
    }
  }

  public getMapObjects(): Array<{
    x: number;
    y: number;
    z: number;
    type: 'tree' | 'flower';
  }> {
    const out: Array<{
      x: number;
      y: number;
      z: number;
      type: 'tree' | 'flower';
    }> = [];
    for (const chunk of this.chunks.values()) {
      for (const object of chunk.objects) {
        const pos = object.position;
        const type = object instanceof THREE.LOD ? 'tree' : 'flower';
        out.push({ x: pos.x, y: pos.y, z: pos.z, type });
      }
    }
    return out;
  }
}
