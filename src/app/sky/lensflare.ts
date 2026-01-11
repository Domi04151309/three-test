import * as THREE from 'three';
import {
  Lensflare,
  LensflareElement,
} from 'three/examples/jsm/objects/Lensflare';

function drawPoly(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  options: { sides: number; rotation?: number },
) {
  const { sides, rotation = 0 } = options;
  context.beginPath();
  for (let index = 0; index < sides; index++) {
    const angle = (Math.PI * 2 * index) / sides + rotation;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function createSunburstTexture(
  size: number,
  color: THREE.Color,
  rays: number = 12,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context not available');
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const red = Math.floor(color.r * 255);
  const green = Math.floor(color.g * 255);
  const blue = Math.floor(color.b * 255);

  gradient.addColorStop(
    0,
    `rgba(${String(red)},${String(green)},${String(blue)},1.0)`,
  );
  gradient.addColorStop(
    0.1,
    `rgba(${String(red)},${String(green)},${String(blue)},0.8)`,
  );
  gradient.addColorStop(
    0.2,
    `rgba(${String(red)},${String(green)},${String(blue)},0.2)`,
  );
  gradient.addColorStop(
    1,
    `rgba(${String(red)},${String(green)},${String(blue)},0.0)`,
  );

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = `rgba(${String(red)}, ${String(green)}, ${String(blue)}, 0.6)`;
  context.lineWidth = size * 0.005;
  context.lineCap = 'round';

  for (let index = 0; index < rays; index++) {
    const angle = (Math.PI * 2 * index) / rays;
    const length = radius * (0.8 + Math.random() * 0.2);
    const x2 = cx + Math.cos(angle) * length;
    const y2 = cy + Math.sin(angle) * length;

    const grad = context.createLinearGradient(cx, cy, x2, y2);
    grad.addColorStop(0, `rgba(255,255,255,0.8)`);
    grad.addColorStop(1, `rgba(255,255,255,0)`);
    context.strokeStyle = grad;

    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(x2, y2);
    context.stroke();
  }

  context.fillStyle = 'rgba(255,255,255,1.0)';
  context.beginPath();
  context.arc(cx, cy, radius * 0.04, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function createGhostTexture(
  size: number,
  color: THREE.Color,
  sides: number = 6,
  filled: boolean = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context not available');
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.95;

  const red = Math.floor(color.r * 255);
  const green = Math.floor(color.g * 255);
  const blue = Math.floor(color.b * 255);

  const baseAlpha = 0.15;

  if (filled) {
    const grad = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(
      0,
      `rgba(${String(red)},${String(green)},${String(blue)},${String(baseAlpha)})`,
    );
    grad.addColorStop(
      1,
      `rgba(${String(red)},${String(green)},${String(blue)},${String(baseAlpha * 0.4)})`,
    );
    context.fillStyle = grad;

    drawPoly(context, cx, cy, radius, { sides, rotation: Math.PI / sides });
    context.fill();

    context.strokeStyle = `rgba(${String(red)},${String(green)},${String(blue)},${String(baseAlpha * 0.5)})`;
    context.lineWidth = size * 0.01;
    context.stroke();
  } else {
    context.strokeStyle = `rgba(${String(red)},${String(green)},${String(blue)},0.1)`;
    context.lineWidth = size * 0.04;
    context.beginPath();
    context.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export class LensflareController extends THREE.Group {
  private lensflare: Lensflare;

  constructor() {
    super();
    this.lensflare = new Lensflare();
    this.add(this.lensflare);
    this.initFlares();
  }

  private initFlares() {
    const sunColor = new THREE.Color('#ffffff');

    const sunTex = createSunburstTexture(512, sunColor, 12);
    this.lensflare.addElement(new LensflareElement(sunTex, 300, 0));

    const glowTex = createSunburstTexture(256, new THREE.Color('#ffffee'), 0);
    this.lensflare.addElement(new LensflareElement(glowTex, 500, 0));

    const ghostColor1 = new THREE.Color('#66ffaa');
    const ghostColor2 = new THREE.Color('#ffaa55');
    const ghostColor3 = new THREE.Color('#5555ff');

    const hexTex = createGhostTexture(256, ghostColor1, 6, true);
    const octTex = createGhostTexture(256, ghostColor2, 8, true);
    const ringTex = createGhostTexture(512, ghostColor3, 0, false);

    this.lensflare.addElement(new LensflareElement(hexTex, 50, 0.6));
    this.lensflare.addElement(new LensflareElement(hexTex, 80, 0.7));
    this.lensflare.addElement(new LensflareElement(hexTex, 120, 0.9));

    this.lensflare.addElement(new LensflareElement(octTex, 200, 1.1));

    this.lensflare.addElement(new LensflareElement(ringTex, 600, 1.2));
  }

  public updatePosition(position: THREE.Vector3) {
    this.lensflare.position.copy(position);
  }
}
