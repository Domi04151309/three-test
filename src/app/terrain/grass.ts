import * as THREE from 'three';
import type { SkyController } from '../sky/sky';
import { grassFragmentSource, grassVertexSource } from './grass-shaders';

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

    Grass.ensureSharedResources(bladeWidth, bladeHeight);

    const { instancedGeometry, placedCount } = Grass.createInstancedGeometry({
      bladeCount,
      bladeHeight,
      bladeWidth,
      centerX,
      centerZ,
      sampleHeight,
      waterLevel,
      width,
    });

    const farBaseGeom = Grass.createFarBase(bladeWidth, bladeHeight);
    const crossBaseGeom = Grass.createCrossBase(bladeWidth, bladeHeight);

    this.material = Grass.ensureSharedMaterial(width);

    this.mesh = this.buildLod({
      crossBaseGeom,
      farBaseGeom,
      instancedGeometry,
      placedCount,
    });
    this.mesh.position.set(centerX, 0, centerZ);
    this.mesh.frustumCulled = true;

    this.cullDistanceSq = 400 * 400;

    this.mesh.onBeforeRender = () => {
      const uniforms = this.material.uniforms as Record<
        string,
        { value: unknown }
      >;
      (uniforms.width.value as number) = this.width;
    };
  }

  private static createInstancedGeometry(options: {
    centerX: number;
    centerZ: number;
    width: number;
    sampleHeight: (x: number, z: number) => number;
    waterLevel: number;
    bladeCount: number;
    bladeWidth: number;
    bladeHeight: number;
  }) {
    const {
      centerX,
      centerZ,
      width,
      sampleHeight,
      waterLevel,
      bladeCount,
      bladeWidth,
      bladeHeight,
    } = options;

    const instances = Math.max(0, bladeCount);

    const instancedGeometry = new THREE.InstancedBufferGeometry();
    const baseGeom = Grass.baseGeometry;
    if (!baseGeom) throw new Error('Missing base geometry');
    instancedGeometry.index = baseGeom.index;
    instancedGeometry.attributes.position = baseGeom.attributes.position;
    instancedGeometry.attributes.uv = baseGeom.attributes.uv;
    instancedGeometry.attributes.normal = baseGeom.attributes.normal;

    const indices = new Float32Array(instances);
    const offsets = new Float32Array(instances * 3);
    const scales = new Float32Array(instances);
    const halfRootAngles = new Float32Array(instances * 2);

    const placedCount = Grass.populateInstanceAttributes({
      instances,
      indices,
      offsets,
      scales,
      halfRootAngles,
      width,
      centerX,
      centerZ,
      sampleHeight,
      waterLevel,
    });

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
    instancedGeometry.instanceCount = placedCount;

    if (placedCount > 0) {
      Grass.computeBoundingSphere(instancedGeometry, {
        width,
        bladeWidth,
        bladeHeight,
        centerX,
        centerZ,
        sampleHeight,
      });
    }

    return { instancedGeometry, placedCount };
  }

  private static populateInstanceAttributes(options: {
    instances: number;
    indices: Float32Array;
    offsets: Float32Array;
    scales: Float32Array;
    halfRootAngles: Float32Array;
    width: number;
    centerX: number;
    centerZ: number;
    sampleHeight: (x: number, z: number) => number;
    waterLevel: number;
  }) {
    const {
      instances,
      indices,
      offsets,
      scales,
      halfRootAngles,
      width,
      centerX,
      centerZ,
      sampleHeight,
      waterLevel,
    } = options;
    let placedCount = 0;
    const cutoff = waterLevel + 12;
    const fuzz = 12;
    const fuzzHalf = fuzz * 0.5;
    const instancesLocal = instances;

    for (let index = 0; index < instancesLocal; index++) {
      indices[index] = index / instancesLocal;
      const x = Math.random() * width - width / 2;
      const z = Math.random() * width - width / 2;
      const y = sampleHeight(centerX + x, centerZ + z);

      const posNoise = (() => {
        const ax = centerX + x;
        const bz = centerZ + z;
        const noiseSeed = Math.sin(ax * 12.9898 + bz * 78.233) * 43_758;
        return noiseSeed - Math.floor(noiseSeed);
      })();

      const placementProb = smoothStep(y, cutoff - fuzzHalf, cutoff + fuzzHalf);
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

    return placedCount;
  }

  private static computeBoundingSphere(
    instancedGeometry: THREE.InstancedBufferGeometry,
    options: {
      width: number;
      bladeWidth: number;
      bladeHeight: number;
      centerX: number;
      centerZ: number;
      sampleHeight: (x: number, z: number) => number;
    },
  ) {
    const { width, bladeWidth, bladeHeight, centerX, centerZ, sampleHeight } =
      options;
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
    const minRadius = Math.hypot(halfW, bladeHeight) + 1;
    if (radius < minRadius) radius = minRadius;
    instancedGeometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(cx, cy, cz),
      radius,
    );
  }

  private static ensureSharedMaterial(width: number) {
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

    return matLocal;
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
