import * as THREE from 'three';
import type { SkyController } from '../sky/sky';

function smoothStep(value: number, edge0: number, edge1: number) {
  let tv = (value - edge0) / (edge1 - edge0 || 1);
  if (tv < 0) tv = 0;
  if (tv > 1) tv = 1;
  return tv * tv * (3 - 2 * tv);
}

// Port of the provided grass implementation adapted for the project's chunk API.
export class Grass {
  public mesh: THREE.LOD;
  private material: THREE.RawShaderMaterial;
  private geometry: THREE.InstancedBufferGeometry;
  private width: number;
  // Squared distance beyond which the mesh is fully hidden (no CPU/GPU work)
  private cullDistanceSq: number;
  // Global (shared) time for the grass shader. Updated once per-frame
  private static sharedTime = 0;

  private static baseGeometry: THREE.PlaneGeometry | null = null;
  private static farBaseGeometry: THREE.PlaneGeometry | null = null;
  private static crossBaseGeometry: THREE.BufferGeometry | null = null;
  private static createFarBase(bladeWidth: number, bladeHeight: number) {
    if (!Grass.farBaseGeometry) {
      Grass.farBaseGeometry = new THREE.PlaneGeometry(
        bladeWidth,
        bladeHeight,
        1,
        1,
      );
      Grass.farBaseGeometry.translate(0, bladeHeight / 2, 0);
      Grass.farBaseGeometry.computeVertexNormals();
    }
    return Grass.farBaseGeometry;
  }

  private static createCrossBase(bladeWidth: number, bladeHeight: number) {
    if (!Grass.crossBaseGeometry) {
      const g1 = new THREE.PlaneGeometry(
        bladeWidth * 2,
        bladeHeight * 0.5,
        1,
        1,
      );
      const g2 = new THREE.PlaneGeometry(
        bladeWidth * 2,
        bladeHeight * 0.5,
        1,
        1,
      );
      g1.rotateY(0);
      g2.rotateY(Math.PI / 2);
      const cross = new THREE.BufferGeometry();
      // Merge attributes from both planes by concatenating typed arrays
      const pos1 = g1.attributes.position.array as Float32Array;
      const pos2 = g2.attributes.position.array as Float32Array;
      const uv1 = g1.attributes.uv.array as Float32Array;
      const uv2 = g2.attributes.uv.array as Float32Array;
      const norm1 = g1.attributes.normal.array as Float32Array;
      const norm2 = g2.attributes.normal.array as Float32Array;
      const positions = new Float32Array(pos1.length + pos2.length);
      positions.set(pos1, 0);
      positions.set(pos2, pos1.length);
      const uvs = new Float32Array(uv1.length + uv2.length);
      uvs.set(uv1, 0);
      uvs.set(uv2, uv1.length);
      const normals = new Float32Array(norm1.length + norm2.length);
      normals.set(norm1, 0);
      normals.set(norm2, norm1.length);
      cross.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      cross.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      cross.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      // Build index for two separate quads (6 indices each)
      const indicesPerPlane = [0, 1, 2, 0, 2, 3];
      const indexArray = new Uint16Array(indicesPerPlane.length * 2);
      for (let index = 0; index < indicesPerPlane.length; index += 1)
        indexArray[index] = indicesPerPlane[index];
      for (let index = 0; index < indicesPerPlane.length; index += 1)
        indexArray[indicesPerPlane.length + index] = indicesPerPlane[index] + 4;
      cross.setIndex(new THREE.BufferAttribute(indexArray, 1));
      Grass.crossBaseGeometry = cross;
    }
    return Grass.crossBaseGeometry;
  }

