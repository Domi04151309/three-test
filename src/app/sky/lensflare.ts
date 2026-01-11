import * as THREE from 'three';
import {
  Lensflare,
  LensflareElement,
} from 'three/examples/jsm/objects/Lensflare';

export class LensflareController extends THREE.Group {
  public light: THREE.PointLight;
  private readonly maxIntensity = 1.5;

  constructor(color = '#ffffff') {
    super();
    const flareColor = new THREE.Color(color);
    const point = new THREE.PointLight(flareColor, this.maxIntensity, 0, 2);
    this.light = point;
    this.add(point);

    const makeTexture = (
      size: number,
      inner = '#ffffff',
      outer = 'rgba(255,255,255,0)',
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        const fallbackTex = new THREE.CanvasTexture(canvas);
        fallbackTex.needsUpdate = true;
        return fallbackTex;
      }
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      gradient.addColorStop(0, inner);
      gradient.addColorStop(0.2, inner);
      gradient.addColorStop(1, outer);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    const tex0 = makeTexture(1024, '#ffffff', 'rgba(255,255,255,0)');
    const tex3 = makeTexture(
      256,
      'rgba(255,255,255,0.6)',
      'rgba(255,255,255,0)',
    );
    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(tex0, 1400, 0, flareColor));
    lensflare.addElement(new LensflareElement(tex3, 120, 0.4));
    lensflare.addElement(new LensflareElement(tex3, 140, 0.6));
    lensflare.addElement(new LensflareElement(tex3, 220, 0.85));
    lensflare.addElement(new LensflareElement(tex3, 130, 1));

    this.light.layers.set(1);
    lensflare.layers.set(1);

    this.light.add(lensflare);
  }

  public setSunPosition(sun: THREE.Vector3) {
    this.light.position.copy(sun).multiplyScalar(1024);
  }

  public update(camera: THREE.Camera) {
    const camDirection = new THREE.Vector3();
    camera.getWorldDirection(camDirection).normalize();

    const sunPos = new THREE.Vector3();
    this.light.getWorldPosition(sunPos);
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const toSun = sunPos.sub(camPos).normalize();

    const angle = camDirection.angleTo(toSun);
    const threshold = THREE.MathUtils.degToRad(90);
    const visibilityFactor = Math.max(0, 1 - angle / threshold);

    this.light.intensity = THREE.MathUtils.lerp(
      0,
      this.maxIntensity,
      visibilityFactor ** 0.75,
    );
    this.light.visible = visibilityFactor > 0.001;
  }
}
