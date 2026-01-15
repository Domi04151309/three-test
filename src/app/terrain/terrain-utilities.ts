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

  const vertexShader = `
    varying vec3 vWorldPos;
    varying float vNormalY;
    #include <fog_pars_vertex>
    void main() {
      vNormalY = normalize(mat3(modelMatrix) * normal).y;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

  const fragmentShader = `
    precision lowp float;
    varying vec3 vWorldPos;
    varying float vNormalY;
    #include <fog_pars_fragment>
    uniform sampler2D noiseTex;
    uniform sampler2D grassTex;
    uniform sampler2D dirtTex;
    uniform sampler2D rockTex;
    uniform sampler2D sandTex;
    uniform sampler2D snowTex;
    uniform vec3 grassColor;
    uniform vec3 dirtColor;
    uniform vec3 rockColor;
    uniform float noiseScale;
    uniform float noiseAmp;
    uniform float slopeHigh;
    uniform float slopeLow;
    uniform float heightRockStart;
    uniform float heightRockEnd;
    uniform float waterLevel;
    uniform vec3 sandColor;
    uniform float snowLevel;
    uniform vec3 snowColor;

    void main() {
      vec2 nUv = vWorldPos.xz * noiseScale;
      float n = texture2D(noiseTex, fract(nUv)).r;
      float h = vWorldPos.y + (n - 0.5) * noiseAmp;

      float slope = 1.0 - vNormalY;
      float rockFactor = smoothstep(slopeLow, 1.0, slope);
      float grassFactor = smoothstep(slopeHigh, 1.0, vNormalY);
      float dirtFactor = 1.0 - clamp(rockFactor + grassFactor, 0.0, 1.0);

      float heightBias = smoothstep(heightRockStart, heightRockEnd, h);
      rockFactor = clamp(rockFactor + heightBias * 0.6, 0.0, 1.0);

      float noiseInfluence = (n - 0.5) * noiseAmp;
      rockFactor = clamp(rockFactor + noiseInfluence * 0.5, 0.0, 1.0);
      grassFactor = clamp(grassFactor - noiseInfluence * 0.5, 0.0, 1.0);
      dirtFactor = 1.0 - clamp(rockFactor + grassFactor, 0.0, 1.0);
      float isUnder = h < waterLevel ? 1.0 : 0.0;
      vec3 grainGrass = mix(grassColor, sandColor, isUnder);
      grainGrass = mix(grainGrass, snowColor, step(snowLevel, h));

      vec3 col = rockFactor * rockColor + dirtFactor * dirtColor + grassFactor * grainGrass;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `;

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
    sandColor: { value: new THREE.Color('hsl(40, 44%, 70%)') },
    snowColor: { value: new THREE.Color('hsl(0, 0%, 95%)') },
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
  const grassTex = loader.load(
    '/src/assets/faithful/block/grass_block_top.png',
  );
  const dirtTex = loader.load('/src/assets/faithful/block/dirt.png');
  const rockTex = loader.load('/src/assets/faithful/block/stone.png');
  const sandTex = loader.load('/src/assets/faithful/block/sand.png');
  const snowTex = loader.load('/src/assets/faithful/block/snow.png');
  for (const texture of [grassTex, dirtTex, rockTex, sandTex, snowTex]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.repeat.set(4, 4);
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
