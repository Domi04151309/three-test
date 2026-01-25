import * as THREE from 'three';

export type PlayerOptions = {
  speed: number;
  gravity: number;
  jumpVelocity: number;
  height: number;
  ground: (x: number, z: number) => number;
  sprintMultiplier: number;
  bobFreq: number;
  bobAmpY: number;
  bobAmpX: number;
  bobRotZ: number;
  minLevel: number;
  punchDuration: number;
  swingPosOffset: THREE.Vector3;
  swingRotOffset: THREE.Euler;
  touchSensitivity: number;
  gravityScale: number;
  jumpScale: number;
  heightScale: number;
};
