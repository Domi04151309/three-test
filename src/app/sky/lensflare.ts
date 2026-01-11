import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare';

function drawPoly(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number, rotation: number = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides + rotation;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function createSunburstTexture(size: number, color: THREE.Color, rays: number = 12): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const r = Math.floor(color.r * 255);
  const g = Math.floor(color.g * 255);
  const b = Math.floor(color.b * 255);
  
  gradient.addColorStop(0, `rgba(${r},${g},${b},1.0)`);
  gradient.addColorStop(0.1, `rgba(${r},${g},${b},0.8)`);
  gradient.addColorStop(0.2, `rgba(${r},${g},${b},0.2)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
  ctx.lineWidth = size * 0.005; 
  ctx.lineCap = 'round';
  
  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays;
    const len = radius * (0.8 + Math.random() * 0.2); 
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    
    const grad = ctx.createLinearGradient(cx, cy, x2, y2);
    grad.addColorStop(0, `rgba(255,255,255,0.8)`);
    grad.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.strokeStyle = grad;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,1.0)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.04, 0, Math.PI * 2); 
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function createGhostTexture(size: number, color: THREE.Color, sides: number = 6, filled: boolean = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 * 0.95;

  const r = Math.floor(color.r * 255);
  const g = Math.floor(color.g * 255);
  const b = Math.floor(color.b * 255);
  
  const baseAlpha = 0.15;

  if (filled) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${baseAlpha})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${baseAlpha * 0.4})`);
    ctx.fillStyle = grad;
    
    drawPoly(ctx, cx, cy, radius, sides, Math.PI / sides);
    ctx.fill();

    ctx.strokeStyle = `rgba(${r},${g},${b},${baseAlpha * 0.5})`;
    ctx.lineWidth = size * 0.01;
    ctx.stroke();
  } else {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`;
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
    ctx.stroke();
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
    const sunColor = new THREE.Color(0xffffff);
    
    const sunTex = createSunburstTexture(512, sunColor, 12); 
    this.lensflare.addElement(new LensflareElement(sunTex, 300, 0));

    const glowTex = createSunburstTexture(256, new THREE.Color(0xffffee), 0); 
    this.lensflare.addElement(new LensflareElement(glowTex, 500, 0));

    const ghostColor1 = new THREE.Color(0x66ffaa);
    const ghostColor2 = new THREE.Color(0xffaa55);
    const ghostColor3 = new THREE.Color(0x5555ff);

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
  
  public update(camera: THREE.Camera) {
  }
}
