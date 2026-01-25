import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { createViewModel, ViewModelData } from './view-model.factory';
import { PlayerOptions } from './player.types';
import { ViewBobbing } from './view-bobbing.effect';
import { PunchHandler } from './punch.handler';
import { InventoryManager } from './inventory.manager';
import { attachPlayerInputHandlers } from './player.controls';
import { initStartingInventory } from './player.setup';
import { updateHealthUI, updateStaminaUI } from './player.hud';

export class Player {
  object: THREE.Object3D;
  controls: PointerLockControls;
  camera: THREE.PerspectiveCamera;
  isZooming = false;
  readonly zoomFov = 20;
  readonly zoomSpeed = 10;
  defaultFov = 75;
  readonly sprintFovIncrease = 10;
  blocker: HTMLElement | null = null;
  viewModel: THREE.Group;
  rightHand: THREE.Mesh;
  inventoryManager!: InventoryManager;
  viewBobbing: ViewBobbing;
  punchHandler: PunchHandler;
  maxHealth = 100;
  health = 100;
  healthFillElement: HTMLElement | null = null;
  healthTextElement: HTMLElement | null = null;
  maxStamina = 100;
  stamina = 100;
  staminaFillElement: HTMLElement | null = null;
  staminaTextElement: HTMLElement | null = null;
  readonly staminaDrainRate = 30;
  readonly staminaRegenRate = 20;
  readonly healthRegenRate = 5;
  velocity: THREE.Vector3;
  direction: THREE.Vector3;
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  canJump = false;
  isSprinting = false;
  readonly options: PlayerOptions;
  touchId: number | null = null;
  lastTouchX = 0;
  lastTouchY = 0;
  wheelAccumulator = 0;
  detachInputs?: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: PlayerOptions,
  ) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.defaultFov = this.camera.fov;
    this.options = options;
    this.controls = new PointerLockControls(camera, domElement);
    this.object = this.controls.object;

    const vm: ViewModelData = createViewModel();
    this.viewModel = vm.viewModel;
    this.rightHand = vm.rightHand;
    this.object.add(this.viewModel);
    this.inventoryManager = new InventoryManager({
      controls: this.controls,
      rightHand: this.rightHand,
    });

    initStartingInventory(this.inventoryManager).catch(console.error);

    this.viewBobbing = new ViewBobbing(
      this.viewModel,
      vm.baseViewPos,
      vm.baseViewRot,
      options,
    );
    this.punchHandler = new PunchHandler(
      this.rightHand,
      vm.baseRightHandPos,
      vm.baseRightHandRot,
      options,
    );

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.detachInputs = attachPlayerInputHandlers(this, domElement);

    this.healthFillElement = document.getElementById('health-fill');
    this.healthTextElement = document.getElementById('health-text');
    this.staminaFillElement = document.getElementById('stamina-fill');
    this.staminaTextElement = document.getElementById('stamina-text');
    updateHealthUI(
      this.health,
      this.maxHealth,
      this.healthFillElement,
      this.healthTextElement,
    );
    updateStaminaUI(
      this.stamina,
      this.maxStamina,
      this.staminaFillElement,
      this.staminaTextElement,
    );
  }
}
