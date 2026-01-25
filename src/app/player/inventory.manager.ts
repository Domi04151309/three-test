import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Item } from './items/item';
import type { HotbarPreviewEntry } from './hotbar.preview';
import { updateHotbarUI } from './inventory.overlay';
import { closeInventory, openInventory } from './inventory.panel';
import { terrainOptions } from '../terrain/terrain-options';

interface InventoryHost {
  controls: PointerLockControls;
  rightHand: THREE.Mesh;
}
export class InventoryManager {
  host: InventoryHost;
  controls: PointerLockControls;
  rightHand: THREE.Mesh;
  world: THREE.Scene | null = null;
  ground: ((x: number, z: number) => number) | null = null;
  dropped: Array<{
    item: Item;
    object: THREE.Object3D;
    droppedAt: number;
    originalScale: number;
  }> = [];
  inventory: (Item | null)[] = Array.from({ length: 36 }, () => null);
  currentSlot = -1;
  hotbarRenderers: (HotbarPreviewEntry | null)[] = Array.from(
    { length: 9 },
    () => null,
  );
  inventoryOpen = false;
  draggingItem: Item | null = null;
  draggingFromIndex: number | null = null;
  inventoryOverlay: HTMLElement | null = null;
  draggingPreview: HotbarPreviewEntry | null = null;
  onMouseMoveForDrag: ((event: MouseEvent) => void) | null = null;
  pointerWasLocked = false;
  blockerWasVisible = false;
  instructionsWasVisible = false;
  constructor(host: InventoryHost) {
    this.host = host;
    this.controls = host.controls;
    this.rightHand = host.rightHand;
  }

  toggleInventory(): void {
    if (this.inventoryOpen) closeInventory(this);
    else openInventory(this);
  }

  dropCurrent(): void {
    if (this.currentSlot < 0 || this.currentSlot >= this.inventory.length)
      return;
    const item = this.inventory[this.currentSlot];
    if (!item || !item.object) return;

    if (item.object.parent === this.rightHand)
      this.rightHand.remove(item.object);

    const pos = this.controls.object.position.clone();
    const yaw = this.controls.object.rotation.y;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const dropDistance = 8;
    const dropPos = pos.add(forward.multiplyScalar(dropDistance));
    if (this.ground) {
      const groundY = this.ground(dropPos.x, dropPos.z);
      const floatOffset = 4;
      let targetY = groundY + floatOffset;
      if (targetY < terrainOptions.waterLevel + floatOffset)
        targetY = terrainOptions.waterLevel + floatOffset;
      dropPos.y = targetY;
    }
    const originalScale = item.object.scale.x;
    item.object.scale.setScalar(originalScale * 4);
    item.object.position.copy(dropPos);

    if (this.world) this.world.add(item.object);
    this.dropped.push({
      item,
      object: item.object,
      droppedAt: performance.now(),
      originalScale,
    });

    this.inventory[this.currentSlot] = null;
    updateHotbarUI(this);
  }

  update(): void {
    if (this.dropped.length === 0) return;
    const playerPos = this.controls.object.position;
    const pickupRadius = 3;
    const pickupRadiusSq = pickupRadius * pickupRadius;
    const now = performance.now();
    const worldPos = new THREE.Vector3();
    for (let index = 0; index < this.dropped.length; index++) {
      const rec = this.dropped[index];
      rec.object.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -0.04);
      if (now - rec.droppedAt < 800) continue;
      rec.object.getWorldPosition(worldPos);
      const dx = worldPos.x - playerPos.x;
      const dz = worldPos.z - playerPos.z;
      const horizontalDistanceSquare = dx * dx + dz * dz;
      if (horizontalDistanceSquare <= pickupRadiusSq) {
        const freeIndex = this.inventory.indexOf(null);
        if (freeIndex === -1) return;
        rec.object.scale.setScalar(rec.originalScale);
        rec.object.position.copy(rec.item.defaultPosition);
        rec.object.rotation.copy(rec.item.defaultRotation);
        this.inventory[freeIndex] = rec.item;
        if (this.world) this.world.remove(rec.object);
        this.dropped.splice(index, 1);
        if (freeIndex === this.currentSlot) this.equipSlot(freeIndex);
        else updateHotbarUI(this);
        return;
      }
    }
  }

  equipSlot(index: number): void {
    if (index < 0 || index >= this.inventory.length) return;
    if (this.currentSlot !== -1) {
      const current = this.inventory[this.currentSlot];
      if (current && current.object && current.object.parent === this.rightHand)
        this.rightHand.remove(current.object);
    }

    this.currentSlot = index;

    const next = this.inventory[this.currentSlot];
    if (next && next.object) {
      next.object.position.copy(next.defaultPosition);
      next.object.rotation.copy(next.defaultRotation);
      this.rightHand.add(next.object);
    }

    updateHotbarUI(this);
  }
}
