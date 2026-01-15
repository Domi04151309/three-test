import * as THREE from 'three';

export type ViewModelData = {
  viewModel: THREE.Group;
  rightHand: THREE.Mesh;
  baseViewPos: THREE.Vector3;
  baseViewRot: THREE.Euler;
  baseRightHandPos: THREE.Vector3;
  baseRightHandRot: THREE.Euler;
};

export function createViewModel(): ViewModelData {
  const viewModel = new THREE.Group();
  const handGeom = new THREE.SphereGeometry(0.18, 16, 12);
  const handMat = new THREE.MeshStandardMaterial({
    color: '#ffdbac',
    metalness: 0,
    roughness: 0.8,
  });
  const leftHand = new THREE.Mesh(handGeom, handMat);
  const rightHand = new THREE.Mesh(handGeom, handMat);
  leftHand.scale.set(1, 1.3, 0.85);
  rightHand.scale.set(1, 1.3, 0.85);
  leftHand.position.set(-1, -0.6, -0.6);
  rightHand.position.set(1, -0.6, -0.6);
  viewModel.add(leftHand, rightHand);
  viewModel.position.set(0, -0.2, -0.5);

  return {
    viewModel,
    rightHand,
    baseViewPos: viewModel.position.clone(),
    baseViewRot: viewModel.rotation.clone(),
    baseRightHandPos: rightHand.position.clone(),
    baseRightHandRot: rightHand.rotation.clone(),
  };
}
