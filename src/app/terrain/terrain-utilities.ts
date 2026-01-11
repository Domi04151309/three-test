import * as THREE from 'three';
import { TerrainChunk } from './terrain-chunk';
import { NoiseGenerator } from './noise';

export function getChunkNormalArray(chunk: TerrainChunk) {
  const geom = chunk.mesh.geometry as unknown as {
    attributes?: { normal?: THREE.BufferAttribute };
  };
  const attribute = geom.attributes?.normal;
  if (!attribute) return null;
  return { array: attribute.array as Float32Array, attr: attribute };
}

export function mergeBorderNormals(options: {
  arrayA: Float32Array;
  attributeA: THREE.BufferAttribute;
  arrayB: Float32Array;
  attributeB: THREE.BufferAttribute;
  cw: number;
  cd: number;
  orientation: 'x' | 'z';
}) {
  const { arrayA, attributeA, arrayB, attributeB, cw, cd, orientation } =
    options;
  if (orientation === 'x') {
    for (let lz = 0; lz < cd; lz += 1) {
      const ia = cw - 1 + lz * cw;
      const ib = 0 + lz * cw;
      const ax = arrayA[ia * 3];
      const ay = arrayA[ia * 3 + 1];
      const az = arrayA[ia * 3 + 2];
      const bx = arrayB[ib * 3];
      const by = arrayB[ib * 3 + 1];
      const bz = arrayB[ib * 3 + 2];
      const mx = (ax + bx) * 0.5;
      const my = (ay + by) * 0.5;
      const mz = (az + bz) * 0.5;
      arrayA[ia * 3] = mx;
      arrayA[ia * 3 + 1] = my;
      arrayA[ia * 3 + 2] = mz;
      arrayB[ib * 3] = mx;
      arrayB[ib * 3 + 1] = my;
      arrayB[ib * 3 + 2] = mz;
    }
  } else {
    for (let lx = 0; lx < cw; lx += 1) {
      const ia = lx + (cd - 1) * cw;
      const ib = lx + 0 * cw;
      const ax = arrayA[ia * 3];
      const ay = arrayA[ia * 3 + 1];
      const az = arrayA[ia * 3 + 2];
      const bx = arrayB[ib * 3];
      const by = arrayB[ib * 3 + 1];
      const bz = arrayB[ib * 3 + 2];
      const mx = (ax + bx) * 0.5;
      const my = (ay + by) * 0.5;
      const mz = (az + bz) * 0.5;
      arrayA[ia * 3] = mx;
      arrayA[ia * 3 + 1] = my;
      arrayA[ia * 3 + 2] = mz;
      arrayB[ib * 3] = mx;
      arrayB[ib * 3 + 1] = my;
      arrayB[ib * 3 + 2] = mz;
    }
  }
  attributeA.needsUpdate = true;
  attributeB.needsUpdate = true;
}

export function smoothStep(value: number, edgeLo: number, edgeHi: number) {
  const tval = Math.max(
    0,
    Math.min(1, (value - edgeLo) / (edgeHi - edgeLo || 1)),
  );
  return tval * tval * (3 - 2 * tval);
}

export function createNoiseMaterial() {
  const noiseSize = 256;
  const noiseData = new Uint8Array(noiseSize * noiseSize);
  for (let index = 0; index < noiseData.length; index += 1)
    noiseData[index] = Math.floor(Math.random() * 256);
  const noiseTex = new THREE.DataTexture(
    noiseData,
    noiseSize,
    noiseSize,
    THREE.RedFormat,
  );
  noiseTex.wrapS = THREE.RepeatWrapping;
  noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.minFilter = THREE.LinearFilter;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.repeat.set(8, 8);
  noiseTex.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    bumpMap: noiseTex,
    bumpScale: 2,
    color: new THREE.Color('#ffffff'),
    envMapIntensity: 0,
    metalness: 0,
    roughness: 1,
    specularColor: new THREE.Color('#000000'),
    specularIntensity: 0,
    vertexColors: true,
  });
}

