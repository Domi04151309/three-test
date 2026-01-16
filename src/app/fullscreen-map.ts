import * as THREE from 'three';
import { terrainOptions } from './terrain/terrain-options';

type TerrainLike = {
  getHeightAt: (x: number, z: number) => number;
  getMapObjects?: () => Array<{
    x: number;
    y: number;
    z: number;
    type: 'tree' | 'flower';
  }>;
};

export class FullscreenMap {
  private terrain: TerrainLike;
  private overlay: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private backingRes = 1024;
  private imageData: ImageData;
  private visible = false;
  private redrawNext = false;

  constructor(terrain: TerrainLike) {
    this.terrain = terrain;

    this.overlay = document.createElement('div');
    this.overlay.id = 'map';

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.backingRes;
    this.canvas.height = this.backingRes;

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D context unavailable');
    this.context = context;

    // Pre-create an ImageData buffer to write pixels into directly.
    this.imageData = this.context.createImageData(
      this.backingRes,
      this.backingRes,
    );

    this.overlay.append(this.canvas);
    document.body.append(this.overlay);

    // Toggle key
    addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'm') this.toggle();
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.overlay.style.display = this.visible ? 'flex' : 'none';
    if (this.visible) this.redrawNext = true;
  }

  update(playerPos: THREE.Vector3, camera: THREE.Camera) {
    if (!this.visible || !this.redrawNext) return;
    this.redrawNext = false;

    const resolution = this.backingRes;
    const half = resolution / 2;
    const viewMeters = 1536;
    const cellSize = viewMeters / resolution;

    this.renderHeightmap(playerPos, resolution, half, cellSize);
    if (this.terrain.getMapObjects)
      this.renderMapObjects(
        playerPos,
        resolution,
        half,
        cellSize,
        this.terrain.getMapObjects(),
      );
    this.renderPlayerMarker(camera, half, resolution);
  }

  private renderHeightmap(
    playerPos: THREE.Vector3,
    resolution: number,
    half: number,
    cellSize: number,
  ) {
    // Fast path: write directly into an ImageData buffer and blit once.
    const { data } = this.imageData;
    const wl = terrainOptions.waterLevel;

    // Precomputed base colors (r,g,b) approximating the previous HSL choices.
    const COLOR_SAND = [215, 180, 120];
    const COLOR_WATER = [80, 130, 230];
    const COLOR_SNOW = [242, 242, 242];
    const COLOR_GRASS = [15, 80, 20];

    let pixelIndex = 0;
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const localX = (x - half + 0.5) * cellSize;
        const localZ = (half - y - 0.5) * cellSize;
        const worldX = playerPos.x + localX;
        const worldZ = playerPos.z + localZ;

        const height = this.terrain.getHeightAt(worldX, worldZ);

        let [rValue, gValue, bValue] = COLOR_SAND;
        if (height < wl) {
          [rValue, gValue, bValue] = COLOR_WATER;
        } else if (height > 256) {
          [rValue, gValue, bValue] = COLOR_SNOW;
        } else if (height > wl + 8) {
          [rValue, gValue, bValue] = COLOR_GRASS;
        }

        if (height > wl) {
          const overlayAlpha = FullscreenMap.overlayAlphaForHeight(height, wl);
          if (overlayAlpha > 0) {
            const blendFactor = 1 - overlayAlpha;
            rValue = Math.round(rValue * blendFactor);
            gValue = Math.round(gValue * blendFactor);
            bValue = Math.round(bValue * blendFactor);
          }
        }

        data[pixelIndex++] = rValue;
        data[pixelIndex++] = gValue;
        data[pixelIndex++] = bValue;
        data[pixelIndex++] = 255;
      }
    }

    this.context.putImageData(this.imageData, 0, 0);
  }

  private renderMapObjects(
    playerPos: THREE.Vector3,
    resolution: number,
    half: number,
    cellSize: number,
    objects: Array<{
      x: number;
      y: number;
      z: number;
      type: 'tree' | 'flower';
    }>,
  ) {
    const flowerSize = Math.max(2, resolution * 0.003);
    const treeSize = Math.max(4, resolution * 0.01);
    for (const item of objects) {
      const dx = item.x - playerPos.x;
      const dz = item.z - playerPos.z;
      const px = Math.round(half + dx / cellSize);
      const py = Math.round(half - dz / cellSize);
      if (px < 0 || px >= resolution || py < 0 || py >= resolution) continue;
      this.context.beginPath();
      this.context.fillStyle = 'hsl(80, 100%, 25%)';
      this.context.arc(
        px,
        py,
        item.type === 'tree' ? treeSize : flowerSize,
        0,
        Math.PI * 2,
      );
      this.context.fill();
    }
  }

  private renderPlayerMarker(
    camera: THREE.Camera,
    half: number,
    resolution: number,
  ) {
    const size = Math.max(4, resolution * 0.01);
    this.context.save();
    this.context.translate(half, half);

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const angle = Math.atan2(direction.x, direction.z);
    this.context.rotate(angle);

    this.context.fillStyle = '#fff';
    this.context.beginPath();
    this.context.moveTo(0, -size);
    this.context.lineTo(size * 0.7, size);
    this.context.lineTo(-size * 0.7, size);
    this.context.closePath();
    this.context.fill();

    this.context.restore();
  }

  private static overlayAlphaForHeight(height: number, waterLevel: number) {
    const maxRange = 320;
    const norm = Math.min(1, (height - waterLevel) / maxRange);
    return norm * 0.6;
  }
}
