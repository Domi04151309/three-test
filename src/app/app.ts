import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { createComposer } from './postprocessing';
import { Player } from './player/player';
import { SkyController } from './sky/sky';
import { Terrain } from './terrain/terrain';
import { createRenderer } from './renderer';
import { Fireflies } from './effects/fireflies';
import { Compass } from './gui/compass';
import { PositionDisplay } from './gui/position';
import { FullscreenMap } from './gui/fullscreen-map';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';

export class App {
  public player: Player;
  public terrain: Terrain;
  public skyController: SkyController;
  public camera: THREE.PerspectiveCamera;
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;

  constructor(container: HTMLDivElement) {
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
      gravityScale: 10,
      ground: terrain.getHeightAt.bind(terrain),
      height: 1.8,
      heightScale: 10,
      jumpVelocity: 2,
      jumpScale: 20,
      speed: 200,
      sprintMultiplier: 10,
      bobFreq: 8,
      bobAmpY: 0.03,
      bobAmpX: 0.02,
      bobRotZ: 0.03,
      minLevel: 16,
      punchDuration: 0.2,
      swingPosOffset: new THREE.Vector3(-0.25, -0.08, -0.45),
      swingRotOffset: new THREE.Euler(-1.2, 0.6, 0.4),
      touchSensitivity: 0.0025,
    });
    // Place player above terrain at start
    player.object.position.set(0, terrain.getHeightAt(0, 0) + 1.8, 0);
    player.enablePointerLockUI(blocker, instructions);
    scene.add(player.object);
    // Allow inventory to add dropped items into the world scene
    player.inventoryManager.world = scene;
    // Let inventory place drops on the terrain surface
    player.inventoryManager.ground = terrain.getHeightAt.bind(terrain);

    this.player = player;
    this.terrain = terrain;
    this.skyController = skyController;
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.composer = composer;

    // Compass UI (top-center)
    const compass = new Compass();
    const positionDisplay = new PositionDisplay();
    const fullmap = new FullscreenMap(terrain);

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
      fullmap.update(player.object.position, camera);
      fireflies.update(delta, player.object.position);
      composer.render();
      stats.update();
    });
  }
}
