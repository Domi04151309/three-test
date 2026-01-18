import * as THREE from 'three';
import { NoiseGenerator } from './noise';
import { fragmentShader, vertexShader } from './terrain-shaders';

export function smoothStep(value: number, edgeLo: number, edgeHi: number) {
  const tval = Math.max(
    0,
    Math.min(1, (value - edgeLo) / (edgeHi - edgeLo || 1)),
  );
  return tval * tval * (3 - 2 * tval);
}

export function createNoiseMaterial(waterLevel: number) {
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

  const baseUniforms = {
    noiseTex: { value: noiseTex },
    grassTex: { value: null },
    dirtTex: { value: null },
    rockTex: { value: null },
    sandTex: { value: null },
    snowTex: { value: null },
    grassColor: { value: new THREE.Color('hsl(80, 100%, 15%)') },
    dirtColor: { value: new THREE.Color('hsl(35, 30%, 30%)') },
    rockColor: { value: new THREE.Color('hsl(20, 0%, 40%)') },
    sandColor: { value: new THREE.Color('hsl(40, 70%, 80%)') },
    snowColor: { value: new THREE.Color('hsl(0, 0%, 95%)') },
    // Lighting uniforms (defaults)
    sunDirection: { value: new THREE.Vector3(0.5, 0.5, 0.2) },
    lightColor: { value: new THREE.Color('#ffffff') },
    sunIntensity: { value: 1 },
    ambientIntensity: { value: 0.5 },
    noiseScale: { value: 0.02 },
    noiseAmp: { value: 0.6 },
    slopeHigh: { value: 0.5 },
    slopeLow: { value: 0.5 },
    heightRockStart: { value: 5 },
    heightRockEnd: { value: 25 },
    waterLevel: { value: waterLevel + 8 },
    snowLevel: { value: 256 },
  } as { [key: string]: { value: unknown } };

  const loader = new THREE.TextureLoader();
  const grassTex = loader.load('faithful/block/grass_block_top.png');
  const dirtTex = loader.load('faithful/block/dirt.png');
  const rockTex = loader.load('faithful/block/stone.png');
  const sandTex = loader.load('faithful/block/sand.png');
  const snowTex = loader.load('faithful/block/snow.png');
  for (const texture of [grassTex, dirtTex, rockTex, sandTex, snowTex]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.repeat.set(1, 1);
    texture.needsUpdate = true;
  }
  baseUniforms.grassTex.value = grassTex;
  baseUniforms.dirtTex.value = dirtTex;
  baseUniforms.rockTex.value = rockTex;
  baseUniforms.sandTex.value = sandTex;
  baseUniforms.snowTex.value = snowTex;

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    baseUniforms,
  ]);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    fog: true,
  });

  return material;
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