  private static ensureSharedResources(
    bladeWidth: number,
    bladeHeight: number,
  ) {
    if (!Grass.sharedGrassTexture) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = '';
      const grassTex = loader.load(
        '/src/assets/models/grass/blade_diffuse.jpg',
      );
      grassTex.minFilter = THREE.LinearMipmapLinearFilter;
      grassTex.magFilter = THREE.LinearFilter;
      grassTex.anisotropy = 1;
      Grass.sharedGrassTexture = grassTex;
    }
    if (!Grass.sharedAlphaMap) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = '';
      const alphaTex = loader.load('/src/assets/models/grass/blade_alpha.jpg');
      alphaTex.minFilter = THREE.LinearMipmapLinearFilter;
      alphaTex.magFilter = THREE.LinearFilter;
      alphaTex.anisotropy = 1;
      alphaTex.generateMipmaps = true;
      Grass.sharedAlphaMap = alphaTex;
    }
    if (!Grass.baseGeometry) {
      Grass.baseGeometry = new THREE.PlaneGeometry(
        bladeWidth,
        bladeHeight,
        1,
        1,
      );
      Grass.baseGeometry.translate(0, bladeHeight / 2, 0);
      const vertex = new THREE.Vector3();
      const quaternion0 = new THREE.Quaternion();
      const quaternion1 = new THREE.Quaternion();
      let angle = 0.05;
      quaternion0.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      angle = 0.3;
      quaternion1.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
      quaternion0.multiply(quaternion1);
      angle = 0.1;
      quaternion1.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
      quaternion0.multiply(quaternion1);
      const quaternion2 = new THREE.Quaternion();
      for (
        let posIndex = 0;
        posIndex < Grass.baseGeometry.attributes.position.array.length;
        posIndex += 3
      ) {
        quaternion2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        vertex.x = Grass.baseGeometry.attributes.position.array[posIndex];
        vertex.y = Grass.baseGeometry.attributes.position.array[posIndex + 1];
        vertex.z = Grass.baseGeometry.attributes.position.array[posIndex + 2];
        const frac = vertex.y / bladeHeight;
        quaternion2.slerp(quaternion0, frac);
        vertex.applyQuaternion(quaternion2);
        Grass.baseGeometry.attributes.position.array[posIndex] = vertex.x;
        Grass.baseGeometry.attributes.position.array[posIndex + 1] = vertex.y;
        Grass.baseGeometry.attributes.position.array[posIndex + 2] = vertex.z;
      }
      Grass.baseGeometry.computeVertexNormals();
    }
  }

  private buildLod(options: {
    instancedGeometry: THREE.InstancedBufferGeometry;
    farBaseGeom: THREE.PlaneGeometry;
    crossBaseGeom: THREE.BufferGeometry;
    placedCount: number;
  }) {
    const { instancedGeometry, farBaseGeom, crossBaseGeom, placedCount } =
      options;
    const lod = new THREE.LOD();
    const nearMesh = new THREE.Mesh(instancedGeometry, this.material);
    nearMesh.castShadow = false;
    nearMesh.receiveShadow = false;
    lod.addLevel(nearMesh, 0);

    const farInst = new THREE.InstancedBufferGeometry();
    if (farBaseGeom.index) farInst.index = farBaseGeom.index;
    farInst.attributes.position = farBaseGeom.attributes.position;
    farInst.attributes.uv = farBaseGeom.attributes.uv;
    farInst.attributes.normal = farBaseGeom.attributes.normal;
    // Reuse the same instanced attributes created for the near geometry. Instead
    // Of allocating new InstancedBufferAttribute views, reference the existing
    // Attributes and bake a lower instance count for the far LOD.
    farInst.setAttribute('offset', instancedGeometry.getAttribute('offset'));
    farInst.setAttribute('scale', instancedGeometry.getAttribute('scale'));
    farInst.setAttribute(
      'halfRootAngle',
      instancedGeometry.getAttribute('halfRootAngle'),
    );
    farInst.setAttribute('index', instancedGeometry.getAttribute('index'));
    const farInstanceCount = Math.max(0, Math.floor(placedCount * 0.6));
    farInst.instanceCount = farInstanceCount;
    if (instancedGeometry.boundingSphere)
      farInst.boundingSphere = instancedGeometry.boundingSphere.clone();
    const farMesh = new THREE.Mesh(farInst, this.material);
    farMesh.castShadow = false;
    farMesh.receiveShadow = false;
    lod.addLevel(farMesh, 160);

    const crossInst = new THREE.InstancedBufferGeometry();
    if (crossBaseGeom.index)
      crossInst.index = crossBaseGeom.index as unknown as THREE.BufferAttribute;
    crossInst.attributes.position = crossBaseGeom.attributes
      .position as THREE.BufferAttribute;
    crossInst.attributes.uv = crossBaseGeom.attributes
      .uv as THREE.BufferAttribute;
    crossInst.attributes.normal = crossBaseGeom.attributes
      .normal as THREE.BufferAttribute;
    // Reuse instanced attributes for cross geometry. Reference the existing
    // Instanced attributes and bake a smaller instance count for the very-far
    // Cross quads.
    crossInst.setAttribute('offset', instancedGeometry.getAttribute('offset'));
    crossInst.setAttribute('scale', instancedGeometry.getAttribute('scale'));
    crossInst.setAttribute(
      'halfRootAngle',
      instancedGeometry.getAttribute('halfRootAngle'),
    );
    crossInst.setAttribute('index', instancedGeometry.getAttribute('index'));
    const crossInstanceCount = Math.max(0, Math.floor(placedCount * 0.25));
    crossInst.instanceCount = crossInstanceCount;
    if (instancedGeometry.boundingSphere)
      crossInst.boundingSphere = instancedGeometry.boundingSphere.clone();
    const crossMesh = new THREE.Mesh(crossInst, this.material);
    crossMesh.castShadow = false;
    crossMesh.receiveShadow = false;
    lod.addLevel(crossMesh, 320);

    return lod;
  }
  private static sharedMaterial: THREE.RawShaderMaterial | null = null;
  private static sharedGrassTexture: THREE.Texture | null = null;
  private static sharedAlphaMap: THREE.Texture | null = null;

  /**
   * Update global uniforms that are shared by the material. Call once per frame.
   */
  public static updateGlobalUniforms(
    delta: number,
    cameraPos: THREE.Vector3,
    skyController: SkyController,
  ) {
    Grass.sharedTime += delta;
    if (!Grass.sharedMaterial) return;
    const uniforms = Grass.sharedMaterial.uniforms as Record<
      string,
      { value: unknown }
    >;
    (uniforms.time.value as number) = Grass.sharedTime;
    (uniforms.cameraPosition.value as THREE.Vector3).copy(cameraPos);
    (uniforms.sunDirection.value as THREE.Vector3)
      .copy(skyController.sun)
      .normalize();
  }

  constructor(options: {
    centerX: number;
    centerZ: number;
    width: number;
    sampleHeight: (x: number, z: number) => number;
    waterLevel: number;
    bladeCount: number;
  }) {
    const { centerX, centerZ, width, sampleHeight, waterLevel, bladeCount } =
      options;

    this.width = width;

    const bladeWidth = 0.12;
    const bladeHeight = 1;

    const instances = Math.max(0, bladeCount);

    Grass.ensureSharedResources(bladeWidth, bladeHeight);

    // (base geometry already prepared above)

    const instancedGeometry = new THREE.InstancedBufferGeometry();
    const baseGeom = Grass.baseGeometry;
    if (!baseGeom) throw new Error('Missing base geometry');
    instancedGeometry.index = baseGeom.index;
    instancedGeometry.attributes.position = baseGeom.attributes.position;
    instancedGeometry.attributes.uv = baseGeom.attributes.uv;
    instancedGeometry.attributes.normal = baseGeom.attributes.normal;

    // Per-instance attributes
    const indices = new Float32Array(instances);
    const offsets = new Float32Array(instances * 3);
    const scales = new Float32Array(instances);
    const halfRootAngles = new Float32Array(instances * 2);

    let placedCount = 0;
    // Fuzz settings for lower boundary
    const cutoff = waterLevel + 12;
    const fuzz = 12;
    const fuzzHalf = fuzz * 0.5;
    const instancesLocal = instances;
    // Use top-level smoothStep helper defined above

    for (let index = 0; index < instancesLocal; index++) {
      indices[index] = index / instancesLocal;
      const x = Math.random() * width - width / 2;
      const z = Math.random() * width - width / 2;
      const y = sampleHeight(centerX + x, centerZ + z);

      // Use helper smoothStep declared above

      // Deterministic position-based pseudo-noise in [0,1)
      const posNoise = (() => {
        const ax = centerX + x;
        const bz = centerZ + z;
        const noiseSeed = Math.sin(ax * 12.9898 + bz * 78.233) * 43_758;
        return noiseSeed - Math.floor(noiseSeed);
      })();

      // Compute placement probability using smooth transition around cutoff
      const placementProb = smoothStep(y, cutoff - fuzzHalf, cutoff + fuzzHalf);
      // Blend with noise to make the border fuzzy
      const place = posNoise < placementProb;

      if (!place) continue;

      const offsetBase = placedCount * 3;
      offsets[offsetBase + 0] = x;
      offsets[offsetBase + 1] = y;
      offsets[offsetBase + 2] = z;
      const angleRoot = Math.PI - Math.random() * (2 * Math.PI);
      const halfBase = placedCount * 2;
      halfRootAngles[halfBase + 0] = Math.sin(0.5 * angleRoot);
      halfRootAngles[halfBase + 1] = Math.cos(0.5 * angleRoot);
      scales[placedCount] =
        index % 3 !== 0 ? 2 + Math.random() * 1.25 : 2 + Math.random();
      placedCount++;
    }

    instancedGeometry.setAttribute(
      'offset',
      new THREE.InstancedBufferAttribute(
        offsets.subarray(0, placedCount * 3),
        3,
      ),
    );
    instancedGeometry.setAttribute(
      'scale',
      new THREE.InstancedBufferAttribute(scales.subarray(0, placedCount), 1),
    );
    instancedGeometry.setAttribute(
      'halfRootAngle',
      new THREE.InstancedBufferAttribute(
        halfRootAngles.subarray(0, placedCount * 2),
        2,
      ),
    );
    instancedGeometry.setAttribute(
      'index',
      new THREE.InstancedBufferAttribute(indices, 1),
    );

    // Only draw the number of instances actually placed (exclude dummies)
    instancedGeometry.instanceCount = placedCount;

    // Compute conservative bounding sphere in O(1) by sampling a fixed
    // Set of positions (corners, edges, center). This avoids iterating every
    // Placed instance while remaining conservative for frustum culling.
    if (placedCount > 0) {
      const halfW = width * 0.5;
      const samples: Array<[number, number]> = [
        [-halfW, -halfW],
        [halfW, -halfW],
        [-halfW, halfW],
        [halfW, halfW],
        [0, 0],
        [-halfW, 0],
        [halfW, 0],
        [0, -halfW],
        [0, halfW],
      ];

      let minY = Infinity;
      let maxY = -Infinity;
      for (let si = 0; si < samples.length; si += 1) {
        const sx = centerX + samples[si][0];
        const sz = centerZ + samples[si][1];
        const sy = sampleHeight(sx, sz);
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }

      if (!Number.isFinite(minY)) minY = 0;
      if (!Number.isFinite(maxY)) maxY = 0;

      const minX = -halfW;
      const maxX = halfW;
      const minZ = -halfW;
      const maxZ = halfW;
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5 + bladeHeight * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const dx = Math.max(Math.abs(minX - cx), Math.abs(maxX - cx));
      const dz = Math.max(Math.abs(minZ - cz), Math.abs(maxZ - cz));
      const dy = Math.max(Math.abs(minY - cy), Math.abs(maxY - cy));
      let radius = Math.hypot(dx, dy, dz) + Math.hypot(bladeWidth, bladeHeight);
      // Ensure bounding sphere isn't too small — use a conservative minimum
      const minRadius = Math.hypot(halfW, bladeHeight) + 1;
      if (radius < minRadius) radius = minRadius;
      instancedGeometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(cx, cy, cz),
        radius,
      );
    }
    // Create far and cross base geometries
    const farBaseGeom = Grass.createFarBase(bladeWidth, bladeHeight);
    const crossBaseGeom = Grass.createCrossBase(bladeWidth, bladeHeight);
    const grassVertexSource = `
precision lowp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec3 offset;
attribute vec2 uv;
attribute vec2 halfRootAngle;
attribute float scale;
attribute float index;
uniform float time;

uniform float width;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform vec3 cameraPosition;
uniform float ambientStrength;
uniform float diffuseStrength;
uniform float specularStrength;
uniform float translucencyStrength;
uniform float shininess;
uniform vec3 lightColour;
uniform vec3 sunDirection;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying float frc;
varying float idx;
varying vec3 vLightMul;
varying vec3 vSpecular;

const float PI = 3.1415;
const float TWO_PI = 2.0 * PI;

vec3 rotateVectorByQuaternion(vec3 v, vec4 q){
  return 2.0 * cross(q.xyz, v * q.w + cross(q.xyz, v)) + v;
}

void main() {

  frc = position.y / float(1.0);
  vec3 localPos = position;
  localPos.y *= scale;
  vec3 localNormal = normal;
  localNormal.y /= scale;

  vec4 direction = vec4(0.0, halfRootAngle.x, 0.0, halfRootAngle.y);
  localPos = rotateVectorByQuaternion(localPos, direction);
  localNormal = rotateVectorByQuaternion(localNormal, direction);
  vUv = uv;

  // Place blade at instance offset (offset is local XYXZ relative to chunk center)
  vec3 pos;
  pos.x = offset.x;
  pos.z = offset.z;
  pos.y = offset.y;

  vec2 fractionalPos = 0.5 + offset.xz / width;
  fractionalPos *= TWO_PI;
  float noise = 0.5 + 0.5 * sin(fractionalPos.x + time);
  float halfAngle = -noise * 0.1;
  noise = 0.5 + 0.5 * cos(fractionalPos.y + time);
  halfAngle -= noise * 0.05;
  direction = normalize(vec4(sin(halfAngle), 0.0, -sin(halfAngle), cos(halfAngle)));
  localPos = rotateVectorByQuaternion(localPos, direction);
  localNormal = rotateVectorByQuaternion(localNormal, direction);
  localPos += pos;
  idx = index;

  // compute world-space position & normal for lighting
  vec4 worldPos4 = modelMatrix * vec4(localPos, 1.0);
  vec3 worldPos = worldPos4.xyz;
  vec3 worldNormal = normalize(mat3(modelMatrix) * localNormal);

  // lighting calculations (Gouraud shading per-vertex)
  vec3 lightDir = normalize(sunDirection);
  float dotNormalLight = dot(worldNormal, lightDir);
  float diff = max(dotNormalLight, 0.0);

  vec3 diffuse = diff * lightColour * diffuseStrength;
  float sky = max(dot(worldNormal, vec3(0,1,0)), 0.0);
  vec3 skyLight = sky * vec3(0.12, 0.29, 0.55);

  vec3 viewDirection = normalize(cameraPosition - worldPos);
  vec3 halfwayDir = normalize(lightDir + viewDirection);
  float spec = pow(max(dot(worldNormal, halfwayDir), 0.0), shininess);
  vec3 specular = spec * vec3(specularStrength) * (lightColour * vec3(1.0));

  vec3 diffuseTranslucency = vec3(0.0);
  vec3 forwardTranslucency = vec3(0.0);
  float dotViewLight = dot(-lightDir, viewDirection);
  float back = step(dotNormalLight, 0.0);
  diffuseTranslucency = lightColour * translucencyStrength * back * -dotNormalLight;
  if(dotViewLight > 0.0) forwardTranslucency = lightColour * translucencyStrength * pow(dotViewLight, 16.0);

  // Compose a multiplicative lighting term to be applied to the texture colour in the fragment
  vLightMul = 0.3 * skyLight + vec3(ambientStrength) + diffuse + diffuseTranslucency + forwardTranslucency;
  vSpecular = specular;

  // assign varyings used in fragment
  vNormal = localNormal;
  vPosition = worldPos;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
}
`;

    const grassFragmentSource = `
precision lowp float;
uniform vec3 cameraPosition;
uniform sampler2D map;
uniform sampler2D alphaMap;
varying float frc;
varying float idx;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLightMul;
varying vec3 vSpecular;
void main(){
  float alpha = texture2D(alphaMap, vUv).r;
  vec3 normal;
  if(gl_FrontFacing) normal = normalize(vNormal); else normal = normalize(-vNormal);
  vec3 textureColour = texture2D(map, vUv).rgb;
  vec3 mixColour = idx > 0.75 ? vec3(0.35,0.55,0.20) : vec3(0.45,0.60,0.25);
  textureColour = mix(0.1 * mixColour, textureColour, 0.6);

  // Apply interpolated lighting from vertex shader
  vec3 col = vLightMul * textureColour + vSpecular;

  col = mix(0.35*vec3(0.1,0.25,0.02), col, frc);
  gl_FragColor = vec4(col, alpha);
}
`;
    // Create a single shared material for all grass chunks (shaders/textures reused)
    let matLocal = Grass.sharedMaterial;
    if (!matLocal) {
      matLocal = new THREE.RawShaderMaterial({
        alphaTest: 0.5,
        fragmentShader: grassFragmentSource,
        side: THREE.DoubleSide,
        transparent: true,
        uniforms: {
          alphaMap: { value: Grass.sharedAlphaMap },
          ambientStrength: { value: 0.5 },
          cameraPosition: { value: new THREE.Vector3(0, 0, 0) },
          diffuseStrength: { value: 1.1 },
          lightColour: { value: new THREE.Vector3(1, 1, 1) },
          map: { value: Grass.sharedGrassTexture },
          shininess: { value: 64 },
          specularColour: { value: new THREE.Vector3(1, 1, 1) },
          specularStrength: { value: 0.2 },
          sunDirection: { value: new THREE.Vector3(0.5, 0.5, 0.2) },
          time: { value: 0 },
          translucencyStrength: { value: 0.6 },
          width: { value: width },
        },
        vertexShader: grassVertexSource,
      });
      Grass.sharedMaterial = matLocal;
    }

    this.material = matLocal;

    this.geometry = instancedGeometry;

    this.mesh = this.buildLod({
      crossBaseGeom,
      farBaseGeom,
      instancedGeometry,
      placedCount,
    });
    this.mesh.position.set(centerX, 0, centerZ);
    this.mesh.frustumCulled = true;

    // Default squared cull distance (matches LOD bands used later).
    // This hides the mesh entirely if the camera is farther than this.
    // Avoids expensive CPU work per-frame for distant chunks.
    this.cullDistanceSq = 400 * 400;

    // Ensure per-mesh uniforms (like `width`) are set before render. Global
    // Uniforms such as `time`, `cameraPosition`, and `sunDirection` are
    // Updated once per frame via `Grass.updateGlobalUniforms`.
    this.mesh.onBeforeRender = () => {
      const uniforms = this.material.uniforms as Record<
        string,
        { value: unknown }
      >;
      (uniforms.width.value as number) = this.width;
    };
  }

  public update(cameraPos: THREE.Vector3) {
    // Simple LOD based on camera distance. Global uniforms (time, camera
    // Position, sun direction) should be updated once per-frame by calling
    // `Grass.updateGlobalUniforms(delta, cameraPos, skyController)` externally.
    const worldPos = new THREE.Vector3();
    this.mesh.getWorldPosition(worldPos);
    const dx = worldPos.x - cameraPos.x;
    const dz = worldPos.z - cameraPos.z;
    const distance = dx * dx + dz * dz;

    // Distance culling: hide the whole mesh when beyond `cullDistanceSq` to
    // Avoid Three.js processing it in the render loop.
    if (distance > this.cullDistanceSq) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
  }

  public dispose(parent: THREE.Object3D) {
    parent.remove(this.mesh);
    // Dispose only per-chunk geometry. Shared material and textures are kept alive.
    for (let ci = this.mesh.children.length - 1; ci >= 0; ci--) {
      const child = this.mesh.children[ci] as THREE.Mesh;
      child.geometry.dispose();
      this.mesh.remove(child);
    }
  }
}
