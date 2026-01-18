import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { createViewModel, ViewModelData } from './view-model';
import { Sword } from './items/sword';
import { Item } from './items/item';
import { PlayerOptions } from './types';
import { ViewBobbing } from './view-bobbing';
import { PunchHandler } from './punch-handler';

export class Player {
  public object: THREE.Object3D;
  private controls: PointerLockControls;
  private camera: THREE.PerspectiveCamera;
  private isZooming = false;
  private readonly zoomFov = 20;
  private readonly zoomSpeed = 10;
  private defaultFov = 75;
  private blocker: HTMLElement | null = null;
  private viewModel: THREE.Group;
  private rightHand: THREE.Mesh;
  private inventory: (Item | null)[] = Array.from({ length: 9 }, () => null);
  private currentSlot = -1;
  private viewBobbing: ViewBobbing;
  private punchHandler: PunchHandler;
  private velocity: THREE.Vector3;
  private direction: THREE.Vector3;
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private canJump = false;
  private isSprinting = false;
  private readonly options: PlayerOptions;
  private touchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private wheelAccumulator = 0;

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

    this.bindKeys();
    // Bind mouse for punch action (left click)
    domElement.addEventListener('mousedown', this.onMouseDown);
    // Mouse wheel to change hotbar slots
    domElement.addEventListener('wheel', this.onWheel, { passive: true });
    // Touch look handlers (single-touch to look around)
    domElement.addEventListener('touchstart', this.onTouchStart, {
      passive: false,
    });
    domElement.addEventListener('touchmove', this.onTouchMove, {
      passive: false,
    });
    domElement.addEventListener('touchend', this.onTouchEnd);
    domElement.addEventListener('touchcancel', this.onTouchEnd);
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

  private bindKeys(): void {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  private handleKey(code: string, down: boolean): void {
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

  private selectSlot(index: number): void {
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
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.handleKey(event.code, true);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.handleKey(event.code, false);
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    this.startPunch();
  };

  private onWheel = (event: WheelEvent): void => {
    // Accumulate wheel delta and only switch slots when a threshold is passed.
    // This reduces sensitivity for high-resolution wheels and touchpads.
    this.wheelAccumulator += event.deltaY;

    // Larger = less sensitive (adjust if needed)
    const threshold = 100;
    if (Math.abs(this.wheelAccumulator) < threshold) return;

    const directionSign = this.wheelAccumulator > 0 ? 1 : -1;
    this.wheelAccumulator = 0;

    const inventoryLength = this.inventory.length;
    let next = this.currentSlot;
    if (next === -1) next = 0;
    next = (next + directionSign + inventoryLength) % inventoryLength;
    this.selectSlot(next);
  };

  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) return;

    const [touch] = event.touches;
    this.touchId = touch.identifier;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;

    // Hide blocker UI immediately when user starts using touch controls
    if (this.blocker) this.blocker.style.display = 'none';

    event.preventDefault();
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (this.touchId === null) return;
    // Find the tracked touch
    let touch: Touch | null = null;
    for (let index = 0; index < event.touches.length; index++) {
      const tt = event.touches.item(index);
      if (tt && tt.identifier === this.touchId) {
        touch = tt;
        break;
      }
    }
    if (!touch) return;

    const dx = touch.clientX - this.lastTouchX;
    const dy = touch.clientY - this.lastTouchY;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;

    const yawObject = this.controls.object;
    // Update yaw (around Y axis)
    yawObject.rotation.y -= dx * this.options.touchSensitivity;

    // Update pitch (camera x rotation), clamp to [-PI/2, PI/2]
    const cam = this.camera;
    const maxPitch = Math.PI / 2 - 0.01;
    const minPitch = -maxPitch;
    const updatedPitch = cam.rotation.x - dy * this.options.touchSensitivity;
    cam.rotation.x = Math.max(minPitch, Math.min(maxPitch, updatedPitch));
    cam.rotation.z = 0;

    event.preventDefault();
  };

  private onTouchEnd = (event: TouchEvent): void => {
    // If the tracked touch ended, clear tracking
    if (this.touchId === null) return;
    let stillActive = false;
    for (let index = 0; index < event.touches.length; index++) {
      const tt = event.touches.item(index);
      if (tt && tt.identifier === this.touchId) {
        stillActive = true;
        break;
      }
    }
    if (!stillActive) this.touchId = null;
  };

  private startPunch(): void {
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
