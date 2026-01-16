import * as Cloud from './cloud';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { Water } from 'three/examples/jsm/objects/Water';

export class SkyController extends THREE.Group {
  public sun: THREE.Vector3;
  private sky!: Sky;
  private sunLight!: THREE.DirectionalLight;
  private ambient!: THREE.AmbientLight;
  private clouds: Cloud.CloudVolume[] = [];
  private cloudOffsets: THREE.Vector3[] = [];
  private water!: Water;

  private waterLevel = 16;

  private readonly azimuth: number = 180;
  private readonly elevation: number = 140;
  private readonly color: string = '#ffffff';

  private static rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  constructor() {
    super();
    this.sun = new THREE.Vector3();
    this.initSky();
    this.initLights();
    this.createClouds();
    this.initWater();
  }

  private initSky(): void {
    this.sky = new Sky();
    this.sky.scale.setScalar(450_000);
    this.add(this.sky);

    const { uniforms } = this.sky.material;
    uniforms.turbidity.value = 10;
    uniforms.rayleigh.value = 1;
    uniforms.mieCoefficient.value = 0.005;
    uniforms.mieDirectionalG.value = 0.8;

    const phi = THREE.MathUtils.degToRad(90 - this.elevation);
    const theta = THREE.MathUtils.degToRad(this.azimuth);

    this.sun.setFromSphericalCoords(1, phi, theta);
    uniforms.sunPosition.value.copy(this.sun);
  }

  private initLights(): void {
    this.ambient = new THREE.AmbientLight(this.color, 2);
    this.add(this.ambient);

    this.sunLight = new THREE.DirectionalLight(this.color, 10);
    this.sunLight.position.copy(this.sun).multiplyScalar(450_000);
    this.sunLight.castShadow = true;
    this.add(this.sunLight);
    this.add(this.sunLight.target);
  }

  private createClouds(): void {
    const cloudCount = 32;
    for (let index = 0; index < cloudCount; index += 1) {
      const ox = SkyController.rand(-1024, 1024);
      const oz = SkyController.rand(-1024, 1024);
      const oy = SkyController.rand(320, 460);
      const cloud = new Cloud.CloudVolume(new THREE.Vector3(ox, oy, oz));
      this.clouds.push(cloud);
      this.cloudOffsets.push(new THREE.Vector3(ox, oy, oz));
      this.add(cloud);
    }
  }

  private initWater(): void {
    const loader = new THREE.TextureLoader();
    const waterNormals = loader.load('models/water/waternormals.jpg');
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;

    const waterGeom = new THREE.CircleGeometry(2048, 64);
    const water = new Water(waterGeom, {
      distortionScale: 3.7,
      fog: true,
      sunColor: new THREE.Color('white'),
      sunDirection: new THREE.Vector3(),
      textureHeight: 256,
      textureWidth: 256,
      waterColor: new THREE.Color('#001e0f'),
      waterNormals,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, this.waterLevel, 0);
    water.material.uniforms.size.value = 2;
    water.material.uniforms.sunDirection.value.copy(this.sun).normalize();
    this.water = water;
    this.add(water);
  }

  // Call this every frame to update visibility/intensity based on camera view
  public update(camera: THREE.Camera, delta: number): void {
    // Position clouds relative to player so they effectively follow movement.
    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
    for (let index = 0; index < this.clouds.length; index += 1) {
      const off = this.cloudOffsets[index];
      const cloud = this.clouds[index];
      cloud.position.set(playerPos.x + off.x, off.y, playerPos.z + off.z);
      cloud.update(camera);
    }

    this.water.position.set(playerPos.x, this.waterLevel, playerPos.z);
    const uniforms = this.water.material.uniforms as {
      time: THREE.IUniform<number>;
      sunDirection: THREE.IUniform<THREE.Vector3>;
    };
    uniforms.time.value += delta;
    uniforms.sunDirection.value.copy(this.sun).normalize();
  }
}
