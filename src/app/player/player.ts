import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { createViewModel, ViewModelData } from './view-model';
import { PlayerOptions } from './types';
import { ViewBobbing } from './view-bobbing';
import { PunchHandler } from './punch-handler';
import { InventoryManager } from './inventory';
import { attachPlayerInputHandlers } from './player-inputs';
import { initStartingInventory } from './player-init';
import {
  updateHealthUI,
  updateStaminaUI,
  setupPointerLockUI,
  handleDeath as uiHandleDeath,
} from './player-ui';

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

    // Initialize helpers for view bobbing and punching
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

  takeDamage(amount: number): void {
    const dmg = Math.abs(amount);
    this.health = Math.max(0, this.health - dmg);
    updateHealthUI(
      this.health,
      this.maxHealth,
      this.healthFillElement,
      this.healthTextElement,
    );
    if (this.health <= 0) uiHandleDeath(this.controls, this.blocker);
  }

  heal(amount: number): void {
    const value = Math.abs(amount);
    this.health = Math.min(this.maxHealth, this.health + value);
    updateHealthUI(
      this.health,
      this.maxHealth,
      this.healthFillElement,
      this.healthTextElement,
    );
  }

  setHealth(value: number): void {
    this.health = Math.max(0, Math.min(this.maxHealth, value));
    updateHealthUI(
      this.health,
      this.maxHealth,
      this.healthFillElement,
      this.healthTextElement,
    );
    if (this.health <= 0) uiHandleDeath(this.controls, this.blocker);
  }

  setStamina(value: number): void {
    this.stamina = Math.max(0, Math.min(this.maxStamina, value));
    updateStaminaUI(
      this.stamina,
      this.maxStamina,
      this.staminaFillElement,
      this.staminaTextElement,
    );
  }

  enablePointerLockUI(
    blocker: HTMLElement | null,
    instructions: HTMLElement | null,
  ): void {
    this.blocker = blocker;
    setupPointerLockUI(this.controls, blocker, instructions);
  }

  handleKey(code: string, down: boolean): void {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = down;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = down;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = down;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = down;
        break;
      case 'Space':
        if (down && this.canJump) {
          this.velocity.y +=
            this.options.jumpVelocity *
            this.options.jumpScale *
            (this.isSprinting ? this.options.sprintMultiplier / 2 : 1);
          this.canJump = false;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (down) {
          if (this.stamina > 0) this.isSprinting = true;
        } else {
          this.isSprinting = false;
        }
        break;
      case 'KeyC':
        this.isZooming = down;
        break;
      case 'KeyE':
        if (down) this.inventoryManager.toggleInventory();
        break;
      case 'KeyQ':
        if (down) this.inventoryManager.dropCurrent();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
      case 'Digit6':
      case 'Digit7':
      case 'Digit8':
      case 'Digit9':
        if (down) {
          const slot = Number(code.replace('Digit', '')) - 1;
          if (!Number.isNaN(slot)) this.inventoryManager.equipSlot(slot);
        }
        break;
      default:
        break;
    }
  }

  update(delta: number): void {
    const dt = Math.min(delta, 0.05);
    const damping = Math.exp(-10 * dt);
    this.velocity.x *= damping;
    this.velocity.z *= damping;
    this.velocity.y -= this.options.gravity * this.options.gravityScale * dt;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    if (this.isSprinting && this.stamina > 0) {
      this.stamina -= this.staminaDrainRate * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.isSprinting = false;
      }
    } else if (this.stamina < this.maxStamina) {
      this.stamina += this.staminaRegenRate * dt;
      if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
    } else if (!this.isSprinting && this.health < this.maxHealth) {
      // Stamina full and not sprinting -> regenerate health instead
      this.heal(this.healthRegenRate * dt);
    }

    const moveSpeed =
      this.options.speed *
      (this.isSprinting ? this.options.sprintMultiplier : 1);
    if (this.moveForward || this.moveBackward)
      this.velocity.z -= this.direction.z * moveSpeed * dt;
    if (this.moveLeft || this.moveRight)
      this.velocity.x -= this.direction.x * moveSpeed * dt;

    this.controls.moveRight(-this.velocity.x * dt);
    this.controls.moveForward(-this.velocity.z * dt);
    this.object.position.y += this.velocity.y * dt;

    const groundY = Math.max(
      this.options.minLevel,
      this.options.ground(this.object.position.x, this.object.position.z),
    );
    const playerHeight = this.options.height * this.options.heightScale;
    if (this.object.position.y < groundY + playerHeight) {
      this.velocity.y = 0;
      this.object.position.y = groundY + playerHeight;
      this.canJump = true;
    }

    const isMoving =
      this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    this.viewBobbing.update(dt, isMoving);
    this.punchHandler.update(dt);

    this.inventoryManager.update();

    if (this.camera instanceof THREE.PerspectiveCamera) {
      const baseTargetFov = this.isZooming ? this.zoomFov : this.defaultFov;
      let targetFov = baseTargetFov;
      if (!this.isZooming && this.isSprinting)
        targetFov += this.sprintFovIncrease;
      const zoomParameter = 1 - Math.exp(-this.zoomSpeed * dt);
      const updatedFov =
        this.camera.fov + (targetFov - this.camera.fov) * zoomParameter;
      if (Math.abs(updatedFov - this.camera.fov) > 0.01) {
        this.camera.fov = updatedFov;
        this.camera.updateProjectionMatrix();
      }
    }
    updateStaminaUI(
      this.stamina,
      this.maxStamina,
      this.staminaFillElement,
      this.staminaTextElement,
    );
  }
}
