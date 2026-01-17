import * as Cloud from './cloud';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { Water } from 'three/examples/jsm/objects/Water';

export class SkyController extends THREE.Group {
  public sun: THREE.Vector3;
  private timeOfDay: number = 0.25;
  private dayLengthSeconds = 300;
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

  // Expose read-only info for other systems
  public getSunIntensity(): number {
    return this.sunLight.intensity;
  }

  public getAmbientIntensity(): number {
    return this.ambient.intensity;
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

  private updateLighting(intensityFactor: number): void {
    const sunWorldPos = this.sun.clone().multiplyScalar(450_000);
    this.sunLight.position.copy(sunWorldPos);

    this.sunLight.intensity = 0.05 + intensityFactor * 9;
    this.ambient.intensity = 0.5 + intensityFactor * 0.5;
    this.sunLight.castShadow = intensityFactor > 0.05;

    if (this.parent) {
      const scene = this.parent as THREE.Scene;
      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        const dayFog = new THREE.Color('#e0e0e0');
        const nightFog = new THREE.Color('#081328');
        fog.color.copy(nightFog.clone().lerp(dayFog, intensityFactor));
      }
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
    // Advance time of day
    this.timeOfDay += delta / this.dayLengthSeconds;
    this.timeOfDay %= 1;

    // Compute sun elevation and azimuth based on time
    const angle = 2 * Math.PI * (this.timeOfDay - 0.25);
    const elevationDeg = Math.max(-10, Math.sin(angle) * 90);
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = 2 * Math.PI * this.timeOfDay;
    this.sun.setFromSphericalCoords(1, phi, theta);

    // Compute daylight intensity factor early so we can hide clouds at night.
    const intensityFactor = THREE.MathUtils.clamp(
      (elevationDeg + 10) / 100,
      0,
      1,
    );
    const cloudVisibleThreshold = 0.06;

    // Position clouds relative to player and smoothly fade opacity with time of day.
    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
    for (let index = 0; index < this.clouds.length; index += 1) {
      const off = this.cloudOffsets[index];
      const cloud = this.clouds[index];
      cloud.position.set(playerPos.x + off.x, off.y, playerPos.z + off.z);
      cloud.update(camera);

      const targetOpacity =
        intensityFactor > cloudVisibleThreshold
          ? 0.06 + intensityFactor * 0.22
          : 0;
      const current = cloud.getOpacity();
      const fadeSpeed = 2.5;
      const lerpT = THREE.MathUtils.clamp(
        1 - Math.exp(-fadeSpeed * delta),
        0,
        1,
      );
      const nextOpacity = THREE.MathUtils.lerp(current, targetOpacity, lerpT);
      cloud.setOpacity(nextOpacity);
      cloud.visible = nextOpacity > 0.001;
    }

    this.water.position.set(playerPos.x, this.waterLevel, playerPos.z);
    const uniforms = this.water.material.uniforms as {
      time: THREE.IUniform<number>;
      sunDirection: THREE.IUniform<THREE.Vector3>;
    };
    uniforms.time.value += delta;
    uniforms.sunDirection.value.copy(this.sun).normalize();

    // Update sky shader
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms.sunPosition.value.copy(this.sun);

    // Hide the sky at night when sunlight intensity is very low.
    // Use the same threshold as clouds so the scene goes fully dark.
    this.sky.visible = intensityFactor > cloudVisibleThreshold;

    // Update lighting and fog
    this.updateLighting(intensityFactor);
  }
}
