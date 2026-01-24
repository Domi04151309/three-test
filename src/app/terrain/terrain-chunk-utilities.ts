import * as THREE from 'three';
import { Grass } from './grass/grass';
import { NoiseGenerator } from './noise';
import { Daisy } from './flowers/daisy';
import { AnemoneFlower } from './flowers/anemone-flower';
import { CrocusFlower } from './flowers/crocus-flower';
import { DaffodilFlower } from './flowers/daffodil-flower';
import { DandelionFlower } from './flowers/dandelion-flower';
import { SnowdropFlower } from './flowers/snowdrop-flower';
import { Rock } from './flowers/rock';
import { TerrainOptions } from './terrain-options';

export function makeSampleFromHeightData(options: {
  heightData: Float32Array;
  cw: number;
  cd: number;
  offsetX: number;
  offsetZ: number;
  cellSize: number;
  heightScale: number;
}) {
  const { heightData, cw, cd, offsetX, offsetZ, cellSize, heightScale } =
    options;

  return (x: number, z: number) => {
    const fx = x / cellSize;
    const fz = z / cellSize;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const lx = ix - offsetX;
    const lz = iz - offsetZ;
    if (lx < 0 || lz < 0 || lx + 1 >= cw || lz + 1 >= cd) return 0;
    const index11 = lx + lz * cw;
    const index21 = lx + 1 + lz * cw;
    const index12 = lx + (lz + 1) * cw;
    const index22 = lx + 1 + (lz + 1) * cw;
    const h11 = heightData[index11] || 0;
    const h21 = heightData[index21] || 0;
    const h12 = heightData[index12] || 0;
    const h22 = heightData[index22] || 0;
    const h1 = h11 * (1 - tx) + h21 * tx;
    const h2 = h12 * (1 - tx) + h22 * tx;
    return (h1 * (1 - tz) + h2 * tz) * heightScale;
  };
}

export function createGrassForChunk(
  options: TerrainOptions & {
    centerX: number;
    centerZ: number;
    sample: (x: number, z: number) => number;
    width: number;
  },
) {
  return new Grass({
    bladeCount: 100_000,
    centerX: options.centerX,
    centerZ: options.centerZ,
    sampleHeight: options.sample,
    waterLevel: options.waterLevel,
    width: options.width,
  });
}

export function generateTreesForChunk(
  options: TerrainOptions & {
    baseOakTrees: THREE.LOD[];
    baseAspenTrees: THREE.LOD[];
    basePineTrees: THREE.LOD[];
    centerX: number;
    centerZ: number;
    chunkPlaneWidth: number;
    chunkPlaneDepth: number;
    sampleFromHeightData: (x: number, z: number) => number;
    noiseGenerator: NoiseGenerator;
  },
) {
  const objects: THREE.Object3D[] = [];
  const totalPrototypes =
    options.baseOakTrees.length +
    options.baseAspenTrees.length +
    options.basePineTrees.length;
  if (totalPrototypes === 0) return objects;

  const tx = options.centerX / options.cellSize;
  const tz = options.centerZ / options.cellSize;
  const treeNoiseOptions = {
    lacunarity: options.lacunarity,
    octaves: options.treeNoiseOctaves,
    persistence: options.treeNoisePersistence,
    scale: options.treeNoiseScale,
  } as const;

  const tRaw = options.noiseGenerator.sampleOctaves(tx, tz, {
    ...treeNoiseOptions,
    offsetZ: options.seed + 2048,
  });
  let amp = 1;
  let ampSum = 0;
  for (let index = 0; index < options.treeNoiseOctaves; index += 1) {
    ampSum += amp;
    amp *= options.treeNoisePersistence;
  }
  const densityNormalized = Math.max(
    0,
    Math.min(1, (tRaw / (ampSum || 1) + 1) * 0.5),
  );
  let treeCount = 0;
  const treeHighThreshold = 0.5;
  if (densityNormalized > treeHighThreshold)
    treeCount = Math.floor(options.maxTreesPerChunk);

  const margin = options.cellSize;
  for (let ti = 0; ti < treeCount; ti += 1) {
    const rx =
      Math.random() * (options.chunkPlaneWidth - margin * 2) -
      (options.chunkPlaneWidth / 2 - margin);
    const rz =
      Math.random() * (options.chunkPlaneDepth - margin * 2) -
      (options.chunkPlaneDepth / 2 - margin);
    const worldX = options.centerX + rx;
    const worldZ = options.centerZ + rz;
    const y = options.sampleFromHeightData(worldX, worldZ);
    if (y <= options.waterLevel + 12) continue;
    if (y >= 240) continue;

    // Per-tree species decision using local noise channels
    const px = worldX / options.cellSize;
    const pz = worldZ / options.cellSize;
    const pineScore = options.noiseGenerator.sampleOctaves(px, pz, {
      ...treeNoiseOptions,
      offsetZ: options.seed + 9000,
    });
    const aspenScore = options.noiseGenerator.sampleOctaves(px, pz, {
      ...treeNoiseOptions,
      offsetZ: options.seed + 10_000,
    });
    const oakScore = options.noiseGenerator.sampleOctaves(px, pz, {
      ...treeNoiseOptions,
      offsetZ: options.seed + 11_000,
    });
    const speciesScores = [pineScore, aspenScore, oakScore];
    const speciesIndex = speciesScores.indexOf(Math.max(...speciesScores));

    // Select a prototype from the chosen species, falling back if empty
    let chosenArray: THREE.LOD[] = options.baseOakTrees;
    if (speciesIndex === 0) chosenArray = options.basePineTrees;
    else if (speciesIndex === 1) chosenArray = options.baseAspenTrees;

    if (chosenArray.length === 0) {
      if (options.baseOakTrees.length > 0) chosenArray = options.baseOakTrees;
      else if (options.baseAspenTrees.length > 0)
        chosenArray = options.baseAspenTrees;
      else chosenArray = options.basePineTrees;
    }

    const pickIndex =
      Math.floor(Math.random() * chosenArray.length) % chosenArray.length;
    const prototype = chosenArray[pickIndex];
    const treeClone = prototype.clone(true);
    const scaleFactor = 0.6 + Math.random();
    treeClone.scale.set(scaleFactor, scaleFactor, scaleFactor);
    treeClone.position.set(worldX, y - 1, worldZ);
    objects.push(treeClone);
  }
  return objects;
}

