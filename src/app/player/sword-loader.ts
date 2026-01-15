import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export async function loadSwordForHand(rightHand: THREE.Mesh): Promise<void> {
  const basePath = '/src/assets/models/sword/';

  const swordGroup = await new Promise<THREE.Group>((resolve, reject) => {
    const objectLoader = new OBJLoader();
    objectLoader.setPath(basePath);
    objectLoader.load(
      'sword.obj',
      (object) => {
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color('#c3c7c7'),
          specular: new THREE.Color('#ffffff'),
          shininess: 200,
        });

        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.computeVertexNormals();
            child.material = material;
          }
        });

        resolve(object);
      },
      () => {
        /* Noop */
      },
      (error) => {
        reject(new Error(String(error)));
      },
    );
  });

  swordGroup.scale.setScalar(0.4);
  swordGroup.rotation.set(0, Math.PI / 2, 0);
  swordGroup.position.set(0, -0.5, 0);

  rightHand.add(swordGroup);
}
