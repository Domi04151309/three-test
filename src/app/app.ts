import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { createComposer } from './postprocessing';
import { Player } from './player/player';
import { SkyController } from './sky/sky';
import { Terrain } from './terrain/terrain';
import { createRenderer } from './renderer';
import { Fireflies } from './effects/fireflies';
import { Compass } from './compass';
import { PositionDisplay } from './position';

export function startApp(container: HTMLDivElement): void {
  const stats = new Stats();
  container.append(stats.dom);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e0e0e0', 64, 1024);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    4096,
  );

  const renderer = createRenderer(container, camera);

  const composer = createComposer(renderer, scene, camera);

  // Sky, lighting and shadows
  const skyController = new SkyController();
  scene.add(skyController);

  // Terrain
  const terrain = new Terrain(skyController);
  scene.add(terrain);

  // Player (pointer-lock + movement)
  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');

  const player = new Player(camera, document.body, {
    gravity: 9.81,
    ground: terrain.getHeightAt.bind(terrain),
    height: 1.8,
    jumpVelocity: 2,
    speed: 200,
  });
  // Place player above terrain at start
  player.object.position.set(0, terrain.getHeightAt(0, 0) + 1.8, 0);
  player.enablePointerLockUI(blocker, instructions);
  scene.add(player.object);

  // Compass UI (top-center)
  const compass = new Compass();
  const positionDisplay = new PositionDisplay();

  // Fireflies (mesh-based spheres)
  const fireflies = new Fireflies({
    count: 8,
    maxDistance: 24,
    minDistance: 8,
  });
  scene.add(fireflies);
  fireflies.initialize(player.object.position);

  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    skyController.update(camera, delta);
    player.update(delta);
    compass.update(camera);
    positionDisplay.update(player.object.position);
    terrain.updatePlayerPosition(player.object.position);
    terrain.update(camera, delta);
    fireflies.update(delta, player.object.position);
    composer.render();
    stats.update();
  });
}
