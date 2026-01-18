import * as THREE from 'three';
import { Item } from './items/item';

export type HotbarPreviewEntry = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  object: THREE.Object3D;
};

export function createHotbarPreview(item: Item, size = 64): HotbarPreviewEntry {
  if (!item.object) throw new Error('Item object is required');

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

  const ambientLight = new THREE.AmbientLight('#fff', 0.6);
  const directionalLight = new THREE.DirectionalLight('#fff', 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(ambientLight, directionalLight);

  const cloned = item.object.clone(true);
  const bounding = new THREE.Box3().setFromObject(cloned);
  const boxSize = new THREE.Vector3();
  bounding.getSize(boxSize);

  const maxDimension = Math.max(boxSize.x, boxSize.y, boxSize.z, 0.0001);
  const scaleFactor = (1 / maxDimension) * 0.8;
  cloned.scale.multiplyScalar(scaleFactor);

  const boundingAfter = new THREE.Box3().setFromObject(cloned);
  const centerAfter = new THREE.Vector3();
  boundingAfter.getCenter(centerAfter);
  cloned.position.sub(centerAfter);

  if (item.previewRotation) cloned.rotation.copy(item.previewRotation);
  else cloned.rotation.y = Math.PI / 6;

  const { previewOffset } = item;
  if (previewOffset) cloned.position.add(previewOffset);

  scene.add(cloned);

  const cameraDistance =
    Math.max(
      boundingAfter.getSize(new THREE.Vector3()).x,
      boundingAfter.getSize(new THREE.Vector3()).y,
      boundingAfter.getSize(new THREE.Vector3()).z,
    ) * 2.2;
  camera.position.set(0, 0, cameraDistance + 0.2);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  renderer.render(scene, camera);

  return {
    canvas,
    renderer,
    scene,
    camera,
    object: cloned,
  };
}

export function disposeHotbarPreview(entry: HotbarPreviewEntry): void {
  if (entry.canvas.parentElement) entry.canvas.remove();
  entry.renderer.dispose();
  entry.scene.traverse((child) => {
    const mesh = child as THREE.Mesh | undefined;
    if (mesh) {
      mesh.geometry.dispose();
      const { material } = mesh;
      if (Array.isArray(material)) {
        for (const materialElement of material) {
          materialElement.dispose();
        }
      } else {
        material.dispose();
      }
    }
  });
}