export function generateFlowersForChunk(
  options: TerrainOptions & {
    centerX: number;
    centerZ: number;
    chunkPlaneWidth: number;
    chunkPlaneDepth: number;
    sampleFromHeightData: (x: number, z: number) => number;
    noiseGenerator: NoiseGenerator;
  },
) {
  const objects: THREE.Object3D[] = [];
  const flowerNoiseOptions = {
    lacunarity: 2,
    octaves: 2,
    offsetZ: options.seed + 4096,
    persistence: 0.5,
    scale: options.flowerNoiseScale,
  } as const;
  const fRaw = options.noiseGenerator.sampleOctaves(
    options.centerX / options.cellSize,
    options.centerZ / options.cellSize,
    flowerNoiseOptions,
  );
  const ampSum = 1 + 0.5;
  const density = Math.max(0, Math.min(1, (fRaw / ampSum + 1) * 0.5));
  const flowersCount = Math.floor(density * options.maxDaisiesPerChunk);
  const flowerMargin = options.cellSize * 0.5;
  const flowerConstructors: Array<new (s: number) => THREE.Object3D> = [
    Daisy,
    AnemoneFlower,
    CrocusFlower,
    DaffodilFlower,
    DandelionFlower,
    SnowdropFlower,
    Rock,
  ];
  for (let fi = 0; fi < flowersCount; fi += 1) {
    const rx =
      Math.random() * (options.chunkPlaneWidth - flowerMargin * 2) -
      (options.chunkPlaneWidth / 2 - flowerMargin);
    const rz =
      Math.random() * (options.chunkPlaneDepth - flowerMargin * 2) -
      (options.chunkPlaneDepth / 2 - flowerMargin);
    const worldX = options.centerX + rx;
    const worldZ = options.centerZ + rz;
    const y = options.sampleFromHeightData(worldX, worldZ);
    if (y <= options.waterLevel + 12) continue;
    const hNeighbor = options.sampleFromHeightData(
      worldX + options.cellSize,
      worldZ,
    );
    const slope = Math.abs(hNeighbor - y) / options.cellSize;
    if (slope > 0.6) continue;
    const scaleFactor = 0.8 + Math.random() * 0.4;
    const pickIndex = Math.floor(Math.random() * flowerConstructors.length);
    const ChosenFlower = flowerConstructors[pickIndex];
    const flowerObject: THREE.Object3D = new ChosenFlower(scaleFactor);
    flowerObject.position.set(worldX, y, worldZ);
    objects.push(flowerObject);
  }
  return objects;
}
