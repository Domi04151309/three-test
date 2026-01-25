import * as THREE from 'three';
import { Item } from './items/item';

export type HotbarPreviewEntry = {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  object: THREE.Object3D;
  size: number;
};

class SharedPreviewRenderer {
  private static instance: SharedPreviewRenderer | null = null;
  readonly renderer: THREE.WebGLRenderer;

  private constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
  }

  static getInstance(): SharedPreviewRenderer {
    if (!SharedPreviewRenderer.instance)
      SharedPreviewRenderer.instance = new SharedPreviewRenderer();
    return SharedPreviewRenderer.instance;
  }

  renderToCanvas(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    target: HTMLCanvasElement,
    size: number,
  ): void {
    const { renderer } = this;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(size, size, false);
    renderer.render(scene, camera);
    const source = renderer.domElement;
    const context = target.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, size, size);
    context.drawImage(source, 0, 0, size, size);
  }
}

export function createHotbarPreview(item: Item, size = 64): HotbarPreviewEntry {
  if (!item.object) throw new Error('Item object is required');

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

  const ambientLight = new THREE.AmbientLight('#fff', 0.6);
  const directionalLight = new THREE.DirectionalLight('#fff', 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(ambientLight, directionalLight);

  const cloned = item.object.clone(true);
  const bounding = new THREE.Box3().setFromObject(cloned);
  const temporaryVector = new THREE.Vector3();
  const boxSize = temporaryVector;
  bounding.getSize(boxSize);

  const maxDimension = Math.max(boxSize.x, boxSize.y, boxSize.z, 0.0001);
  const scaleFactor = (1 / maxDimension) * 0.8;
  cloned.scale.multiplyScalar(scaleFactor);

  const boundingAfter = new THREE.Box3().setFromObject(cloned);
  const centerAfter = temporaryVector;
  boundingAfter.getCenter(centerAfter);
  cloned.position.sub(centerAfter);

  if (item.previewRotation) cloned.rotation.copy(item.previewRotation);
  else cloned.rotation.y = Math.PI / 6;

  const { previewOffset } = item;
  if (previewOffset) cloned.position.add(previewOffset);

  scene.add(cloned);

  boundingAfter.getSize(temporaryVector);
  const cameraDistance =
    Math.max(temporaryVector.x, temporaryVector.y, temporaryVector.z) * 2.2;
  camera.position.set(0, 0, cameraDistance + 0.2);
  camera.lookAt(0, 0, 0);

  SharedPreviewRenderer.getInstance().renderToCanvas(
    scene,
    camera,
    canvas,
    size,
  );

  return {
    canvas,
    scene,
    camera,
    object: cloned,
    size,
  };
}

export function disposeHotbarPreview(entry: HotbarPreviewEntry): void {
  if (entry.canvas.parentElement) entry.canvas.remove();
  entry.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    const { material } = mesh;
    if (Array.isArray(material)) {
      for (const mat of material) {
        mat.dispose();
      }
    } else {
      material.dispose();
    }
  });
}