export function buildGeometry(options: {
  cw: number;
  cd: number;
  offsetX: number;
  offsetZ: number;
  heightData: Float32Array;
  cellSize: number;
  heightScale: number;
}) {
  const { cw, cd, offsetX, offsetZ, heightData, cellSize, heightScale } =
    options;
  const chunkPlaneWidth = (cw - 1) * cellSize;
  const chunkPlaneDepth = (cd - 1) * cellSize;
  const geometry = new THREE.PlaneGeometry(
    chunkPlaneWidth,
    chunkPlaneDepth,
    cw - 1,
    cd - 1,
  );
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array as Float32Array;
  for (let vi = 0, si = 0; vi < vertices.length; vi += 3, si += 1)
    vertices[vi + 1] = heightData[si] * heightScale;

  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  const normalAttribute = geometry.attributes.normal as
    | THREE.BufferAttribute
    | undefined;
  if (normalAttribute) normalAttribute.needsUpdate = true;

  const centerX = (offsetX + (cw - 1) / 2) * cellSize;
  const centerZ = (offsetZ + (cd - 1) / 2) * cellSize;
  return { geometry, centerX, centerZ, chunkPlaneWidth, chunkPlaneDepth };
}

export function colorGeometry(options: {
  geometry: THREE.BufferGeometry;
  centerX: number;
  centerZ: number;
  cellSize: number;
  waterLevel: number;
  seed: number;
  noiseGenerator: NoiseGenerator;
}) {
  const {
    geometry,
    centerX,
    centerZ,
    cellSize,
    waterLevel,
    seed,
    noiseGenerator,
  } = options;
  const pos = geometry.attributes.position.array as Float32Array;
  const vertCount = pos.length / 3;
  const colors = new Float32Array(vertCount * 3);
  const sand = new THREE.Color('hsl(40, 44%, 70%)');
  const grassColor = new THREE.Color('hsl(80, 40%, 15%)');
  const cutoff = waterLevel + 8;
  const fuzz = 6;
  const fuzzHalf = fuzz * 0.5;
  const noiseAmp = 4;
  const noiseOptions = {
    lacunarity: 2,
    octaves: 3,
    offsetZ: seed + 1024,
    persistence: 0.5,
    scale: 0.02,
  } as const;
  const temporary = new THREE.Color();
  for (let vi = 0; vi < vertCount; vi += 1) {
    const y = pos[vi * 3 + 1];
    const localX = pos[vi * 3 + 0];
    const localZ = pos[vi * 3 + 2];
    const worldX = centerX + localX;
    const worldZ = centerZ + localZ;
    const sx = worldX / cellSize;
    const sz = worldZ / cellSize;
    const noiseValue = noiseGenerator.sampleOctaves(sx, sz, noiseOptions);
    const localCutoff = cutoff + noiseValue * noiseAmp;
    const blend = smoothStep(y, localCutoff - fuzzHalf, localCutoff + fuzzHalf);
    temporary.lerpColors(sand, grassColor, blend);
    colors[vi * 3] = temporary.r;
    colors[vi * 3 + 1] = temporary.g;
    colors[vi * 3 + 2] = temporary.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, false));
}

export function computeNoiseRanges(
  noiseGenerator: NoiseGenerator,
  width: number,
  depth: number,
  options: {
    lacunarity: number;
    hillOctaves: number;
    detailOctaves: number;
    seed: number;
    hillPersistence: number;
    detailPersistence: number;
    hillNoiseScale: number;
    detailNoiseScale: number;
  },
) {
  let hillMin = Infinity;
  let hillMax = -Infinity;
  let detailMin = Infinity;
  let detailMax = -Infinity;
  const startX = -Math.floor(width / 2);
  const startY = -Math.floor(depth / 2);

  for (let dz = 0; dz < depth; dz += 1) {
    const y = startY + dz;
    for (let dx = 0; dx < width; dx += 1) {
      const x = startX + dx;

      const hValue = noiseGenerator.sampleOctaves(x, y, {
        lacunarity: options.lacunarity,
        octaves: options.hillOctaves,
        offsetZ: options.seed,
        persistence: options.hillPersistence,
        scale: options.hillNoiseScale,
      });

      const dValue = noiseGenerator.sampleOctaves(x, y, {
        lacunarity: options.lacunarity,
        octaves: options.detailOctaves,
        offsetZ: options.seed + 512,
        persistence: options.detailPersistence,
        scale: options.detailNoiseScale,
      });

      if (hValue < hillMin) hillMin = hValue;
      if (hValue > hillMax) hillMax = hValue;
      if (dValue < detailMin) detailMin = dValue;
      if (dValue > detailMax) detailMax = dValue;
    }
  }

  return { detailMax, detailMin, hillMax, hillMin };
}

export function makeKey(cx: number, cz: number) {
  return [cx, cz].join(',');
}
