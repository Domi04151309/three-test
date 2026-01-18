import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { createViewModel, ViewModelData } from './view-model';
import { Sword } from './items/sword';
import { Item } from './items/item';
import { PlayerOptions } from './types';
import { ViewBobbing } from './view-bobbing';
import { PunchHandler } from './punch-handler';
import {
  createHotbarPreview,
  disposeHotbarPreview,
  HotbarPreviewEntry,
} from './hotbar-preview';
import { attachPlayerInputHandlers } from './player-inputs';

export class Player {
  object: THREE.Object3D;
  controls: PointerLockControls;
  camera: THREE.PerspectiveCamera;
  isZooming = false;
  readonly zoomFov = 20;
  readonly zoomSpeed = 10;
  defaultFov = 75;
  blocker: HTMLElement | null = null;
  viewModel: THREE.Group;
  rightHand: THREE.Mesh;
  inventory: (Item | null)[] = Array.from({ length: 9 }, () => null);
  currentSlot = -1;
  viewBobbing: ViewBobbing;
  punchHandler: PunchHandler;
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
  hotbarRenderers: (HotbarPreviewEntry | null)[] = Array.from(
    { length: 9 },
    () => null,
  );
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

    // Create a simple view-model (hands) and attach to the player/camera
    const vm: ViewModelData = createViewModel();
    this.viewModel = vm.viewModel;
    this.rightHand = vm.rightHand;
    this.object.add(this.viewModel);

    // Load sword for inventory slot 1 (index 0). detach immediately and equip slot 0
    const hand = this.rightHand;
    (async (handReference: THREE.Mesh) => {
      const sword = await Sword.createForHand(handReference);
      if (sword.object && sword.object.parent === handReference)
        handReference.remove(sword.object);
      this.inventory[0] = sword;
      this.equipSlot(0);
    })(hand).catch(console.error);

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
  }

  enablePointerLockUI(
    blocker: HTMLElement | null,
    instructions: HTMLElement | null,
  ): void {
    this.blocker = blocker;

    if (instructions)
      instructions.addEventListener('click', () => {
        this.controls.lock();
      });

    this.controls.addEventListener('lock', () => {
      if (blocker) blocker.style.display = 'none';
    });

    this.controls.addEventListener('unlock', () => {
      if (blocker) blocker.style.display = 'flex';
    });
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
        this.isSprinting = down;
        break;
      case 'KeyC':
        this.isZooming = down;
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
          if (!Number.isNaN(slot)) this.selectSlot(slot);
        }
        break;
      default:
        break;
    }
  }

  selectSlot(index: number): void {
    this.equipSlot(index);
  }

  private equipSlot(index: number): void {
    if (index < 0 || index >= this.inventory.length) return;
    // Unequip current
    if (this.currentSlot !== -1) {
      const current = this.inventory[this.currentSlot];
      if (current && current.object && current.object.parent === this.rightHand)
        this.rightHand.remove(current.object);
    }

    this.currentSlot = index;

    // Equip new
    const next = this.inventory[this.currentSlot];
    if (next && next.object) this.rightHand.add(next.object);

    this.updateHotbarUI();
  }

  private updateHotbarUI(): void {
    const hotbar = document.getElementById('hotbar');
    if (!hotbar) return;
    const children = hotbar.querySelectorAll('.slot');
    for (const [index, element] of children.entries()) {
      element.classList.toggle('selected', index === this.currentSlot);
      const item = this.inventory[index];
      if (item && item.object) {
        if (!this.hotbarRenderers[index]) {
          const entry = createHotbarPreview(item);
          const old = (element as HTMLElement).querySelector('canvas');
          if (old) old.remove();
          (element as HTMLElement).append(entry.canvas);
          this.hotbarRenderers[index] = entry;
        }
      } else if (this.hotbarRenderers[index]) {
        const entry = this.hotbarRenderers[index];
        disposeHotbarPreview(entry);
        this.hotbarRenderers[index] = null;
      }
    }
  }

  startPunch(): void {
    this.punchHandler.startPunch();
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

    if (this.camera instanceof THREE.PerspectiveCamera) {
      const targetFov = this.isZooming ? this.zoomFov : this.defaultFov;
      const zoomParameter = 1 - Math.exp(-this.zoomSpeed * dt);
      const updatedFov =
        this.camera.fov + (targetFov - this.camera.fov) * zoomParameter;
      if (Math.abs(updatedFov - this.camera.fov) > 0.01) {
        this.camera.fov = updatedFov;
        this.camera.updateProjectionMatrix();
      }
    }
  }
}
