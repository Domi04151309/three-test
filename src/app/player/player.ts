import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { createViewModel, ViewModelData } from './view-model';
import { loadSwordForHand } from './sword-loader';

export type PlayerOptions = {
  speed: number;
  gravity: number;
  jumpVelocity: number;
  height: number;
  ground: (x: number, z: number) => number;
};

export class Player {
  public object: THREE.Object3D;
  private controls: PointerLockControls;
  private camera: THREE.Camera;
  private blocker: HTMLElement | null = null;
  private viewModel: THREE.Group;
  private rightHand: THREE.Mesh;
  private bobTime = 0;
  private baseViewPos: THREE.Vector3;
  private baseViewRot: THREE.Euler;
  private baseRightHandPos: THREE.Vector3;
  private baseRightHandRot: THREE.Euler;
  private velocity: THREE.Vector3;
  private direction: THREE.Vector3;
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private canJump = false;
  private isSprinting = false;
  private readonly speed: number;
  private readonly gravity: number;
  private readonly jumpVelocity: number;
  private readonly height: number;
  private readonly groundFn: (x: number, z: number) => number;
  private readonly sprintMultiplier = 10;
  private readonly bobFreq = 8;
  private readonly bobAmpY = 0.03;
  private readonly bobAmpX = 0.02;
  private readonly bobRotZ = 0.03;
  private readonly minLevel = 16;
  private isPunching = false;
  private punchTime = 0;
  private readonly punchDuration = 0.2;
  private readonly swingPosOffset = new THREE.Vector3(-0.25, -0.08, -0.45);
  private readonly swingRotOffset = new THREE.Euler(-1.2, 0.6, 0.4);
  // Touch-look state
  private touchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private readonly touchSensitivity = 0.0025;

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    options: PlayerOptions,
  ) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.speed = options.speed;
    this.gravity = options.gravity * 10;
    this.jumpVelocity = options.jumpVelocity * 20;
    this.height = options.height * 10;
    this.groundFn = options.ground;

    this.controls = new PointerLockControls(camera, domElement);
    this.object = this.controls.object;

    // Create a simple view-model (hands) and attach to the player/camera
    const vm: ViewModelData = createViewModel();
    this.viewModel = vm.viewModel;
    this.rightHand = vm.rightHand;
    this.baseRightHandPos = vm.baseRightHandPos;
    this.baseRightHandRot = vm.baseRightHandRot;
    this.object.add(this.viewModel);

    // Load and attach sword model to the right hand view-model
    loadSwordForHand(this.rightHand).catch(console.error);

    // Cache base transforms for view-model bobbing
    this.baseViewPos = vm.baseViewPos;
    this.baseViewRot = vm.baseViewRot;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.bindKeys();
    // Bind mouse for punch action (left click)
    domElement.addEventListener('mousedown', this.onMouseDown);
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
            this.jumpVelocity *
            (this.isSprinting ? this.sprintMultiplier / 2 : 1);
          this.canJump = false;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = down;
        break;
      default:
        break;
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
    yawObject.rotation.y -= dx * this.touchSensitivity;

    // Update pitch (camera x rotation), clamp to [-PI/2, PI/2]
    const cam = this.camera;
    const maxPitch = Math.PI / 2 - 0.01;
    const minPitch = -maxPitch;
    const updatedPitch = cam.rotation.x - dy * this.touchSensitivity;
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
    if (this.isPunching) return;
    this.isPunching = true;
    this.punchTime = 0;
  }

  update(delta: number): void {
    // Bound delta to avoid unstable physics/integration on long frames
    const dt = Math.min(delta, 0.05);

    // Damping (use exponential-style damping for stability)
    const damping = Math.exp(-10 * dt);
    this.velocity.x *= damping;
    this.velocity.z *= damping;
    // Gravity
    this.velocity.y -= this.gravity * dt;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const moveSpeed =
      this.speed * (this.isSprinting ? this.sprintMultiplier : 1);
    if (this.moveForward || this.moveBackward)
      this.velocity.z -= this.direction.z * moveSpeed * dt;
    if (this.moveLeft || this.moveRight)
      this.velocity.x -= this.direction.x * moveSpeed * dt;

    // Move controls
    this.controls.moveRight(-this.velocity.x * dt);
    this.controls.moveForward(-this.velocity.z * dt);

    // Apply vertical motion
    this.object.position.y += this.velocity.y * dt;

    const groundY = Math.max(
      this.minLevel,
      this.groundFn(this.object.position.x, this.object.position.z),
    );

    if (this.object.position.y < groundY + this.height) {
      this.velocity.y = 0;
      this.object.position.y = groundY + this.height;
      this.canJump = true;
    }

    this.applyViewBobbing(dt);
    this.applyPunch(dt);
  }

  applyViewBobbing(delta: number): void {
    const basePos = this.baseViewPos;
    const baseRot = this.baseViewRot;

    const isMoving =
      this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;

    if (isMoving) {
      this.bobTime += delta * this.bobFreq;
      const bobY = Math.abs(Math.sin(this.bobTime)) * this.bobAmpY;
      const bobX = Math.sin(this.bobTime * 2) * this.bobAmpX;
      const rotZ = Math.sin(this.bobTime) * this.bobRotZ;

      this.viewModel.position.set(
        basePos.x + bobX,
        basePos.y - bobY,
        basePos.z,
      );
      this.viewModel.rotation.set(baseRot.x, baseRot.y, baseRot.z + rotZ);
    } else {
      // Smoothly return to base pose when not moving
      this.bobTime = 0;
      this.viewModel.position.lerp(basePos, Math.min(1, delta * 10));
      // Slerp-like for Euler: lerp each component.
      this.viewModel.rotation.x +=
        (baseRot.x - this.viewModel.rotation.x) * Math.min(1, delta * 10);
      this.viewModel.rotation.y +=
        (baseRot.y - this.viewModel.rotation.y) * Math.min(1, delta * 10);
      this.viewModel.rotation.z +=
        (baseRot.z - this.viewModel.rotation.z) * Math.min(1, delta * 10);
    }
  }

  applyPunch(delta: number): void {
    if (this.isPunching) {
      this.punchTime += delta;
      const time = Math.min(1, this.punchTime / this.punchDuration);
      // Swing progress: 0 -> 1 -> 0 (peaks at mid-swing)
      const swingProgress = Math.sin(time * Math.PI);

      // Positional arc relative to the base hand position
      this.rightHand.position.set(
        this.baseRightHandPos.x + this.swingPosOffset.x * swingProgress,
        this.baseRightHandPos.y + this.swingPosOffset.y * swingProgress,
        this.baseRightHandPos.z + this.swingPosOffset.z * swingProgress,
      );

      // Rotational sweep relative to base rotation
      this.rightHand.rotation.x =
        this.baseRightHandRot.x + this.swingRotOffset.x * swingProgress;
      this.rightHand.rotation.y =
        this.baseRightHandRot.y + this.swingRotOffset.y * swingProgress;
      this.rightHand.rotation.z =
        this.baseRightHandRot.z + this.swingRotOffset.z * swingProgress;

      if (time >= 1) {
        this.isPunching = false;
        // Ensure exact reset
        this.rightHand.position.copy(this.baseRightHandPos);
        this.rightHand.rotation.copy(this.baseRightHandRot);
      }
    } else {
      // Smoothly return to base
      this.rightHand.position.lerp(
        this.baseRightHandPos,
        Math.min(1, delta * 10),
      );
      this.rightHand.rotation.x +=
        (this.baseRightHandRot.x - this.rightHand.rotation.x) *
        Math.min(1, delta * 10);
      this.rightHand.rotation.y +=
        (this.baseRightHandRot.y - this.rightHand.rotation.y) *
        Math.min(1, delta * 10);
      this.rightHand.rotation.z +=
        (this.baseRightHandRot.z - this.rightHand.rotation.z) *
        Math.min(1, delta * 10);
    }
  }
}
