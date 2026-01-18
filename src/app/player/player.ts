import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { createViewModel, ViewModelData } from './view-model';
import { Sword } from './items/sword';
import { Axe } from './items/axe';
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
import { Pickaxe } from './items/pickaxe';

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
  // Inventory UI state
  inventoryOpen = false;
  draggingItem: Item | null = null;
  draggingFromIndex: number | null = null;
  inventoryOverlay: HTMLElement | null = null;
  draggingPreview: HotbarPreviewEntry | null = null;
  private onMouseMoveForDrag: ((event: MouseEvent) => void) | null = null;
  private pointerWasLocked = false;
  private blockerWasVisible = false;
  private instructionsWasVisible = false;

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

    // Load sword for inventory slot 1 (index 0). equip slot 0
    (async () => {
      const sword = await Sword.create();
      this.inventory[0] = sword;
      this.equipSlot(0);
    })().catch(console.error);

    // Load pickaxe for inventory slot 2.
    (async () => {
      const pickaxe = await Pickaxe.create();
      this.inventory[1] = pickaxe;
      this.updateHotbarUI();
    })().catch(console.error);

    // Load axe for inventory slot 3.
    (async () => {
      const axe = await Axe.create();
      this.inventory[2] = axe;
      this.updateHotbarUI();
    })().catch(console.error);

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
      case 'KeyE':
        if (down) this.toggleInventory();
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

  toggleInventory(): void {
    if (this.inventoryOpen) this.closeInventory();
    else this.openInventory();
  }

  private openInventory(): void {
    if (this.inventoryOpen) return;
    this.inventoryOpen = true;
    // Unlock pointer so cursor is available
    // Remember whether pointer was locked so we can restore UI when closing
    // PointerLockControls exposes `isLocked` as a boolean property
    // Avoid using `any` by accessing it via a typed lookup
    const controlsAny = this.controls as unknown as { isLocked?: boolean };
    this.pointerWasLocked = Boolean(controlsAny.isLocked);
    const blockerElement = document.getElementById('blocker');
    if (blockerElement) {
      const style = globalThis.getComputedStyle(blockerElement);
      this.blockerWasVisible = style.display !== 'none';
    } else {
      this.blockerWasVisible = false;
    }
    if (this.pointerWasLocked) this.controls.unlock();
    // Hide the instructions button while inventory is open (blocker shows automatically)
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) {
      const style = globalThis.getComputedStyle(instructionsElement);
      this.instructionsWasVisible = style.display !== 'none';
      instructionsElement.style.display = 'none';
    } else {
      this.instructionsWasVisible = false;
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'inventory-overlay';
    overlay.classList.add('inventory-overlay');

    const hotbarWrap = document.createElement('ul');
    hotbarWrap.id = 'inventory-hotbar';
    hotbarWrap.classList.add('inventory-hotbar');

    for (let index = 0; index < this.inventory.length; index++) {
      const li = document.createElement('li');
      li.classList.add('slot');
      li.dataset.slot = String(index);
      li.classList.add('inventory-slot');

      li.addEventListener('click', (event) => {
        event.stopPropagation();
        this.handleInventorySlotClick(index);
      });

      hotbarWrap.append(li);
    }

    overlay.append(hotbarWrap);
    document.body.append(overlay);
    this.inventoryOverlay = overlay;

    // Show mouse cursor via body class
    document.body.classList.add('inventory-open');

    // Prepare mousemove handler for dragging preview
    this.onMouseMoveForDrag = (event: MouseEvent) => {
      if (!this.draggingPreview) return;
      const element = this.draggingPreview.canvas;
      if (!element.classList.contains('dragging-preview'))
        element.classList.add('dragging-preview');
      element.style.left = `${String(event.clientX)}px`;
      element.style.top = `${String(event.clientY)}px`;
    };
    document.addEventListener('mousemove', this.onMouseMoveForDrag);

    // Prevent pointer lock while inventory is open
    // Prevent pointer lock via body class
    document.body.classList.add('inventory-open');

    // Render initial overlay contents
    this.updateInventoryOverlay();
  }

  private closeInventory(): void {
    if (!this.inventoryOpen) return;
    this.inventoryOpen = false;

    // If dragging, return item to original slot or first empty
    if (this.draggingItem) {
      const index =
        this.draggingFromIndex !== null && this.draggingFromIndex >= 0
          ? this.draggingFromIndex
          : this.inventory.indexOf(null);
      if (index === -1) {
        // Put back to from index if no empty
        if (this.draggingFromIndex !== null)
          this.inventory[this.draggingFromIndex] = this.draggingItem;
      } else {
        this.inventory[index] = this.draggingItem;
      }
      this.draggingItem = null;
      this.draggingFromIndex = null;
    }

    // Remove overlay and dragging preview
    if (this.inventoryOverlay) {
      const hotbarWrap =
        this.inventoryOverlay.querySelector('#inventory-hotbar');
      if (hotbarWrap) {
        const children = [...hotbarWrap.children];
        for (const li of children) {
          const slotElement = li as HTMLElement & {
            preview?: HotbarPreviewEntry | null;
          };
          const { preview } = slotElement;
          if (preview) disposeHotbarPreview(preview);
          slotElement.preview = null;
        }
      }
      this.inventoryOverlay.remove();
      this.inventoryOverlay = null;
    }
    if (this.draggingPreview) {
      disposeHotbarPreview(this.draggingPreview);
      this.draggingPreview = null;
    }
    if (this.onMouseMoveForDrag) {
      document.removeEventListener('mousemove', this.onMouseMoveForDrag);
      this.onMouseMoveForDrag = null;
    }

    // Restore cursor and pointer behavior
    document.body.classList.remove('inventory-open');
    // Restore the instructions button visibility; do not modify blocker styles
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) {
      instructionsElement.style.display = this.instructionsWasVisible
        ? 'block'
        : 'none';
    }
    if (this.pointerWasLocked) {
      try {
        this.controls.lock();
      } catch {
        // Re-lock may require user gesture; ignore failures
      }
    }
    this.pointerWasLocked = false;
    this.blockerWasVisible = false;
    this.instructionsWasVisible = false;

    this.updateHotbarUI();
  }

  private handleInventorySlotClick(index: number): void {
    // Clicking while not dragging => pick up
    if (!this.draggingItem) {
      const item = this.inventory[index];
      if (!item) return;
      // If this item is currently equipped in-hand, unequip it so the
      // Player doesn't keep holding it while dragging in the inventory UI.
      if (
        this.currentSlot === index &&
        item.object &&
        item.object.parent === this.rightHand
      ) {
        this.rightHand.remove(item.object);
      }
      this.draggingItem = item;
      this.draggingFromIndex = index;
      this.inventory[index] = null;
      // Update both overlay and main hotbar so the picked-up slot appears empty
      this.updateInventoryOverlay();
      this.updateHotbarUI();
      if (this.draggingPreview) {
        disposeHotbarPreview(this.draggingPreview);
        this.draggingPreview = null;
      }
      this.draggingPreview = createHotbarPreview(this.draggingItem, 96);
      const { canvas } = this.draggingPreview;
      Object.assign(canvas.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '10000',
        transform: 'translate(-50%, -50%)',
      } as Record<string, string>);
      document.body.append(canvas);
      return;
    }

    // We are dragging an item
    const target = this.inventory[index];
    if (!target) {
      // Move dragged item to empty slot
      this.inventory[index] = this.draggingItem;
      this.draggingItem = null;
      this.draggingFromIndex = null;
      if (this.draggingPreview) {
        disposeHotbarPreview(this.draggingPreview);
        this.draggingPreview = null;
      }
      this.updateInventoryOverlay();
      this.updateHotbarUI();
      return;
    }

    // Target occupied: put dragged item into target slot, and pick up target.
    // Keep `draggingFromIndex` as the original pickup slot so that closing
    // The Inventory will return the currently dragged item to that original
    // Slot (preserving both items) instead of overwriting the just-placed item.
    this.inventory[index] = this.draggingItem;
    const updatedDragging = target;
    this.draggingItem = updatedDragging;
    // Update dragging preview
    if (this.draggingPreview) {
      disposeHotbarPreview(this.draggingPreview);
      this.draggingPreview = null;
    }

    this.draggingPreview = createHotbarPreview(this.draggingItem, 96);
    const { canvas } = this.draggingPreview;
    Object.assign(canvas.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '10000',
      transform: 'translate(-50%, -50%)',
    } as Record<string, string>);
    document.body.append(canvas);

    this.updateInventoryOverlay();
    this.updateHotbarUI();
  }

  private updateInventoryOverlay(): void {
    if (!this.inventoryOverlay) return;
    const hotbarWrap = this.inventoryOverlay.querySelector('#inventory-hotbar');
    if (!hotbarWrap) return;
    const children = [...hotbarWrap.children];
    for (const [index, li] of children.entries()) {
      const slotElement = li as HTMLElement & {
        preview?: HotbarPreviewEntry | null;
      };
      // Clear existing canvas in overlay slot
      const old = slotElement.querySelector('canvas');
      if (old) old.remove();
      const item = this.inventory[index];
      if (item && item.object) {
        const entry = createHotbarPreview(item, 96);
        slotElement.append(entry.canvas);
        // Dispose after leaving overlay (we keep reference in hotbarRenderers for normal hotbar)
        // Store the overlay preview on the element for later disposal when overlay removed
        slotElement.preview = entry;
      } else if (slotElement.preview) {
        const { preview } = slotElement;
        disposeHotbarPreview(preview);
        slotElement.preview = null;
      }
      slotElement.classList.toggle('selected', index === this.currentSlot);
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
        const existing = this.hotbarRenderers[index];
        // Recreate preview if none exists or the underlying object changed
        if (!existing || existing.object !== item.object) {
          if (existing) disposeHotbarPreview(existing);
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
